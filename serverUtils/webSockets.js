const initSocketIo = require('socket.io');
global.socketListeners = {}; // object to store socket listeners for apps to use

global.userSockets = {};

module.exports = (server) => {
    try {
        const socketIo = initSocketIo(server, {
            cors: {
                origin: "*", // allow all origins, especially since it's multi-app
                methods: ["GET", "POST", "DELETE"],
            }
        });
        socketIo.on('connection', async (socket) => {
            const userData = await global.authenticators.tokenVerifier(socket.handshake.query.token);
            const { UID: userUID } = userData;

            socket.on('disconnect', () => {
                if (userUID in global.userSockets) {
                    if (socket.id in global.userSockets[userUID]) {
                        delete global.userSockets[userUID][socket.id];
                        if (Object.keys(global.userSockets[userUID]).length === 0) delete global.userSockets[userUID];
                    }
                }
            })

            if (!userUID) {
                return socket.disconnect(true);;
            }

            if (!(userUID in global.userSockets)) {
                global.userSockets[userUID] = {};
            }
            global.userSockets[userUID][socket.id] = socket;

            for (let event in global.socketListeners) {
                socket.on(event, global.socketListeners[event]);
            }

            console.log(`Socket connected: ${socket.id}`);
        });
    } catch (e) {
        console.log(e);
    }
}

global.sendSocketMessage = (userUID, type, body) => {
    // check if userUID is in global.userSockets
    if (!(userUID in global.userSockets)) {
        return;
    }
    // send message
    for (let socketID in global.userSockets[userUID]) {
        global.userSockets[userUID][socketID].emit(type, body);
    }
}

async function getUserUIDFromFirebaseUID(firebaseUID = null) {
    if (!firebaseUID) {
        return false;
    }
    const [rows] = await global.db.execute('SELECT * FROM users WHERE firebaseUid = ?', [firebaseUID]);
    if (rows.length === 0) {
        return false;
    }
    return rows[0].UID;
}
