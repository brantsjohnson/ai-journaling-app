const jwt = require('jsonwebtoken');
const supabase = require('../services/supabaseClient');

// Middleware to verify JWT token (supports both custom JWT and Supabase JWT)
exports.authenticate = async (req, res, next) => {
  // #region agent log
  const dbgLog = (loc, msg, data, hyp) => console.log('[DEBUG]', JSON.stringify({ location: loc, message: msg, data, hypothesisId: hyp, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1' }));
  dbgLog('auth.js:authenticate:entry', 'Auth middleware entered', { method: req.method, url: req.url, hasAuthHeader: !!req.headers.authorization, authHeaderPrefix: req.headers.authorization?.substring(0, 20) }, 'H6');
  // #endregion
  
  try {
    const authHeader = req.headers.authorization;

    // #region agent log
    dbgLog('auth.js:authenticate:check-header', 'Checking auth header', { hasAuthHeader: !!authHeader, startsWithBearer: authHeader?.startsWith('Bearer '), headerLength: authHeader?.length }, 'H6');
    // #endregion

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // #region agent log
      dbgLog('auth.js:authenticate:no-token', 'No valid auth header', { hasAuthHeader: !!authHeader, startsWithBearer: authHeader?.startsWith('Bearer ') }, 'H6');
      // #endregion
      return res.status(401).json({
        status: 'fail',
        message: 'No token provided',
      });
    }

    const token = authHeader.split(' ')[1];
    
    // #region agent log
    dbgLog('auth.js:authenticate:token-extracted', 'Token extracted', { tokenLength: token?.length, tokenPrefix: token?.substring(0, 20) }, 'H6');
    // #endregion

    // Try to verify as Supabase token first
    try {
      // #region agent log
      dbgLog('auth.js:authenticate:try-supabase', 'Trying Supabase auth', { tokenLength: token?.length }, 'H6');
      // #endregion
      
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      // #region agent log
      dbgLog('auth.js:authenticate:supabase-result', 'Supabase auth result', { hasUser: !!user, hasError: !!error, errorMessage: error?.message, userId: user?.id, userEmail: user?.email }, 'H6');
      // #endregion
      
      if (!error && user) {
        // This is a Supabase token
        req.user = {
          userId: user.id,
          email: user.email,
          supabaseUser: true, // Flag to indicate this is from Supabase
        };
        
        // #region agent log
        dbgLog('auth.js:authenticate:supabase-success', 'Supabase auth success', { userId: req.user.userId, email: req.user.email }, 'H6');
        // #endregion
        
        return next();
      }
    } catch (supabaseError) {
      // #region agent log
      dbgLog('auth.js:authenticate:supabase-error', 'Supabase auth error', { errorMessage: supabaseError?.message, errorName: supabaseError?.name }, 'H6');
      // #endregion
      // Not a Supabase token, try custom JWT
    }

    // Try to verify as custom JWT token
    try {
      // #region agent log
      dbgLog('auth.js:authenticate:try-jwt', 'Trying JWT auth', { hasJwtSecret: !!process.env.JWT_SECRET }, 'H6');
      // #endregion
      
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'your-secret-key-change-in-production'
      );
      
      // #region agent log
      dbgLog('auth.js:authenticate:jwt-success', 'JWT auth success', { userId: decoded?.userId, email: decoded?.email, decodedKeys: Object.keys(decoded) }, 'H6');
      // #endregion
      
      req.user = decoded;
      return next();
    } catch (jwtError) {
      // #region agent log
      dbgLog('auth.js:authenticate:jwt-error', 'JWT auth error', { errorMessage: jwtError?.message, errorName: jwtError?.name }, 'H6');
      // #endregion
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid or expired token',
      });
    }
  } catch (err) {
    // #region agent log
    dbgLog('auth.js:authenticate:catch', 'Auth middleware catch', { errorMessage: err?.message, errorName: err?.name, errorStack: err?.stack?.slice(0, 300) }, 'H6');
    // #endregion
    return res.status(401).json({
      status: 'fail',
      message: 'Invalid or expired token',
    });
  }
};

