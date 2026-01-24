const axios = require('axios');
const FormData = require('form-data');
const supabase = require('../services/supabaseClient');
const { v4: uuidv4 } = require('uuid');

// Upload to Supabase storage and proxy transcription to OpenAI
exports.transcribeAudio = async (req, res) => {
  try {
    console.log('🎙️ Transcription request started');
    console.log('Environment check:', {
      hasOpenAIKey: !!process.env.OPEN_AI_KEY,
      keyPrefix: process.env.OPEN_AI_KEY?.substring(0, 15) || 'NOT SET',
      nodeEnv: process.env.NODE_ENV,
      isVercel: !!process.env.VERCEL
    });

    if (!req.file) {
      return res.status(400).json({ status: 'fail', message: 'Audio file is required' });
    }

    console.log('Transcription request received:', {
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

    // Upload to Supabase Storage
    const fileExt = req.file.originalname?.split('.').pop() || 'mp3';
    const filename = `${uuidv4()}.${fileExt}`;
    // Sanitize bucket name - remove any whitespace or newlines
    const bucket = (process.env.SUPABASE_AUDIO_BUCKET || 'audio').trim().replace(/[\r\n\t]/g, '');

    console.log('Uploading to Supabase bucket:', bucket);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(`audio/${filename}`, req.file.buffer, {
        contentType: req.file.mimetype || 'audio/mpeg',
        upsert: false,
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to upload audio to storage',
        error: uploadError.message
      });
    }

    console.log('Audio uploaded successfully:', filename);

    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(`audio/${filename}`);
    const publicUrl = publicUrlData.publicUrl;

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
        local_path: publicUrl,
        file_size: req.file.size,
        language,
        confidence,
      },
    });
  } catch (err) {
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
