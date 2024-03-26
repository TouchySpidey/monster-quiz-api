// Function to initialize Firebase
global.firebase = require('firebase-admin');
module.exports = () => {
    let serviceAccount;
    
    // Check if the variable is a valid JSON string
    if (process.env.QUESTFINDER_SERVICE_ACCOUNT.startsWith('{')) {
        try {
            serviceAccount = JSON.parse(process.env.QUESTFINDER_SERVICE_ACCOUNT);
        } catch (error) {
            console.error('Error parsing SERVICE_ACCOUNT_JSON string', error);
            process.exit(1); // Exit if there is a parsing error
        }
    } else {
        // It's not a JSON string, so treat it as a file path
        serviceAccount = require(process.env.QUESTFINDER_SERVICE_ACCOUNT);
    }
    
    // Initialize Firebase
    global.firebase.initializeApp({
        credential: global.firebase.credential.cert(serviceAccount),
    });
}