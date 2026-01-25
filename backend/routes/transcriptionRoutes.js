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
    fileSize: 60 * 1024 * 1024, // 60MB limit (supports up to 60 minutes at 128kbps)
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
          message: 'File too large. Maximum size is 60MB (supports up to 60 minutes).',
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

// Transcription route - supports both file upload and file_path
// If file_path is in body, skip multer (file already uploaded to Supabase)
router.post('/transcribe', authenticate, (req, res, next) => {
  // If file_path is provided, skip multer (file already in Supabase)
  if (req.body && req.body.file_path) {
    return next();
  }
  // Otherwise, use multer to handle file upload
  upload.single('audio')(req, res, (err) => {
    if (err) {
      return handleMulterError(err, req, res, next);
    }
    next();
  });
}, transcriptionController.transcribeAudio);

module.exports = router;

