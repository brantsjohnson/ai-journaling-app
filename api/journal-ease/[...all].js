// Debug: Check if we can load the app
let app;
try {
  console.log('📦 Loading Express app from ../../backend/app...');
  app = require('../../backend/app');
  console.log('✅ Express app loaded successfully');
} catch (error) {
  console.error('❌ Failed to load Express app:', error);
  console.error('❌ Error stack:', error.stack);
  // Export a simple error handler
  module.exports = async (req, res) => {
    res.status(500).json({
      status: 'error',
      message: 'Failed to load backend application',
      error: error.message
    });
  };
  throw error;
}

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
      // Invalid URL, ignore
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
  console.log('🚀 === Serverless Function Invoked ===');
  console.log('📍 Request received at:', new Date().toISOString());
  console.log('🔧 Method:', req.method);
  console.log('📍 Original req.url:', req.url);
  console.log('📍 Original req.path:', req.path);
  console.log('📍 req.originalUrl:', req.originalUrl);
  console.log('📍 Full request object keys:', Object.keys(req));
  console.log('📋 Headers:', JSON.stringify(req.headers, null, 2));
  
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
  // - Request to: /api/journal-ease/auth/signup
  // - Vercel passes the path AFTER /api/journal-ease as the catch-all parameter
  // - So req.url will be something like '/auth/signup' or just the path segments
  // - We need to reconstruct '/api/journal-ease/auth/signup' for Express
  
  // Get the current URL - Vercel may have stripped the prefix
  let requestPath = req.url || req.path || '/';
  
  // If the path doesn't start with /api/journal-ease, add it
  // This handles the case where Vercel strips the prefix
  if (!requestPath.startsWith('/api/journal-ease')) {
    // Ensure path starts with /
    if (!requestPath.startsWith('/')) {
      requestPath = '/' + requestPath;
    }
    // Add the prefix
    requestPath = '/api/journal-ease' + requestPath;
  }
  
  // Update request properties for Express routing
  req.url = requestPath;
  req.originalUrl = requestPath;
  // Don't set req.path directly as Express calculates it
  
  console.log('Final path for Express:', requestPath);
  console.log('Request method:', req.method);
  
  // Set CORS headers on all responses
  setCorsHeaders(res, origin);
  
  // Pass to Express app
  // Express app is a request handler, so we can call it directly
  console.log('🔄 Passing request to Express app...');
  try {
    const result = await app(req, res);
    console.log('✅ Express app handled request');
    return result;
  } catch (error) {
    console.error('❌ Error in Express app:', error);
    console.error('❌ Error stack:', error.stack);
    if (!res.headersSent) {
      setCorsHeaders(res, origin);
      res.status(500).json({
        status: 'error',
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    return;
  }
};
