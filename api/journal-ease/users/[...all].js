// Catch-all route for /api/journal-ease/users/* endpoints
// From api/journal-ease/users/: ../ = journal-ease/, ../../ = api/, ../../../ = project root
const path = require('path');
const fs = require('fs');

let app = null;
let appLoadError = null;

// Try to load backend app at module level, but don't fail if it doesn't work
try {
  const backendAppPath = path.join(__dirname, '..', '..', 'backend', 'app');
  console.log('[DEBUG] Users catch-all: Attempting to require backend app from:', backendAppPath);
  console.log('[DEBUG] Users catch-all: __dirname:', __dirname);
  console.log('[DEBUG] Users catch-all: Backend app exists?', fs.existsSync(backendAppPath + '.js'));
  app = require(backendAppPath);
  console.log('[DEBUG] Users catch-all: Backend app loaded successfully');
} catch (err) {
  appLoadError = err;
  console.error('[DEBUG] Users catch-all: Failed to load backend app:', err.message);
  console.error('[DEBUG] Users catch-all: Error stack:', err.stack);
}

// Helper function to set CORS headers
function setCorsHeaders(res, origin) {
  const isAllowed = !origin || 
                    origin === '*' ||
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

module.exports = async (req, res) => {
  // #region agent log
  const DEBUG_INGEST = 'http://127.0.0.1:7242/ingest/763f5855-a7cf-4b2d-abed-e04d96151c45';
  const dbg = (payload) => {
    fetch(DEBUG_INGEST, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1' }) }).catch(() => {});
  };
  const dbgLog = (loc, msg, data, hyp) => console.log('[DEBUG]', JSON.stringify({ location: loc, message: msg, data, hypothesisId: hyp, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1' }));
  
  dbg({ location: 'users-catchall:entry', message: 'Users catch-all invoked', data: { method: req.method, url: req.url, originalUrl: req.originalUrl, path: req.path, hasApp: !!app, isEntriesRoute: req.url?.includes('/entries') || req.path?.includes('/entries'), headers: Object.keys(req.headers), hasAuth: !!req.headers.authorization }, hypothesisId: 'H1,H2,H3' });
  dbgLog('users-catchall:entry', 'Users catch-all invoked', { method: req.method, url: req.url, path: req.path, hasApp: !!app, isEntriesRoute: req.url?.includes('/entries') }, 'H1,H2,H3');
  // #endregion
  
  console.log('🚀 Users catch-all function invoked');
  console.log('📍 Method:', req.method);
  console.log('📍 URL:', req.url);
  console.log('📍 Original URL:', req.originalUrl);
  console.log('📍 Headers:', JSON.stringify(req.headers, null, 2));
  
  let origin = req.headers.origin || '*';
  
  // #region agent log
  dbgLog('users-catchall:pre-options', 'Before OPTIONS check', { method: req.method, origin }, 'H6');
  // #endregion
  
  if (req.method === 'OPTIONS') {
    // #region agent log
    dbgLog('users-catchall:options', 'Handling OPTIONS', { origin }, 'H6');
    // #endregion
    setCorsHeaders(res, origin);
    return res.status(204).end();
  }
  
  // Vercel passes path after /api/journal-ease/users
  // For /api/journal-ease/users/4/entries, req.url will be /4/entries
  let requestPath = req.url || '/';
  
  // #region agent log
  dbgLog('users-catchall:path-reconstruction', 'Reconstructing path', { originalUrl: req.url, requestPath }, 'H6');
  // #endregion
  
  // Reconstruct full path
  if (!requestPath.startsWith('/api/journal-ease')) {
    if (!requestPath.startsWith('/')) {
      requestPath = '/' + requestPath;
    }
    requestPath = '/api/journal-ease/users' + requestPath;
  }
  
  // #region agent log
  dbg({ location: 'users-catchall:pre-express', message: 'About to call Express', data: { requestPath, originalUrl: req.url, originalPath: req.path, isEntries: requestPath.includes('/entries'), isPost: req.method === 'POST', hasApp: !!app, pathMatches: requestPath.match(/\/users\/\d+\/entries/) }, hypothesisId: 'H1,H2,H3' });
  dbgLog('users-catchall:pre-express', 'About to call Express', { requestPath, isEntries: requestPath.includes('/entries'), pathMatches: requestPath.match(/\/users\/\d+\/entries/) }, 'H1,H2,H3');
  // #endregion
  console.log('📍 Final path for Express:', requestPath);
  console.log('📍 Is entries route?', requestPath.includes('/entries'));
  console.log('📍 Is POST?', req.method === 'POST');
  
  req.url = requestPath;
  req.originalUrl = requestPath;
  
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
    };
    // #region agent log
    dbgLog('users-catchall:app-not-loaded', 'Backend app not loaded', errorDetails, 'H6');
    // #endregion
    console.error('[DEBUG] Users catch-all: Backend app not loaded. Details:', JSON.stringify(errorDetails, null, 2));
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
  
  // #region agent log
  dbgLog('users-catchall:call-express', 'Calling Express app', { requestPath, method: req.method, hasApp: !!app }, 'H1,H2,H3');
  // #endregion
  
  try {
    const result = app(req, res);
    // #region agent log
    dbgLog('users-catchall:express-returned', 'Express app returned', { hasResult: !!result, resultType: typeof result, headersSent: res.headersSent, statusCode: res.statusCode }, 'H1,H2,H3');
    // #endregion
    return result;
  } catch (error) {
    // #region agent log
    dbgLog('users-catchall:express-threw', 'Express app threw', { errorMessage: error?.message, errorStack: error?.stack?.slice(0, 500) }, 'H1,H2,H3');
    // #endregion
    console.error('❌ Error in Express app:', error);
    console.error('❌ Error stack:', error.stack);
    if (!res.headersSent) {
      setCorsHeaders(res, origin);
      res.status(500).json({
        status: 'error',
        message: 'Internal server error'
      });
    }
  }
};
