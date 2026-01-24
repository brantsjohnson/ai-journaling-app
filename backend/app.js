// Load environment variables FIRST, before any other requires
// In Vercel, environment variables are injected automatically
// This is only needed for local development
if (!process.env.VERCEL) {
  const dotenv = require('dotenv');
  // Try config.env first, fallback to .env
  const result = dotenv.config({ path: './config.env' });
  if (result.error) {
    dotenv.config({ path: './.env' });
  }
}

const express = require('express');
const cors = require('cors');
const app = express();
const entryRouter = require('./routes/entryRoutes');
const userRouter = require('./routes/userRoutes');
const authRouter = require('./routes/authRoutes');
const transcriptionRouter = require('./routes/transcriptionRoutes');
const transcriptRouter = require('./routes/transcriptRoutes');

// CORS configuration to allow requests from Vercel frontend and localhost
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // List of allowed origins
    const allowedOrigins = [
      'https://ai-journaling-app-main.vercel.app',
      'https://frontend-mu-wheat-65.vercel.app',
      'https://frontend-a0ydnbxlv-zunnoonwaheed-gmailcoms-projects.vercel.app',
      'http://localhost:5173',
    ];
    
    // Check if origin is in allowed list or is a Vercel preview deployment
    if (allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Explicit OPTIONS handler for all routes
app.options('*', cors(corsOptions));

app.use(express.json());

// Add request logging middleware for debugging
app.use((req, res, next) => {
  console.log(`[Express] ${req.method} ${req.url}`);
  next();
});

// Auth routes (signup/login) - no authentication required
// Mount BEFORE other /api/journal-ease routes to ensure proper matching
app.use('/api/journal-ease/auth', authRouter);

// Transcription route - no authentication required (or add if needed)
app.use('/api/journal-ease', transcriptionRouter);

// Protected routes - require authentication
app.use('/api/journal-ease', entryRouter);
app.use('/api/journal-ease', userRouter);
app.use('/api/journal-ease', transcriptRouter);


module.exports = app; 

