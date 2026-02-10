const express = require('express');
const router = express.Router();
const authController = require('./../controllers/authController');

// Health check endpoint - helps debug deployment issues
router.get('/health', (req, res) => {
  const healthCheck = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: {
      nodeEnv: process.env.NODE_ENV,
      hasJwtSecret: !!process.env.JWT_SECRET,
      jwtSecretLength: process.env.JWT_SECRET?.length || 0,
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasSupabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasSupabaseAnonKey: !!process.env.SUPABASE_ANON_KEY,
      hasOpenAiKey: !!process.env.OPEN_AI_KEY,
      supabaseUrl: process.env.SUPABASE_URL?.substring(0, 30) + '...' || 'not set',
    },
    server: {
      platform: process.platform,
      nodeVersion: process.version,
      uptime: process.uptime(),
    }
  };
  
  console.log('[HEALTH] Health check called:', healthCheck);
  res.status(200).json(healthCheck);
});

router.post('/signup', authController.signup); // Sign up new user
router.post('/login', authController.login); // Log in existing user
router.post('/forgot-password', authController.forgotPassword); // Request password reset
router.post('/reset-password', authController.resetPassword); // Reset password with token
router.post('/sync-supabase-user', authController.syncSupabaseUser); // Sync Supabase OAuth user to local database

module.exports = router;

