const app = require('../../app');

// Helper function to set CORS headers
function setCorsHeaders(res, origin) {
  const allowedOrigins = [
    'https://ai-journaling-app-main.vercel.app',
    'http://localhost:5173',
  ];
  
  // Extract origin from referer if needed
  let actualOrigin = origin;
  if (!actualOrigin && origin && typeof origin === 'string' && origin.includes('://')) {
    try {
      const url = new URL(origin);
      actualOrigin = url.origin;
    } catch (e) {
      // Ignore
    }
  }
  
  // Check if origin is allowed
  const isAllowed = !actualOrigin || 
                    actualOrigin === '*' ||
                    allowedOrigins.includes(actualOrigin) || 
                    (typeof actualOrigin === 'string' && actualOrigin.endsWith('.vercel.app'));
  
  if (isAllowed) {
    // Use the actual origin or allow all
    const corsOrigin = actualOrigin && actualOrigin !== '*' ? actualOrigin : '*';
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    return true;
  }
  return false;
}

// Export as Vercel serverless function handler
module.exports = async (req, res) => {
  // Log ALL requests immediately for debugging
  console.log('=== Serverless Function Invoked ===');
  console.log('Method:', req.method);
  console.log('Original req.url:', req.url);
  console.log('Original req.path:', req.path);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  
  // Extract origin from headers
  let origin = req.headers.origin;
  if (!origin && req.headers.referer) {
    try {
      origin = new URL(req.headers.referer).origin;
    } catch (e) {
      // Invalid URL, ignore
    }
  }
  if (!origin) {
    origin = '*';
  }
  
  console.log('Extracted origin:', origin);
  console.log('Origin header:', req.headers.origin);
  console.log('Referer header:', req.headers.referer);
  
  // Handle OPTIONS preflight requests immediately
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS preflight request');
    if (setCorsHeaders(res, origin)) {
      console.log('CORS headers set, returning 204');
      return res.status(204).end();
    } else {
      console.log('CORS check failed, returning 403');
      return res.status(403).end();
    }
  }
  
  // Vercel's behavior with [...all] catch-all:
  // - Request to: /api/journal-ease/auth/login
  // - Vercel may pass: req.url = '/api/journal-ease/auth/login' (full path) OR '/auth/login' (stripped)
  // - We need to ensure it's '/api/journal-ease/auth/login' for Express
  
  const originalUrl = req.url || req.path || '/';
  
  // Only add prefix if it's not already there
  if (!originalUrl.startsWith('/api/journal-ease')) {
    // Path was stripped, add prefix back
    const pathAfterPrefix = originalUrl.startsWith('/') ? originalUrl : '/' + originalUrl;
    req.url = '/api/journal-ease' + pathAfterPrefix;
    console.log('Path was stripped, added prefix. New req.url:', req.url);
  } else {
    // Path already includes prefix, use as-is
    req.url = originalUrl;
    console.log('Path already correct, using as-is:', req.url);
  }
  
  // Set CORS headers on all responses (not just OPTIONS)
  // Origin was already extracted above
  setCorsHeaders(res, origin);
  
  // Pass to Express app with error handling
  try {
    return app(req, res);
  } catch (error) {
    console.error('Error in Express app:', error);
    // Ensure CORS headers are set even on errors
    setCorsHeaders(res, origin);
    return res.status(500).json({ 
      status: 'error', 
      message: 'Internal server error' 
    });
  }
};
