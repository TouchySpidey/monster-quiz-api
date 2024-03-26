const fs = require('fs');
const multer = require('multer');
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}
if (!fs.existsSync('uploads/ads')) {
    fs.mkdirSync('uploads/ads');
}
if (!fs.existsSync('uploads/ads/originals')) {
    fs.mkdirSync('uploads/ads/originals');
}
if (!fs.existsSync('uploads/ads/thumbnails')) {
    fs.mkdirSync('uploads/ads/thumbnails');
}
global.multerUpload = multer({
    dest: 'uploads',
    filename: (req, file, cb) => {
        // whatever name multer wants, but keep the extension
        cb(null, file.originalname);
    }
});