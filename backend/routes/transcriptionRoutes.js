const express = require('express');
const router = express.Router();
const transcriptionController = require('./../controllers/transcriptionController');
const multer = require('multer');
const { authenticate } = require('./../middleware/auth');

// Use in-memory storage to forward to Supabase
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit (OpenAI Whisper limit)
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm', 'audio/m4a'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only audio files are allowed.'));
    }
  },
});

// Error handler for multer errors (must be before the route handler)
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        status: 'error',
        message: 'File too large. Maximum size is 25MB.',
        error: err.message
      });
    }
    return res.status(400).json({
      status: 'error',
      message: 'File upload error',
      error: err.message
    });
  }
  if (err) {
    return res.status(400).json({
      status: 'error',
      message: err.message || 'File upload error',
      error: err.message || 'Invalid file'
    });
  }
  next();
};

// Transcription route - requires authentication to get user info for file naming
router.post('/transcribe', authenticate, upload.single('audio'), handleMulterError, transcriptionController.transcribeAudio);

module.exports = router;

