const nodemailer = require('nodemailer');
const email = process.env.QUESTFINDER_EMAIL_ADDRESS;
const password = process.env.QUESTFINDER_EMAIL_PASSWORD;

global.sendMail = (sendTo, subject, html) => {
    try {
        if (!sendTo || sendTo.length === 0) return;

        const mailOptions = {
            from: email,
            subject,
            html,
        };
        const transporter = nodemailer.createTransport({
            pool: true,
            host: 'smtps.aruba.it',
            port: 465,
            secure: true,
            auth: {
                user: email,
                pass: password,
            },
        });
        const recipients = Array.isArray(sendTo) ? sendTo : [sendTo];
        transporter.on("idle", function () {
            // send next message from the pending queue
            while (transporter.isIdle() && recipients.length) {
                const recipient = recipients.shift();
                console.log({ recipient });
                transporter.sendMail({
                    ...mailOptions,
                    to: recipient,
                }, (error, info) => {
                    if (error) {
                        console.error(error);
                    } else {
                        console.log(info);
                    }
                    transporter.close();
                });
            }
        });
    } catch (error) {
        console.error(error);
    }
}