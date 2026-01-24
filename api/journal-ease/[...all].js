// Catch-all route for all API endpoints
// Lazy-load backend app inside handler to catch require errors and provide better diagnostics
const path = require('path');
const fs = require('fs');

let app = null;
let appLoadError = null;

// Try to load backend app at module level, but don't fail if it doesn't work
try {
  const backendAppPath = path.join(__dirname, '..', '..', 'backend', 'app');
  console.log('[DEBUG] Attempting to require backend app from:', backendAppPath);
  console.log('[DEBUG] __dirname:', __dirname);
  console.log('[DEBUG] Backend app exists?', fs.existsSync(backendAppPath + '.js'));
  app = require(backendAppPath);
  console.log('[DEBUG] Backend app loaded successfully');
} catch (err) {
  appLoadError = err;
  console.error('[DEBUG] Failed to load backend app:', err.message);
  console.error('[DEBUG] Error stack:', err.stack);
}

// Helper function to set CORS headers
function setCorsHeaders(res, origin) {
  const allowedOrigins = [
    'https://ai-journaling-app-main.vercel.app',
    'http://localhost:5173',
  ];
  
  // Check if origin is allowed
  const isAllowed = !origin || 
                    origin === '*' ||
                    allowedOrigins.includes(origin) || 
                    (typeof origin === 'string' && origin.endsWith('.vercel.app'));
  
  if (isAllowed) {
    const corsOrigin = origin && origin !== '*' ? origin : '*';
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
    return true;
  }
  return false;
}

// Export as Vercel serverless function handler
module.exports = async (req, res) => {
  // #region agent log
  const DEBUG_INGEST = 'http://127.0.0.1:7242/ingest/763f5855-a7cf-4b2d-abed-e04d96151c45';
  const dbg = (payload) => {
    fetch(DEBUG_INGEST, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1' }) }).catch(() => {});
  };
  const dbgLog = (loc, msg, data, hyp) => console.log('[DEBUG]', JSON.stringify({ location: loc, message: msg, data, hypothesisId: hyp, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1' }));
  
  dbg({ location: 'api-catchall:entry', message: 'Main catch-all invoked', data: { method: req.method, url: req.url, originalUrl: req.originalUrl, path: req.path, isUsersRoute: req.url?.includes('/users/') || req.path?.includes('/users/'), isEntriesRoute: req.url?.includes('/entries') || req.path?.includes('/entries'), headers: Object.keys(req.headers), hasAuth: !!req.headers.authorization }, hypothesisId: 'H1,H2' });
  dbgLog('api-catchall:entry', 'Main catch-all invoked', { method: req.method, url: req.url, isUsersRoute: req.url?.includes('/users/'), isEntriesRoute: req.url?.includes('/entries') }, 'H1,H2');
  // #endregion
  
  console.log('🚀 Catch-all function invoked');
  console.log('📍 Method:', req.method);
  console.log('📍 URL:', req.url);
  
  // Extract origin
  let origin = req.headers.origin || '*';
  
  // Handle OPTIONS
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res, origin);
    return res.status(204).end();
  }
  
  // Vercel passes the path segments after /api/journal-ease
  // For /api/journal-ease/users/4/entries, req.url will be /users/4/entries
  let requestPath = req.url || '/';
  
  // #region agent log
  dbgLog('api-catchall:path-reconstruction', 'Reconstructing path', { originalUrl: req.url, originalPath: req.path, requestPath }, 'H1,H2');
  // #endregion
  
  // Reconstruct full path for Express
  if (!requestPath.startsWith('/api/journal-ease')) {
    if (!requestPath.startsWith('/')) {
      requestPath = '/' + requestPath;
    }
    requestPath = '/api/journal-ease' + requestPath;
  }
  
  // #region agent log
  dbg({ location: 'api-catchall:pre-express', message: 'About to call Express app', data: { method: req.method, path: requestPath, originalUrl: req.url, isTranscribe: requestPath.includes('/transcribe'), isUsersRoute: requestPath.includes('/users/'), isEntriesRoute: requestPath.includes('/entries'), willCallExpress: true }, hypothesisId: 'H1,H2' });
  dbgLog('api-catchall:pre-express', 'About to call Express app', { requestPath, isUsersRoute: requestPath.includes('/users/'), isEntriesRoute: requestPath.includes('/entries') }, 'H1,H2');
  // #endregion
  
  console.log('📍 Final path for Express:', requestPath);
  console.log('[DEBUG]', JSON.stringify({ location: 'api-catchall:pre-express', message: 'About to call Express app', data: { method: req.method, path: requestPath, isTranscribe: requestPath.includes('/transcribe') }, hypothesisId: 'H1', timestamp: Date.now(), sessionId: 'debug-session' }));

  // Update request for Express
  req.url = requestPath;
  req.originalUrl = requestPath;
  
  // Set CORS
  setCorsHeaders(res, origin);
  
  // If backend app failed to load, return detailed error
  if (!app) {
    const backendAppPath = path.join(__dirname, '..', '..', 'backend', 'app');
    const errorDetails = {
      message: 'Backend app module not loaded',
      requirePath: backendAppPath,
      __dirname: __dirname,
      error: appLoadError?.message || 'Unknown error',
      stack: appLoadError?.stack || 'No stack trace',
      filesInParent: fs.existsSync(path.join(__dirname, '..')) ? fs.readdirSync(path.join(__dirname, '..')).slice(0, 10) : 'parent dir not found',
      filesInRoot: fs.existsSync(path.join(__dirname, '..', '..')) ? fs.readdirSync(path.join(__dirname, '..', '..')).slice(0, 10) : 'root dir not found',
    };
    console.error('[DEBUG] Backend app not loaded. Details:', JSON.stringify(errorDetails, null, 2));
    if (!res.headersSent) {
      setCorsHeaders(res, origin);
      return res.status(500).json({
        status: 'error',
        message: 'Backend module not found',
        error: appLoadError?.message || 'Cannot load backend/app',
        details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
      });
    }
    return;
  }
  
  // Pass to Express
  try {
    // #region agent log
    dbgLog('api-catchall:call-express', 'Calling Express app', { requestPath, method: req.method }, 'H1,H2');
    // #endregion
    const result = app(req, res);
    // #region agent log
    dbgLog('api-catchall:express-returned', 'Express app returned', { hasResult: !!result, resultType: typeof result }, 'H1,H2');
    // #endregion
    return result;
  } catch (error) {
    // #region agent log
    dbgLog('api-catchall:express-threw', 'Express app threw', { errorMessage: error?.message, errorStack: error?.stack?.slice(0, 500) }, 'H1,H2');
    // #endregion
    console.error('❌ Error in Express app:', error);
    console.log('[DEBUG]', JSON.stringify({ location: 'api-catchall:express-threw', message: 'Express app threw', data: { errorMessage: error?.message, stack: error?.stack?.slice(0, 200) }, hypothesisId: 'H1', timestamp: Date.now(), sessionId: 'debug-session' }));
    if (!res.headersSent) {
      setCorsHeaders(res, origin);
      res.status(500).json({
        status: 'error',
        message: 'Internal server error'
      });
    }
  }
};
