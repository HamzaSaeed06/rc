const express = require('express');
const { uploadFile } = require('../controllers/file.controller');
const { protect } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

const router = express.Router();

router.use(protect);
router.post('/upload', upload.single('file'), uploadFile);

module.exports = router;
