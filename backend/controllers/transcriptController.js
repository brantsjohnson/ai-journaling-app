const db = require('../db');

// Create a transcript record linked to a recording
exports.createTranscript = async (req, res) => {
  const { recording_id, text, language, confidence } = req.body;

  try {
    if (!recording_id || !text) {
      return res.status(400).json({
        status: 'fail',
        message: 'recording_id and text are required',
      });
    }

    const recordingResult = await db.query('SELECT id FROM entries WHERE id = $1', [recording_id]);
    const recording = recordingResult.rows[0];

    if (!recording) {
      return res.status(404).json({ status: 'fail', message: 'Recording not found' });
    }

    const insertResult = await db.query(
      `INSERT INTO transcripts (recording_id, text, language, confidence)
       VALUES ($1, $2, $3, $4)
       RETURNING id, recording_id, text, language, confidence, created_at`,
      [recording_id, text, language || null, confidence || null]
    );
    const newTranscript = insertResult.rows[0];

    await db.query(
      'UPDATE entries SET transcript_id = $1, transcript = $2 WHERE id = $3',
      [newTranscript.id, text, recording_id]
    );

    res.status(201).json({ status: 'success', data: { transcript: newTranscript } });
  } catch (error) {
    console.error('Create transcript error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Get transcript by recording_id
exports.getTranscriptByRecording = async (req, res) => {
  const { recordingId } = req.params;

  try {
    const result = await db.query(
      `SELECT id, recording_id, text, language, confidence, created_at
       FROM transcripts
       WHERE recording_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [recordingId]
    );
    const transcript = result.rows[0];

    if (!transcript) {
      return res.status(404).json({ status: 'fail', message: 'Transcript not found' });
    }

    res.status(200).json({ status: 'success', data: { transcript } });
  } catch (error) {
    console.error('Get transcript error:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

// Retry transcription for an existing recording
exports.retryTranscription = async (req, res) => {
  const { recordingId } = req.params;

  try {
    const recordingResult = await db.query(
      'SELECT id, local_path, user_id FROM entries WHERE id = $1',
      [recordingId]
    );
    const recording = recordingResult.rows[0];

    if (!recording) {
      return res.status(404).json({ status: 'fail', message: 'Recording not found' });
    }

    if (!recording.local_path) {
      return res.status(400).json({ status: 'fail', message: 'Recording has no audio file' });
    }

    res.status(200).json({
      status: 'success',
      data: {
        recording_id: recording.id,
        local_path: recording.local_path,
        message: 'Use the local_path to retry transcription via /transcribe endpoint',
      },
    });
  } catch (error) {
    console.error('Retry transcription error:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

