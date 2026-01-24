const axios = require('axios');
const FormData = require('form-data');
const supabase = require('../services/supabaseClient');
const db = require('../db');

// Upload to Supabase storage and proxy transcription to OpenAI
exports.transcribeAudio = async (req, res) => {
  try {
    console.log('🎙️ Transcription request started');
    
    // Validate required environment variables upfront
    const requiredEnvVars = {
      OPEN_AI_KEY: process.env.OPEN_AI_KEY,
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    };
    
    const missingVars = Object.entries(requiredEnvVars)
      .filter(([key, value]) => !value || (typeof value === 'string' && value.trim().length === 0))
      .map(([key]) => key);
    
    if (missingVars.length > 0) {
      console.error('❌ Missing required environment variables:', missingVars);
      return res.status(500).json({
        status: 'error',
        message: `Missing required configuration: ${missingVars.join(', ')}`,
        error: 'Configuration error'
      });
    }
    
    console.log('Environment check:', {
      hasOpenAIKey: !!process.env.OPEN_AI_KEY,
      keyPrefix: process.env.OPEN_AI_KEY?.substring(0, 15) || 'NOT SET',
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      nodeEnv: process.env.NODE_ENV,
      isVercel: !!process.env.VERCEL
    });

    if (!req.file) {
      return res.status(400).json({ status: 'fail', message: 'Audio file is required' });
    }

    // Get user ID from authenticated request
    let userId;
    try {
      if (req.user?.supabaseUser) {
        const email = req.user.email;
        if (!email) {
          return res.status(400).json({
            status: 'fail',
            message: 'User email not found in authentication token'
          });
        }
        const userResult = await db.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userResult.rows && userResult.rows[0]) {
          userId = userResult.rows[0].id;
        } else {
          return res.status(404).json({
            status: 'fail',
            message: 'User not found in local database. Please sync your account first.'
          });
        }
      } else {
        userId = req.user?.userId;
      }

      userId = parseInt(userId, 10);
      if (isNaN(userId) || userId <= 0) {
        return res.status(400).json({
          status: 'fail',
          message: 'Invalid user ID'
        });
      }
    } catch (dbError) {
      console.error('Database error while fetching user:', dbError);
      return res.status(500).json({
        status: 'error',
        message: 'Database error while fetching user information',
        error: dbError.message
      });
    }

    // Get journal_date from request body (sent from frontend)
    const journal_date = req.body.journal_date || new Date().toISOString().split('T')[0];
    
    // Format date as MM-DD-YYYY
    // Parse the date string directly to avoid timezone issues
    // journal_date is in format YYYY-MM-DD
    const dateParts = journal_date.split('-');
    if (dateParts.length !== 3) {
      console.error('Invalid journal_date format:', journal_date);
      return res.status(400).json({
        status: 'error',
        message: 'Invalid date format. Expected YYYY-MM-DD'
      });
    }
    
    const year = dateParts[0];
    const month = dateParts[1]; // Already in MM format
    const day = dateParts[2]; // Already in DD format
    const formattedDate = `${month}-${day}-${year}`;
    
    console.log('Date formatting:', {
      journal_date,
      year,
      month,
      day,
      formattedDate
    });

    // Get total entry count for user
    let totalEntryCount = 1;
    let dayEntryNumber = 1;
    try {
      const totalCountResult = await db.query(
        'SELECT COUNT(*) as count FROM entries WHERE user_id = $1',
        [userId]
      );
      totalEntryCount = parseInt(totalCountResult.rows[0]?.count || 0, 10) + 1; // +1 because we're about to create this entry

      // Get entry count for this specific date
      const dateCountResult = await db.query(
        'SELECT COUNT(*) as count FROM entries WHERE user_id = $1 AND journal_date = $2',
        [userId, journal_date]
      );
      dayEntryNumber = parseInt(dateCountResult.rows[0]?.count || 0, 10) + 1; // +1 because we're about to create this entry
    } catch (dbError) {
      console.error('Database error while counting entries:', dbError);
      // Continue with default values (1, 1) if count fails - not critical
      console.warn('Using default entry numbers due to count error');
    }

    // Generate filename: MM-DD-YYYY--entry#--total#.mp3
    const fileExt = req.file.originalname?.split('.').pop() || 'mp3';
    const filename = `${formattedDate}--${String(dayEntryNumber).padStart(2, '0')}--${String(totalEntryCount).padStart(3, '0')}.${fileExt}`;

    console.log('Transcription request received:', {
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      userId,
      journal_date,
      generatedFilename: filename
    });

    // Sanitize bucket name - remove any whitespace or newlines
    const bucket = (process.env.SUPABASE_AUDIO_BUCKET || 'audio').trim().replace(/[\r\n\t]/g, '');

    console.log('Uploading to Supabase bucket:', bucket, 'with filename:', filename);

    // Upload directly to bucket root (no nested folders)
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filename, req.file.buffer, {
        contentType: req.file.mimetype || 'audio/mpeg',
        upsert: false,
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      console.error('Upload error details:', JSON.stringify(uploadError, null, 2));
      return res.status(500).json({
        status: 'error',
        message: 'Failed to upload audio to storage',
        error: uploadError.message
      });
    }

    // Supabase returns the path in uploadData.path - use it exactly as returned
    // This is the path relative to the bucket root
    const actualPath = uploadData?.path || filename;
    
    if (!uploadData || !uploadData.path) {
      console.error('CRITICAL: Upload succeeded but no path returned!', uploadData);
      return res.status(500).json({
        status: 'error',
        message: 'Upload succeeded but no file path returned',
        error: 'Invalid upload response'
      });
    }

    console.log('Audio uploaded successfully:', {
      requestedFilename: filename,
      actualPath: actualPath,
      uploadData: uploadData
    });

    // Store the exact path returned by Supabase (this is what we need to use for signed URLs)
    // Remove any leading slashes but keep the rest as-is
    let filePath = actualPath.replace(/^\/+/, '');
    
    // Verify file exists immediately after upload by trying to get its info
    const { data: verifyData, error: verifyError } = await supabase.storage
      .from(bucket)
      .list('', { limit: 1, search: filename });
    
    if (verifyError) {
      console.warn('Could not verify file after upload:', verifyError);
    } else {
      const fileExists = verifyData?.some(f => f.name === filename || f.name === filePath);
      console.log('Post-upload verification:', {
        filename,
        filePath,
        exists: fileExists,
        filesFound: verifyData?.length || 0,
        fileNames: verifyData?.map(f => f.name) || []
      });
      
      if (!fileExists && verifyData && verifyData.length > 0) {
        console.error('WARNING: File not found with expected name. Available files:', verifyData.map(f => f.name));
      }
    }
    
    console.log('Storing file path in database:', filePath);

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

    console.log('OpenAI response received');

    const transcriptText = response.data.text;
    const language = response.data.language || null;
    const confidence = null;

    res.status(200).json({
      status: 'success',
      data: {
        transcript: transcriptText,
        local_path: filePath, // Store filename only for private bucket
        file_size: req.file.size,
        language,
        confidence,
      },
    });
  } catch (err) {
    console.error('❌ Transcription error:', err.message);
    console.error('Error stack:', err.stack);
    console.error('Error type:', err.constructor.name);
    console.error('Error details:', {
      code: err.code,
      errno: err.errno,
      syscall: err.syscall,
      address: err.address,
      port: err.port
    });

    // Handle database errors
    if (err.code && (err.code.startsWith('ECONNREFUSED') || err.code.startsWith('ENOTFOUND') || err.code === '42P01')) {
      console.error('Database connection error detected');
      return res.status(500).json({
        status: 'error',
        message: 'Database connection failed. Please check your database configuration.',
        error: 'Database error'
      });
    }

    // Handle Supabase errors
    if (err.message && err.message.includes('Supabase')) {
      console.error('Supabase error detected');
      return res.status(500).json({
        status: 'error',
        message: 'Storage service error. Please check your Supabase configuration.',
        error: err.message
      });
    }

    // Handle OpenAI API errors
    if (err.response) {
      console.error('OpenAI API error:', err.response.status, err.response.data);
      console.error('Request headers:', {
        hasAuth: !!err.config?.headers?.Authorization,
        authPrefix: err.config?.headers?.Authorization?.substring(0, 15)
      });

      const errorMessage = err.response.data?.error?.message || err.response.statusText || 'OpenAI transcription failed';
      
      return res.status(500).json({
        status: 'error',
        message: errorMessage,
        error: errorMessage,
        details: process.env.NODE_ENV === 'production' ? undefined : {
          status: err.response.status,
          data: err.response.data
        }
      });
    }

    // Handle axios errors (network issues)
    if (err.isAxiosError) {
      console.error('Axios error detected:', err.message);
      return res.status(500).json({
        status: 'error',
        message: 'Network error while connecting to transcription service',
        error: err.message
      });
    }

    console.error('Non-response error. Has API key:', !!process.env.OPEN_AI_KEY);
    console.error('API key prefix:', process.env.OPEN_AI_KEY?.substring(0, 15) || 'NOT SET');

    // Generic error handler
    const errorMessage = process.env.NODE_ENV === 'development' || process.env.VERCEL ? err.message : 'Internal server error';
    
    return res.status(500).json({
      status: 'error',
      message: errorMessage,
      error: errorMessage,
    });
  }
};

