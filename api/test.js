// Simple test function to verify Vercel detects functions
module.exports = async (req, res) => {
  console.log('✅ Test function was called!');
  res.json({
    status: 'success',
    message: 'Test function is working!',
    timestamp: new Date().toISOString(),
    url: req.url,
    method: req.method
  });
};
