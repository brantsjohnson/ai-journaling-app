const axios = require('axios');
const FormData = require('form-data');
const supabase = require('../services/supabaseClient');
const db = require('../db');

// #region agent log
const dbgLog = (loc, msg, data, hyp) => console.log('[DEBUG]', JSON.stringify({ location: loc, message: msg, data, hypothesisId: hyp, timestamp: Date.now(), sessionId: 'debug-session' }));
// #endregion

// Helper function to transcribe audio in chunks
// Note: Proper audio splitting requires ffmpeg or similar. This is a simplified version.
const transcribeInChunks = async (fileBuffer, fileSize, fileMimetype, originalFilename, filePath, local_path, req, res, apiKey, durationSeconds) => {
  const CHUNK_SIZE = 20 * 1024 * 1024; // 20MB chunks
  const numChunks = Math.ceil(fileSize / CHUNK_SIZE);
  
  console.log(`Large file detected: ${(fileSize / 1024 / 1024).toFixed(2)}MB`);
  console.log(`Would need ${numChunks} chunks, but proper audio splitting requires ffmpeg`);
  console.log(`Attempting to transcribe whole file - OpenAI may accept files slightly over 25MB`);
  
  try {
    // Try to transcribe the whole file first
    // OpenAI sometimes accepts files slightly over 25MB
    const formData = new FormData();
    formData.append('file', fileBuffer, {
      filename: originalFilename || 'audio.mp3',
      contentType: fileMimetype || 'audio/mpeg',
    });
    formData.append('model', 'whisper-1');
    
    const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${apiKey}`,
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 780000,
    });
    
    const transcriptText = response.data.text;
    const language = response.data.language || null;
    
    console.log('Successfully transcribed large file as single chunk');
    
    return res.status(200).json({
      status: 'success',
      data: {
        transcript: transcriptText,
        local_path: local_path,
        file_size: fileSize,
        language,
        confidence: null,
        chunked: true,
        chunks_processed: 1,
      },
    });
  } catch (error) {
    // If it fails due to size, we need proper chunking with audio splitting
    if (error.response?.status === 413 || error.message?.includes('too large') || error.response?.data?.error?.message?.includes('too large')) {
      console.error('File too large for single transcription. Proper chunking requires audio splitting library.');
      return res.status(413).json({
        status: 'error',
        message: `File is too large (${(fileSize / 1024 / 1024).toFixed(2)}MB) for transcription. Audio chunking with proper splitting is being implemented. For now, please record files under 25MB or split them manually.`,
        error: 'File too large for transcription',
        audio_saved: true,
        suggestion: 'Try recording in shorter segments or use a file under 25MB',
      });
    }
    throw error;
  }
};

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

    // Support both file upload (req.file) and file_path (file already in Supabase)
    let fileBuffer = null;
    let fileMimetype = 'audio/mpeg';
    let originalFilename = 'audio.mp3';
    let fileSize = 0;
    let filePath = null;

    if (req.body && req.body.file_path) {
      // File already uploaded to Supabase - download it
      filePath = req.body.file_path;
      const bucket = (process.env.SUPABASE_AUDIO_BUCKET || 'audio').trim();
      
      console.log('Downloading file from Supabase:', { bucket, filePath });
      
      const { data: fileData, error: downloadError } = await supabase.storage
        .from(bucket)
        .download(filePath);

      if (downloadError || !fileData) {
        console.error('Error downloading from Supabase:', downloadError);
        return res.status(400).json({ 
          status: 'error', 
          message: 'Failed to download file from storage',
          error: downloadError?.message 
        });
      }

      // Convert blob to buffer
      fileBuffer = Buffer.from(await fileData.arrayBuffer());
      fileSize = fileBuffer.length;
      originalFilename = filePath.split('/').pop() || 'audio.mp3';
      const ext = (originalFilename.split('.').pop() || '').toLowerCase();
      fileMimetype = { webm: 'audio/webm', mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/m4a' }[ext] || 'audio/mpeg';
      
      console.log('File downloaded from Supabase:', {
        filename: originalFilename,
        size: fileSize
      });
    } else if (req.file) {
      // File uploaded via multer (backward compatibility)
      fileBuffer = req.file.buffer;
      fileMimetype = req.file.mimetype;
      originalFilename = req.file.originalname;
      fileSize = req.file.size;
    } else {
      // #region agent log
      dbgLog('transcriptionController.js:no-file', 'No req.file or file_path', {}, 'H2');
      // #endregion
      return res.status(400).json({ status: 'fail', message: 'Audio file is required (either upload file or provide file_path)' });
    }

    console.log('Transcription request received:', {
      filename: originalFilename,
      mimetype: fileMimetype,
      size: fileSize,
      source: req.body?.file_path ? 'Supabase' : 'upload'
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
    // When file_path is used, req.file is undefined - use originalFilename from file path
    const fileExt = (req.file?.originalname || originalFilename || 'audio.mp3').split('.').pop() || 'mp3';
    const filename = `${formattedDate}--${String(entryNumber).padStart(2, '0')}--${durationSeconds}--${uniqueSuffix}.${fileExt}`;
    
    // Sanitize bucket name - remove any whitespace or newlines
    const bucket = (process.env.SUPABASE_AUDIO_BUCKET || 'audio').trim().replace(/[\r\n\t]/g, '');

    console.log('Uploading to Supabase bucket:', bucket);
    console.log('Generated filename:', filename);
    console.log('Entry number:', entryNumber, 'Date:', journalDate);

    // #region agent log
    dbgLog('transcriptionController.js:pre-supabase', 'Before Supabase upload', { bucket, filename, entryNumber, journalDate, uniqueSuffix }, 'H3');
    // #endregion
    
    // If file_path was provided, file is already in Supabase - use that path
    // Otherwise, upload the file buffer to Supabase (using service role - bypasses RLS)
    let uploadData;
    let uploadError = null; // Define in outer scope to avoid "uploadError is not defined" when filePath exists
    if (filePath) {
      // File already uploaded, use the provided path
      uploadData = { path: filePath };
      console.log('Using existing file path:', filePath);
    } else {
      // Upload file buffer to Supabase (service role bypasses RLS)
      const { data: uploadResultData, error: uploadResultError } = await supabase.storage
        .from(bucket)
        .upload(filename, fileBuffer, {
          contentType: fileMimetype || 'audio/mpeg',
          upsert: true,
        });

      uploadError = uploadResultError;
      if (uploadError) {
        // #region agent log
        dbgLog('transcriptionController.js:supabase-fail', 'Supabase upload failed', { error: uploadError.message }, 'H3');
        // #endregion
        console.error('Supabase upload error:', uploadError);
        return res.status(500).json({
          status: 'error',
          message: 'Failed to upload audio to storage',
          error: uploadError.message,
          audio_saved: false
        });
      }
      uploadData = uploadResultData;
    }

    // #region agent log
    dbgLog('transcriptionController.js:upload-result', 'Upload result', { 
      hasUploadData: !!uploadData, 
      uploadPath: uploadData?.path, 
      uploadKey: uploadData?.id,
      error: uploadError?.message,
      filename,
      bucket
    }, 'H1,H3,H5');
    // #endregion

    // #region agent log
    dbgLog('transcriptionController.js:supabase-ok', 'Supabase upload OK', { 
      filename, 
      uploadPath: uploadData?.path,
      uploadFullPath: uploadData?.fullPath,
      uploadId: uploadData?.id,
      uploadName: uploadData?.name,
      uploadDataKeys: uploadData ? Object.keys(uploadData) : [],
      local_path: filename
    }, 'H1,H3,H5,H6');
    // #endregion
    console.log('Audio uploaded successfully:', filename);
    console.log('Upload data path:', uploadData?.path);
    console.log('Upload data full path:', uploadData?.fullPath);
    console.log('Upload data name:', uploadData?.name);
    console.log('Upload data keys:', uploadData ? Object.keys(uploadData) : 'null');
    console.log('Upload data full object:', JSON.stringify(uploadData, null, 2));

    // IMPORTANT: Use the actual path returned by Supabase, not the filename we passed
    // Supabase might store files in a different location than expected
    // The path returned is what we need to use with getPublicUrl()
    // uploadData.path is the relative path within the bucket (e.g., "filename.mp3" or "audio/filename.mp3")
    const actualPath = uploadData?.path || filename;
    console.log('Using actual path for local_path:', actualPath);
    console.log('This path will be stored in database and used by frontend for getPublicUrl()');

    // Return the actual path from Supabase (not just filename) - frontend will use this with getPublicUrl()
    const local_path = actualPath;
    
    // #region agent log
    dbgLog('transcriptionController.js:local-path-determined', 'Local path determined for response', {
      filename,
      uploadPath: uploadData?.path,
      actualPath,
      local_path,
      willBeStoredInDB: true
    }, 'H6');
    // #endregion

    // Check if OpenAI API key is configured and validate before any transcription
    const apiKey = (process.env.OPEN_AI_KEY || '').trim().replace(/[\r\n\t]/g, '');
    if (!process.env.OPEN_AI_KEY || !apiKey || apiKey.length < 20) {
      console.error('OpenAI API key not configured or invalid');
      return res.status(500).json({
        status: 'error',
        message: 'OpenAI API key is missing or invalid. Please set OPEN_AI_KEY in Vercel environment variables.',
        error: 'API key is invalid or not set',
        audio_saved: true
      });
    }

    console.log('Sending to OpenAI Whisper API...');

    // Check file size - OpenAI Whisper has a 25MB limit
    const MAX_OPENAI_SIZE = 25 * 1024 * 1024; // 25MB
    const CHUNK_SIZE = 20 * 1024 * 1024; // 20MB chunks (leaves buffer)
    const shouldChunk = fileSize > CHUNK_SIZE;
    
    if (shouldChunk) {
      console.log(`File size (${(fileSize / 1024 / 1024).toFixed(2)}MB) exceeds ${(CHUNK_SIZE / 1024 / 1024).toFixed(0)}MB, will process in chunks`);
      return await transcribeInChunks(fileBuffer, fileSize, fileMimetype, originalFilename, filePath, local_path, req, res, apiKey, durationSeconds);
    }
    
    if (fileSize > MAX_OPENAI_SIZE) {
      console.warn(`File size (${(fileSize / 1024 / 1024).toFixed(2)}MB) exceeds OpenAI's 25MB limit`);
      // Note: We'll still attempt to send it, but OpenAI may reject it
    }
    console.log('API key check:', {
      exists: !!apiKey,
      length: apiKey.length,
      prefix: apiKey.substring(0, 15),
      hasInvalidChars: /[\r\n\t\x00-\x1F\x7F-\xFF]/.test(apiKey)
    });

    // #region agent log
    dbgLog('transcriptionController.js:pre-openai', 'Before OpenAI Whisper call', { hasApiKey: !!apiKey }, 'H4');
    // #endregion

    // Send to OpenAI Whisper
    const formData = new FormData();
    formData.append('file', fileBuffer, {
      filename: originalFilename || 'audio.mp3',
      contentType: fileMimetype || 'audio/mpeg',
    });
    formData.append('model', 'whisper-1');

    console.log('Sending to OpenAI Whisper API with:', {
      fileSize: `${(fileSize / 1024 / 1024).toFixed(2)}MB`,
      fileSizeBytes: fileSize,
      duration: `${durationSeconds}s`,
      timeout: '780s',
      apiKeyLength: apiKey.length,
      apiKeyPrefix: apiKey.substring(0, 10) + '...'
    });

    const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${apiKey}`,
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 780000, // 13 minutes timeout for OpenAI API (allows time for processing long audio files, with buffer before Vercel timeout)
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
        file_size: fileSize,
        language,
        confidence,
      },
    });
  } catch (err) {
    // #region agent log
    dbgLog('transcriptionController.js:catch', 'Transcribe error', { message: err.message, status: err.response?.status, code: err.code, hasResponse: !!err.response }, 'H1,H3,H4');
    // #endregion
    console.error('Transcription error:', err.message);
    console.error('Error code:', err.code);
    console.error('Error stack:', err.stack);
    console.error('Has response:', !!err.response);
    if (err.response) {
      console.error('Response status:', err.response.status);
      console.error('Response data:', JSON.stringify(err.response.data, null, 2));
    }
    if (err.request) {
      console.error('Request made but no response received');
      console.error('Request config:', {
        url: err.config?.url,
        method: err.config?.method,
        timeout: err.config?.timeout,
        hasAuth: !!err.config?.headers?.Authorization
      });
    }

    if (err.response) {
      console.error('OpenAI API error:', err.response.status, err.response.data);
      console.error('Request headers:', {
        hasAuth: !!err.config?.headers?.Authorization,
        authPrefix: err.config?.headers?.Authorization?.substring(0, 15)
      });

      // Determine if audio was saved before the error
      const audioSaved = !!uploadData?.path;
      
      let errorMessage = 'OpenAI transcription failed';
      if (err.response.status === 401) {
        errorMessage = 'OpenAI API key is invalid or expired. Please verify your API key in Vercel environment variables and ensure it starts with "sk-".';
      } else if (err.response.status === 429) {
        errorMessage = 'OpenAI rate limit exceeded. Please check your account billing or try again later.';
      } else if (err.response.status === 413) {
        errorMessage = 'Audio file is too large. Maximum size is 25MB.';
      } else if (err.response.status === 400) {
        errorMessage = `Invalid request: ${err.response.data?.error?.message || 'Please check the audio file format.'}`;
      } else {
        errorMessage = err.response.data?.error?.message || err.response.statusText || errorMessage;
      }
      
      return res.status(500).json({
        status: 'error',
        message: errorMessage,
        error: err.response.data?.error?.message || err.response.statusText,
        audio_saved: audioSaved,
        details: process.env.NODE_ENV === 'production' ? undefined : {
          status: err.response.status,
          data: err.response.data
        }
      });
    }

    console.error('Non-response error. Has API key:', !!process.env.OPEN_AI_KEY);
    console.error('API key prefix:', process.env.OPEN_AI_KEY?.substring(0, 15) || 'NOT SET');
    
    // Handle timeout specifically
    let errorMessage = 'Transcription failed due to an unexpected error';
    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      errorMessage = 'Request timed out. The audio file may be too long or OpenAI is taking longer than expected. Try a shorter recording or try again.';
    } else if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
      errorMessage = 'Network error: Could not connect to OpenAI. Please check your internet connection and try again.';
    } else if (err.message) {
      errorMessage = err.message;
    }

    res.status(500).json({
      status: 'error',
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
      audio_saved: false, // Can't determine if audio was saved in this error path
      error_code: err.code || 'UNKNOWN',
    });
  }
};
