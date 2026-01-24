const db = require('./../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const supabase = require('../services/supabaseClient');

// Signup - Create new user
exports.signup = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({
        status: 'fail',
        message: 'Email, password, and name are required',
      });
    }

    const existingUserResult = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const existingUser = existingUserResult.rows[0];

    if (existingUser) {
      // Check if this is an old Auth0 user (no password_hash)
      if (!existingUser.password_hash) {
        // This is an old Auth0 user, they need to sign up again
        return res.status(400).json({
          status: 'fail',
          message: 'This email was used with the old authentication system. Please contact support or use a different email.',
        });
      }
      return res.status(400).json({
        status: 'fail',
        message: 'User with this email already exists',
      });
    }

    // Hash password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const insertResult = await db.query(
      'INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id, email, name',
      [email, name, password_hash]
    );
    const newUser = insertResult.rows[0];

    // Generate JWT token
    const token = jwt.sign(
      { userId: newUser.id, email: newUser.email },
      process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      status: 'success',
      data: {
        user: newUser,
        token,
      },
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};

// Login - Authenticate user
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: 'fail',
        message: 'Email and password are required',
      });
    }

    const userResult = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = userResult.rows[0];

    if (!user) {
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid email or password',
      });
    }

    // Check if user has password_hash (not an old Auth0 user)
    if (!user.password_hash) {
      return res.status(401).json({
        status: 'fail',
        message: 'This account was created with the old authentication system. Please sign up again.',
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid email or password',
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      { expiresIn: '7d' }
    );

    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
        token,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    console.error('Error details:', err.stack);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};

// Forgot Password - Generate reset token
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        status: 'fail',
        message: 'Email is required',
      });
    }

    const userResult = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = userResult.rows[0];

    if (!user) {
      // Don't reveal if user exists or not (security best practice)
      return res.status(200).json({
        status: 'success',
        message: 'If an account with that email exists, a password reset link has been sent.',
      });
    }

    // Generate reset token (random string)
    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Set expiration (1 hour from now)
    const resetTokenExpires = new Date();
    resetTokenExpires.setHours(resetTokenExpires.getHours() + 1);

    // Save reset token to database
    await db.query(
      'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE email = $3',
      [resetToken, resetTokenExpires.toISOString(), email]
    );

    // In production, you would send an email here with the reset link
    // For now, we'll return the token in development mode
    if (process.env.NODE_ENV === 'development') {
      const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
      console.log('Password reset link (DEV MODE):', resetLink);
      
      return res.status(200).json({
        status: 'success',
        message: 'If an account with that email exists, a password reset link has been sent.',
        // Only return token in development
        resetToken: resetToken,
        resetLink: resetLink,
      });
    }

    // In production, send email (you would use nodemailer or similar)
    // For MVP, we'll just return success
    res.status(200).json({
      status: 'success',
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};

// Reset Password - Update password with reset token
exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        status: 'fail',
        message: 'Token and password are required',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        status: 'fail',
        message: 'Password must be at least 6 characters long',
      });
    }

    // Find user by reset token
    const userResult = await db.query(
      'SELECT * FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()',
      [token]
    );
    const user = userResult.rows[0];

    if (!user) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid or expired reset token',
      });
    }

    // Hash new password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Update password and clear reset token
    await db.query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
      [password_hash, user.id]
    );

    res.status(200).json({
      status: 'success',
      message: 'Password has been reset successfully',
    });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};

// Sync Supabase OAuth user to local database
exports.syncSupabaseUser = async (req, res) => {
  try {
    const { supabaseUserId, email, name } = req.body;

    if (!supabaseUserId || !email) {
      return res.status(400).json({
        status: 'fail',
        message: 'Supabase user ID and email are required',
      });
    }

    // Check if user already exists in local database
    const existingUserResult = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    const existingUser = existingUserResult.rows[0];

    if (existingUser) {
      // User exists, return existing user
      return res.status(200).json({
        status: 'success',
        data: {
          user: {
            id: existingUser.id,
            email: existingUser.email,
            name: existingUser.name,
          },
        },
      });
    }

    // Create new user in local database (OAuth users don't have password_hash)
    const insertResult = await db.query(
      'INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id, email, name',
      [email, name || email.split('@')[0], 'oauth_user'] // Use placeholder for password_hash
    );
    const newUser = insertResult.rows[0];

    res.status(201).json({
      status: 'success',
      data: {
        user: newUser,
      },
    });
  } catch (err) {
    console.error('Sync Supabase user error:', err);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
};

