const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

router.get('/api/image-source', async (req, res, next) => {
    try {
        const quiz = await getQuiz();
        const userUID = req.query.userUID;
        if (!quiz) return res.status(404).send('No quiz found');
        const guesses = await getUserGuesses(userUID);
        const imagePath = await getImagePath(guesses.some(guess => guess.exactGuessUID === quiz.monsterUID) ? 999 : guesses.length);
        const fullPath = path.join(__dirname, imagePath);

        // Check if the image exists
        const imageExists = await fs.access(fullPath).then(() => true).catch(() => false);
        if (!imageExists) {
            return res.status(404).send('Image not found');
        }

        // Set the appropriate content type based on the file extension
        const contentType = getImageContentType(fullPath);
        res.contentType(contentType);

        // Read the image file and send it as a response
        const imageData = await fs.readFile(fullPath);
        res.send(imageData);
    } catch (error) {
        next(error);
    }
});

router.get('/api/quiz', async (req, res) => {
    const userUID = req.query.userUID;
    const guesses = await getUserGuesses(userUID);
    const { response } = await collapseGuesses(guesses);
    if (await hasWon(userUID)) {
        response.correct = true;
        return res.status(200).json(response);
    }
    const [availableOptions] = await global.db.execute(`SELECT UID, name
    FROM mq_monsters`);
    response.availableOptions = availableOptions;
    res.status(200).json(response);
});

// router.post('/api/guess', authenticate, async (req, res) => {
router.post('/api/guess', async (req, res) => {
    const quiz = await getQuiz();
    if (!quiz) return res.status(404).send('No quiz found');
    const userUID = req.body.userUID;
    const guess = req.body.guess;
    // build the guesses object up until this one
    const guessRows = await getUserGuesses(userUID);
    const guessRowsNum = guessRows.length;

    await global.db.execute(`INSERT INTO mq_guesses
    (userUID, quizDate, guessNum, exactGuessUID, hintCR, hintHP, hintMovement, hintSize, hintAlignment, hintType)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [userUID, quiz.quizDate, guessRowsNum + 1, guess.exactGuessUID || null, guess.hintCR || null, guess.hintHP || null, guess.hintMovement || null, guess.hintSize || null, guess.hintAlignment || null, guess.hintType || null]);

    guessRows.push({
        userUID: userUID,
        quizDate: quiz.quizDate,
        guessNum: guessRows.length + 1,
        exactGuessUID: guess.exactGuessUID || null,
        hintCR: guess.hintCR || null,
        hintHP: guess.hintHP || null,
        hintMovement: guess.hintMovement || null,
        hintSize: guess.hintSize || null,
        hintAlignment: guess.hintAlignment || null,
        hintType: guess.hintType || null
    });

    const { queryParts, params, response } = await collapseGuesses(guessRows);

    // now find all possible answers that user can still give
    const query = `SELECT UID, name
    FROM mq_monsters
    ${queryParts.length ? 'WHERE' : ''} ${queryParts.join(' AND ')}`;
    const completeQuery = global.mysql.format(query, params);
    const [availableOptions] = await global.db.query(completeQuery);

    if (guess.exactGuessUID) {
        if (guess.exactGuessUID === quiz.monsterUID) {
            return res.json({ correct: true, score: availableOptions.length });
        }
    }

    response.availableOptions = availableOptions;

    return res.json(response);
});

async function collapseGuesses(guessRows) {
    const quiz = await getQuiz();
    const params = [];
    const queryParts = [];
    const response = {};

    for (const guess of guessRows) {
        if (guess.exactGuessUID) {
            queryParts.push(`UID <> ?`);
            params.push(guess.exactGuessUID);
        }
        if (guess.hintCR) {
            queryParts.push(`crVal = ?`);
            params.push(quiz.crVal);
            response.hintCR = quiz.crVal;
        }
        if (guess.hintHP) {
            queryParts.push(`hp = ?`);
            params.push(quiz.hp);
            response.hintHP = quiz.hp;
        }
        if (guess.hintMovement) {
            queryParts.push(`speed = ?`);
            params.push(quiz.speed);
            response.hintMovement = quiz.speed;
        }
        if (guess.hintSize) {
            queryParts.push(`sizeVal = ?`);
            params.push(quiz.sizeVal);
            response.hintSize = quiz.sizeVal;
        }
        if (guess.hintAlignment) {
            queryParts.push(`alignment = ?`);
            params.push(quiz.alignment);
            response.hintAlignment = quiz.alignment;
        }
        if (guess.hintType) {
            queryParts.push(`type = ?`);
            params.push(quiz.type);
            response.hintType = quiz.type;
        }
        if (guess.hintAC) {
            queryParts.push(`ac = ?`);
            params.push(quiz.ac);
            response.hintAC = quiz.ac;
        }
    }
    return { queryParts, params, response };
}

// Function to determine content type based on file extension
function getImageContentType(imageName) {
    const extension = path.extname(imageName).toLowerCase();
    switch (extension) {
        case '.jpg':
        case '.jpeg':
            return 'image/jpeg';
        case '.png':
            return 'image/png';
        case '.gif':
            return 'image/gif';
        // Add more cases for other image formats if needed
        default:
            return 'application/octet-stream'; // Default to binary data
    }
}

async function getImagePath(guessesNumber = 0) {
    const variant = guessesNumber + 2 <= 7 ? `blurred_images_${guessesNumber + 2}` : 'original_images';
    const quiz = await getQuiz();
    const fileName = `assets/${variant}/${quiz.image_source.split('/').pop()}`;
    return fileName;
}

async function getQuiz() {
    const formattedDate = new Date().toISOString().split('T')[0];
    const [quizRow] = await global.db.execute(`SELECT *
    FROM mq_quizzes
    JOIN mq_monsters
    ON monsterUID = UID
    WHERE quizDate = ?`, [formattedDate]);
    if (!quizRow.length) {
        return false;
    }
    const quiz = quizRow[0];
    return quiz;
}

async function getUserGuesses(userUID) {
    const formattedDate = new Date().toISOString().split('T')[0];
    const [guessRows] = await global.db.execute(`SELECT *
    FROM mq_guesses
    WHERE userUID = ? AND quizDate = ?
    ORDER BY guessNum asc`, [userUID, formattedDate]);
    return guessRows;
}

async function hasWon(userUID) {
    const quiz = await getQuiz();
    const [winningRow] = await global.db.execute(`SELECT *
        FROM mq_guesses
        WHERE userUID = ? AND quizDate = ? AND exactGuessUID = ?`, [userUID, quiz.quizDate, quiz.monsterUID]);
    if (winningRow.length) {
        return true;
    }
    return false;
}

module.exports = router;
