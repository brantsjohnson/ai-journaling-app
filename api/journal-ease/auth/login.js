// Test route to see if specific routes work
const app = require('../../../backend/app');

module.exports = async (req, res) => {
  console.log('🚀 Login route function called!');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  
  // Reconstruct the full path for Express
  req.url = '/api/journal-ease/auth/login';
  req.originalUrl = '/api/journal-ease/auth/login';
  
  // Set CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  return app(req, res);
};
