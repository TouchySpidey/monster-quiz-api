global.projectUtils = {}; // init for apps to use

// uploads directory
// require('./uploadsDirectoryManager');

// api authenticator
// require('./apiAuthenticator');

// firebase
// require('./initFirebase')();

// google services
// require('./googleServices');

// mailer
// require('./mailer');

module.exports = (app, server) => {
    // MySQL database
    app.waitingDB = require('./database');

    // web sockets
    // require('./webSockets')(server);

    // users authentication and registration
    // app.use('/auth', require('./auth'));
}
