global.APP_ENVIRONMENT = process.env.APP_ENVIRONMENT ?? 'dev';

const express = require('express');
const cors = require('cors');
const http = require('http');
const cookieParser = require('cookie-parser');

// log environment and node version
console.log(`App environment: ${global.APP_ENVIRONMENT}`);
console.log(`Node version: ${process.version}`);

const app = express();
const server = http.createServer(app);

// CORS options
const _CORS_OPTIONS = {
    origin: true,
    credentials: true
};
console.log(`App cors options: ${JSON.stringify(_CORS_OPTIONS, null, 4)}`);

// Middlewares
app.use((req, res, next) => {
    console.log(`Request origin: ${req.headers.origin}`);
    // Disable caching for all routes, might wanna tune this later
    res.header('Cache-Control', 'no-store');
    next();
});
app.use(cors(_CORS_OPTIONS));
app.use(express.json());
app.use(cookieParser());

// Server Utils, like db, auth, web sockets, ...
require('./serverUtils/_serverUtils')(app, server);

app.use(require('./router'));

const port = global.APP_ENVIRONMENT == 'production' ? (process.env.PORT ?? null) : 8080;

server.listen(port, () => {
    console.log(`MultiApp listening on port ${server.address().port}, time: ${new Date()}`);
});

module.exports = app;
