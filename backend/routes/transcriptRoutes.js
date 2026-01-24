const express = require('express');
const router = express.Router();
const transcriptController = require('./../controllers/transcriptController');
const { authenticate } = require('./../middleware/auth');

// All transcript routes require authentication
router.use(authenticate);

router.post('/transcripts', transcriptController.createTranscript);
router.get('/recordings/:recordingId/transcript', transcriptController.getTranscriptByRecording);
router.post('/recordings/:recordingId/retry-transcription', transcriptController.retryTranscription);

module.exports = router;

