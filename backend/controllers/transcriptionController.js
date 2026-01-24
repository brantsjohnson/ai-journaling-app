const axios = require('axios');
const FormData = require('form-data');
const supabase = require('../services/supabaseClient');
const db = require('../db');

// #region agent log
const dbgLog = (loc, msg, data, hyp) => console.log('[DEBUG]', JSON.stringify({ location: loc, message: msg, data, hypothesisId: hyp, timestamp: Date.now(), sessionId: 'debug-session' }));
// #endregion

// Upload to Supabase storage and proxy transcription to OpenAI
exports.transcribeAudio = async (req, res) => {
  try {
    // #region agent log
    dbgLog('transcriptionController.js:entry', 'Transcribe handler entered', { hasFile: !!req.file, hasUser: !!req.user }, 'H1');
    // #endregion
    console.log('🎙️ Transcription request started');
    console.log('Environment check:', {
      hasOpenAIKey: !!process.env.OPEN_AI_KEY,
      keyPrefix: process.env.OPEN_AI_KEY?.substring(0, 15) || 'NOT SET',
      nodeEnv: process.env.NODE_ENV,
      isVercel: !!process.env.VERCEL
    });

    if (!req.file) {
      // #region agent log
      dbgLog('transcriptionController.js:no-file', 'No req.file', {}, 'H2');
      // #endregion
      return res.status(400).json({ status: 'fail', message: 'Audio file is required' });
    }

    console.log('Transcription request received:', {
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

    // Get user ID from request (for authenticated requests)
    let userId = null;
    if (req.user) {
      if (req.user?.supabaseUser) {
        const email = req.user.email;
        const userResult = await db.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userResult.rows[0]) {
          userId = userResult.rows[0].id;
        }
      } else {
        userId = req.user?.userId;
      }
      userId = parseInt(userId, 10);
    }

    // Get journal date from request body or use today's date
    let journalDate = req.body?.journal_date || new Date().toISOString().split('T')[0];
    
    // Ensure date is in YYYY-MM-DD format
    if (journalDate && !journalDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // Try to parse and reformat if needed
      const parsedDate = new Date(journalDate);
      if (!isNaN(parsedDate.getTime())) {
        journalDate = parsedDate.toISOString().split('T')[0];
      } else {
        journalDate = new Date().toISOString().split('T')[0];
      }
    }
    
    // Format date as MM-DD-YYYY for filename
    const dateParts = journalDate.split('-');
    const formattedDate = `${dateParts[1]}-${dateParts[2]}-${dateParts[0]}`;
    
    // Count existing entries for this user on this date to get entry number
    let entryNumber = 1;
    if (userId && !isNaN(userId)) {
      try {
        const countResult = await db.query(
          'SELECT COUNT(*) as count FROM entries WHERE user_id = $1 AND journal_date = $2',
          [userId, journalDate]
        );
        entryNumber = parseInt(countResult.rows[0]?.count || 0, 10) + 1;
      } catch (err) {
        console.warn('Could not count entries, using entry number 1:', err.message);
      }
    }

    // Get duration if provided (for filename)
    const duration = parseInt(req.body?.duration_ms || 0, 10);
    const durationSeconds = Math.round(duration / 1000);

    // Add unique timestamp suffix to prevent filename collisions
    // Format: MM-DD-YYYY--{entryNumber}--{duration}--{timestamp}.mp3
    const uniqueSuffix = Date.now().toString().slice(-6); // Last 6 digits of timestamp for uniqueness
    
    // Generate filename in format: MM-DD-YYYY--{entryNumber}--{duration}--{unique}.mp3
    const fileExt = req.file.originalname?.split('.').pop() || 'mp3';
    const filename = `${formattedDate}--${String(entryNumber).padStart(2, '0')}--${durationSeconds}--${uniqueSuffix}.${fileExt}`;
    
    // Sanitize bucket name - remove any whitespace or newlines
    const bucket = (process.env.SUPABASE_AUDIO_BUCKET || 'audio').trim().replace(/[\r\n\t]/g, '');

    console.log('Uploading to Supabase bucket:', bucket);
    console.log('Generated filename:', filename);
    console.log('Entry number:', entryNumber, 'Date:', journalDate);

    // #region agent log
    dbgLog('transcriptionController.js:pre-supabase', 'Before Supabase upload', { bucket, filename, entryNumber, journalDate, uniqueSuffix }, 'H3');
    // #endregion
    
    // Upload directly to bucket root (not in audio/ subfolder to avoid double path)
    // Use upsert: true to handle edge case where filename somehow still collides
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filename, req.file.buffer, {
        contentType: req.file.mimetype || 'audio/mpeg',
        upsert: true, // Allow overwrite if somehow filename still collides (shouldn't happen with timestamp)
      });

    if (uploadError) {
      // #region agent log
      dbgLog('transcriptionController.js:supabase-fail', 'Supabase upload failed', { error: uploadError.message }, 'H3');
      // #endregion
      console.error('Supabase upload error:', uploadError);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to upload audio to storage',
        error: uploadError.message
      });
    }

    // #region agent log
    dbgLog('transcriptionController.js:supabase-ok', 'Supabase upload OK', { filename }, 'H3');
    // #endregion
    console.log('Audio uploaded successfully:', filename);

    // Return just the filename (not full URL) - frontend will construct the URL
    // This allows for better handling of public vs private buckets
    const local_path = filename;

    // Check if OpenAI API key is configured
    if (!process.env.OPEN_AI_KEY) {
      console.error('OpenAI API key not configured');
      return res.status(500).json({
        status: 'error',
        message: 'OpenAI API key not configured'
      });
    }

    console.log('Sending to OpenAI Whisper API...');

    // Clean and validate API key
    const apiKey = (process.env.OPEN_AI_KEY || '').trim().replace(/[\r\n\t]/g, '');
    console.log('API key check:', {
      exists: !!apiKey,
      length: apiKey.length,
      prefix: apiKey.substring(0, 15),
      hasInvalidChars: /[\r\n\t\x00-\x1F\x7F-\xFF]/.test(apiKey)
    });

    if (!apiKey || apiKey.length < 20) {
      console.error('Invalid or missing API key!');
      return res.status(500).json({
        status: 'error',
        message: 'OpenAI API key configuration error',
        error: 'API key is invalid or not set'
      });
    }

    // #region agent log
    dbgLog('transcriptionController.js:pre-openai', 'Before OpenAI Whisper call', { hasApiKey: !!apiKey }, 'H4');
    // #endregion

    // Send to OpenAI Whisper
    const formData = new FormData();
    formData.append('file', req.file.buffer, {
      filename: req.file.originalname || 'audio.mp3',
      contentType: req.file.mimetype || 'audio/mpeg',
    });
    formData.append('model', 'whisper-1');

    const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${apiKey}`,
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    // #region agent log
    dbgLog('transcriptionController.js:openai-ok', 'OpenAI response received', { hasText: !!response?.data?.text }, 'H4');
    // #endregion
    console.log('OpenAI response received');

    const transcriptText = response.data.text;
    const language = response.data.language || null;
    const confidence = null;

    res.status(200).json({
      status: 'success',
      data: {
        transcript: transcriptText,
        local_path: local_path,
        file_size: req.file.size,
        language,
        confidence,
      },
    });
  } catch (err) {
    // #region agent log
    dbgLog('transcriptionController.js:catch', 'Transcribe error', { message: err.message, status: err.response?.status, code: err.code, hasResponse: !!err.response }, 'H1,H3,H4');
    // #endregion
    console.error('Transcription error:', err.message);
    console.error('Error stack:', err.stack);

    if (err.response) {
      console.error('OpenAI API error:', err.response.status, err.response.data);
      console.error('Request headers:', {
        hasAuth: !!err.config?.headers?.Authorization,
        authPrefix: err.config?.headers?.Authorization?.substring(0, 15)
      });

      return res.status(500).json({
        status: 'error',
        message: 'OpenAI transcription failed',
        error: err.response.data?.error?.message || err.response.statusText,
        details: process.env.NODE_ENV === 'production' ? undefined : {
          status: err.response.status,
          data: err.response.data
        }
      });
    }

    console.error('Non-response error. Has API key:', !!process.env.OPEN_AI_KEY);
    console.error('API key prefix:', process.env.OPEN_AI_KEY?.substring(0, 15) || 'NOT SET');

    res.status(500).json({
      status: 'error',
      message: 'Transcription failed',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
    });
  }
};
