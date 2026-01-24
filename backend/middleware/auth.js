const jwt = require('jsonwebtoken');
const supabase = require('../services/supabaseClient');

// Middleware to verify JWT token (supports both custom JWT and Supabase JWT)
exports.authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: 'fail',
        message: 'No token provided',
      });
    }

    const token = authHeader.split(' ')[1];

    // Try to verify as Supabase token first
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (!error && user) {
        // This is a Supabase token
        req.user = {
          userId: user.id,
          email: user.email,
          supabaseUser: true, // Flag to indicate this is from Supabase
        };
        return next();
      }
    } catch (supabaseError) {
      // Not a Supabase token, try custom JWT
    }

    // Try to verify as custom JWT token
    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'your-secret-key-change-in-production'
      );
      req.user = decoded;
      return next();
    } catch (jwtError) {
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid or expired token',
      });
    }
  } catch (err) {
    return res.status(401).json({
      status: 'fail',
      message: 'Invalid or expired token',
    });
  }
};

