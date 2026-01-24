// Specific route handler for /api/journal-ease/users/* endpoints
// This ensures Vercel routes users requests correctly
const path = require('path');
const fs = require('fs');

let app = null;
let appLoadError = null;

// Try to load backend app at module level
try {
  const backendAppPath = path.join(__dirname, '..', '..', '..', 'backend', 'app');
  app = require(backendAppPath);
  console.log('[DEBUG] Users route: Backend app loaded successfully');
} catch (err) {
  appLoadError = err;
  console.error('[DEBUG] Users route: Failed to load backend app:', err.message);
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
  console.log('🚀 Users route handler invoked');
  console.log('📍 Method:', req.method);
  console.log('📍 Original URL:', req.url);
  console.log('📍 Path:', req.path);
  
  let origin = req.headers.origin || '*';
  
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res, origin);
    return res.status(204).end();
  }
  
  // Vercel passes path segments after /api/journal-ease/users
  // For /api/journal-ease/users/4/entries, req.url will be /4/entries or the full path
  let requestPath = req.url || req.path || '/';
  
  // Reconstruct full path for Express
  if (!requestPath.startsWith('/api/journal-ease')) {
    if (!requestPath.startsWith('/')) {
      requestPath = '/' + requestPath;
    }
    // Prepend /api/journal-ease/users to reconstruct full path
    requestPath = '/api/journal-ease/users' + requestPath;
  }
  
  console.log('📍 Final path for Express:', requestPath);
  
  // Update request for Express
  req.url = requestPath;
  req.originalUrl = requestPath;
  
  setCorsHeaders(res, origin);
  
  if (!app) {
    console.error('[DEBUG] Users route: Backend app not loaded');
    if (!res.headersSent) {
      setCorsHeaders(res, origin);
      return res.status(500).json({
        status: 'error',
        message: 'Backend module not found',
        error: appLoadError?.message || 'Cannot load backend/app'
      });
    }
    return;
  }
  
  try {
    return app(req, res);
  } catch (error) {
    console.error('❌ Error in Express app:', error);
    if (!res.headersSent) {
      setCorsHeaders(res, origin);
      res.status(500).json({
        status: 'error',
        message: 'Internal server error'
      });
    }
  }
};
