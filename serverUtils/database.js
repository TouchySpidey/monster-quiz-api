const mysql = require('mysql2');
global.mysql = mysql;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const connectToDB = async () => {
    try {
        const delay = process.env.DB_DELAY ?? 0;
        if (delay) {
            await sleep(delay);
        }
        const dbConfig = {
            host: process.env.MONSTERQUIZ_DB_HOST,
            port: process.env.MONSTERQUIZ_DB_PORT,
            user: process.env.MONSTERQUIZ_DB_USER,
            password: process.env.MONSTERQUIZ_DB_PSWD,
            database: process.env.MONSTERQUIZ_DB_NAME,
            timezone: 'Z',
        };
        if (process.env.MONSTERQUIZ_DB_SSL == 'true') {
            dbConfig.ssl = {
                rejectUnauthorized: true,
            };
        }
        console.log('Initializing database connection...');
        console.log(dbConfig);
        const pool = mysql.createPool(dbConfig);
        global._db = pool;
        global.db = pool.promise();
        await global.db.execute('SELECT 1');
        console.log('Database connection established');
    } catch (error) {
        console.error('Database connection failed:', error);
        process.exit(1);
    }
};

module.exports = new Promise(async (resolve, reject) => {
    await connectToDB();
    resolve();
});
