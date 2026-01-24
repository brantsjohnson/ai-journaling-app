const express = require('express');
const router = express.Router();
const authController = require('./../controllers/authController');

router.post('/signup', authController.signup); // Sign up new user
router.post('/login', authController.login); // Log in existing user
router.post('/forgot-password', authController.forgotPassword); // Request password reset
router.post('/reset-password', authController.resetPassword); // Reset password with token
router.post('/sync-supabase-user', authController.syncSupabaseUser); // Sync Supabase OAuth user to local database

module.exports = router;

