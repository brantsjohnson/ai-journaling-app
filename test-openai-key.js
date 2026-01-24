require('dotenv').config({ path: './backend/.env' });
const axios = require('axios');

async function testOpenAIKey() {
  console.log('🔑 Testing OpenAI API Key...\n');

  const apiKey = process.env.OPEN_AI_KEY;

  if (!apiKey) {
    console.error('❌ No OpenAI API key found in environment variables');
    process.exit(1);
  }

  console.log('✓ API key found');
  console.log(`✓ Key format: ${apiKey.substring(0, 15)}...${apiKey.substring(apiKey.length - 5)}`);

  try {
    // Test with a simple API call
    const response = await axios.get('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      timeout: 10000
    });

    console.log('\n✅ OpenAI API Key is VALID!');
    console.log(`✓ Successfully authenticated with OpenAI`);
    console.log(`✓ Available models: ${response.data.data.length}`);

    // Check if whisper-1 is available
    const hasWhisper = response.data.data.some(model => model.id === 'whisper-1');
    if (hasWhisper) {
      console.log('✓ Whisper-1 model is available ✓');
    } else {
      console.log('⚠️  Whisper-1 model not found in available models');
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ OpenAI API Key is INVALID or EXPIRED!\n');

    if (error.response) {
      console.error('Error Status:', error.response.status);
      console.error('Error Message:', error.response.data?.error?.message || error.response.statusText);

      if (error.response.status === 401) {
        console.error('\n🔴 Authentication Failed!');
        console.error('This means your OpenAI API key is invalid, expired, or revoked.');
        console.error('\n📝 To fix this:');
        console.error('1. Go to: https://platform.openai.com/api-keys');
        console.error('2. Create a new API key');
        console.error('3. Update OPEN_AI_KEY in backend/.env');
        console.error('4. Update OPEN_AI_KEY in Vercel environment variables:');
        console.error('   cd backend && vercel env rm OPEN_AI_KEY production');
        console.error('   vercel env add OPEN_AI_KEY production');
      } else if (error.response.status === 429) {
        console.error('\n⚠️  Rate limit exceeded or insufficient credits');
        console.error('Check your OpenAI account billing: https://platform.openai.com/account/billing');
      }
    } else if (error.code === 'ECONNABORTED') {
      console.error('⚠️  Request timeout - check your internet connection');
    } else {
      console.error('Error:', error.message);
    }

    process.exit(1);
  }
}

testOpenAIKey();
