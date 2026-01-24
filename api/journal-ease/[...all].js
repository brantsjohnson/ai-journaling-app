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
  
  // Reconstruct full path for Express
  if (!requestPath.startsWith('/api/journal-ease')) {
    if (!requestPath.startsWith('/')) {
      requestPath = '/' + requestPath;
    }
    requestPath = '/api/journal-ease' + requestPath;
  }
  
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
    return app(req, res);
  } catch (error) {
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
