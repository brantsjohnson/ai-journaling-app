// Load env FIRST (only needed for local development)
// In Vercel, environment variables are injected automatically
if (!process.env.VERCEL) {
  require('dotenv').config({ path: './.env' });
}

const app = require('./app');

const port = process.env.PORT || 4000;

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`App running on port ${port}...`);
  });
}

// Export for Vercel serverless
module.exports = app;
