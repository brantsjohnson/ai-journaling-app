// Catch-all route for /api/journal-ease/users/* endpoints
const app = require('../../../../backend/app');

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
  console.log('🚀 Users catch-all function invoked');
  console.log('📍 Method:', req.method);
  console.log('📍 URL:', req.url);
  
  let origin = req.headers.origin || '*';
  
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res, origin);
    return res.status(204).end();
  }
  
  // Vercel passes path after /api/journal-ease/users
  // For /api/journal-ease/users/4/entries, req.url will be /4/entries
  let requestPath = req.url || '/';
  
  // Reconstruct full path
  if (!requestPath.startsWith('/api/journal-ease')) {
    if (!requestPath.startsWith('/')) {
      requestPath = '/' + requestPath;
    }
    requestPath = '/api/journal-ease/users' + requestPath;
  }
  
  console.log('📍 Final path for Express:', requestPath);
  
  req.url = requestPath;
  req.originalUrl = requestPath;
  
  setCorsHeaders(res, origin);
  
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
