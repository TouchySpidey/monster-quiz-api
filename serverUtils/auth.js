const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const { ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL } = global;

/*
signup:
    * check if email exists
        * if so, return 409 and exit
    * create verification token
    * add to db verification token, email, hashed password, nickname, createdOn
    * send email with verification token
    * return 201

signup verify:
    * find row with verification token in table
        * if not found, return 404 and exit
    * check expiration
        * if expired, return 410 and exit
    * create user
    * remove row
    * return 201

login:
    * check if email exists
        * if not, return 404 and exit
    * compare password
    * create jwt
    * return 200

refresh3

*/

router.post('/register', async (req, res) => {
    try {
        const { email, password, nickname } = req.body;

        if (!email || !password || !nickname) return res.status(400).send("Bad Request");

        if (password.length < 6) return res.status(400).send("Password too short");

        // check if email or nickname already exists in existing users
        const [userRows] = await global.db.execute(`SELECT email, nickname FROM users WHERE email = ? OR nickname = ?`, [email, nickname]);
        if (userRows.length && userRows[0].email == email) return res.status(409).send("Email already exists");
        if (userRows.length && userRows[0].nickname == nickname) return res.status(409).send("Nickname already exists");

        // check if email is already in verification_tokens, meaning that they might wanna resend the email
        const [tokenRows] = await global.db.execute(`SELECT token FROM verification_tokens WHERE email = ?`, [email]);
        if (tokenRows.length) {
            registerEmail(tokenRows[0].token, email);
            return res.status(200).send("Token already created for email, sending again");
        }

        // check if nickname is already in verification_tokens, meaning it's occupied (because it's a different user / different email)
        const [tokenRows2] = await global.db.execute(`SELECT * FROM verification_tokens
        WHERE nickname = ?`, [nickname]);
        if (tokenRows2.length) return res.status(409).send("Nickname already exists");

        const token = uuidv4();
        const hashedPassword = await bcrypt.hash(password, 10);

        await global.db.execute(`INSERT INTO verification_tokens (email, nickname, password, token, createdOn, expiresOn)
            VALUES (?, ?, ?, ?, UTC_TIMESTAMP(), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 1 HOUR))`, [email, nickname, hashedPassword, token]);

        registerEmail(token, email);
        return res.status(201).send("Created");
    } catch (error) {
        console.error(error);
        return res.status(500).send("Internal Server Error");
    }
});

router.post('/register/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;
        if (!token) return res.status(400).send("Bad Request");

        const [rows] = await global.db.execute(`SELECT *
        FROM verification_tokens
        WHERE token = ? AND expiresOn > UTC_TIMESTAMP()`, [token]);
        if (!rows.length) return res.status(400).send("Token not found or expired");

        const hashedPassword = await bcrypt.hash(password, 10);
        console.log({ hashedPassword })
        if (!await bcrypt.compare(password, rows[0].password)) return res.status(400).send("Password doesn't match");

        const firebaseUserRecord = await global.firebase.auth().createUser({
            email: rows[0].email,
            emailVerified: true,
            password: password,
            displayName: rows[0].nickname,
            disabled: false
        });

        const user = {
            UID: uuidv4(),
            firebaseUID: firebaseUserRecord.uid,
            email: rows[0].email,
            nickname: rows[0].nickname,
            password: rows[0].password,
        };
        await global.db.execute(`INSERT INTO users (UID, firebaseUID, email, nickname, password, signedUpOn, updatedOn)
            VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())`, [user.UID, user.firebaseUID, user.email, user.nickname, user.password]);

        await global.db.execute(`DELETE FROM verification_tokens WHERE token = ?`, [token]);
        res.status(201).send("Email verified");
        welcomeEmail(user.nickname, user.email);
    } catch (error) {
        console.error(error);
        return res.status(500).send("Internal Server Error");
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).send("Bad Request");

        const [rows] = await global.db.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (!rows.length) return res.status(404).send("User not found");

        const user = rows[0];
        if (!await bcrypt.compare(password, user.password)) return res.status(401).send("Unauthorized");

        const decodedUser = {
            UID: user.UID,
            email: user.email,
            nickname: user.nickname,
        };

        const accessToken = jwt.sign({
            UID: user.UID,
            email: user.email,
            nickname: user.nickname,
        }, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
        const tokenUID = uuidv4();
        const refreshToken = jwt.sign({
            tokenUID,
            userUID: user.UID,
        }, process.env.JWT_SECRET, { expiresIn: REFRESH_TOKEN_TTL });
        global.db.execute(`INSERT INTO refresh_tokens (tokenUID, userUID, refreshCounter, createdOn, expiresOn)
            VALUES (?, ?, 0, UTC_TIMESTAMP(), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 DAY))`, [tokenUID, user.UID]);

        res.cookie('refreshToken', refreshToken, { httpOnly: true, sameSite: 'strict' })
            .header('Authorization', `Bearer ${accessToken}`)
            .status(200).send({ user: decodedUser });
    } catch (error) {
        console.error(error);
        return res.status(500).send("Internal Server Error");
    }
});

router.get('/refresh', global.authenticators.authenticate, async (req, res) => {
    res.status(200).send('Refreshed');
});

const welcomeEmail = async (nickname, email) => {
    try {
        global.sendMail(email, "Benvenuto su Bookpack!", `<p>
            <h2>Ciao ${nickname}!</h2>
            <p>Benvenuto su Bookpack! Grazie per esserti registrato.</p>
            <p>Se hai bisogno di aiuto o hai domande, non esitare a contattarci.</p>
            <p><i>Il team di Bookpack</i></p>
        </p>`);
    } catch (error) {
        console.error(error);
    }
}

const registerEmail = async (token, email) => {
    try {
        global.sendMail(email, "Bookpack — Conferma la tua email", `<p>
            <h2>Conferma la tua email</h2>
            <p>Per completare la registrazione, clicca sul link sottostante:</p>
            <p><a href="${process.env.FRONTEND_URL}/auth/register/${token}">Conferma email</a></p>
            <p>Se non hai richiesto la registrazione, ignora questa email.</p>
        </p>`);
        console.log(`${process.env.FRONTEND_URL}/auth/register/${token}`);
    } catch (error) {
        console.error(error);
    }
};

module.exports = router;