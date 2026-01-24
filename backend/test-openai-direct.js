require('dotenv').config();
const axios = require('axios');

async function testOpenAIKey() {
  console.log('🔑 Testing OpenAI API Key...\n');

  const apiKey = process.env.OPEN_AI_KEY;

  if (!apiKey) {
    console.error('❌ OPEN_AI_KEY not found in environment!');
    return;
  }

  console.log('✅ API Key found:', apiKey.substring(0, 20) + '...\n');

  try {
    console.log('📡 Testing API key with OpenAI...\n');

    const response = await axios.get('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      timeout: 10000,
    });

    console.log('✅ SUCCESS! OpenAI API Key is VALID!\n');
    console.log('📊 Available models:', response.data.data.length);
    console.log('🎤 Whisper model available:', response.data.data.some(m => m.id === 'whisper-1') ? 'YES ✅' : 'NO ❌');
    console.log('\n🎉 Your API key is working perfectly!');

  } catch (error) {
    console.error('❌ FAILED! OpenAI API Key Error:\n');

    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Error:', JSON.stringify(error.response.data, null, 2));

      if (error.response.status === 401) {
        console.error('\n🚨 PROBLEM: Invalid API Key!');
        console.error('Your API key is either:');
        console.error('  1. Incorrect');
        console.error('  2. Expired');
        console.error('  3. Revoked');
        console.error('\n💡 SOLUTION:');
        console.error('  1. Go to: https://platform.openai.com/api-keys');
        console.error('  2. Create a NEW API key');
        console.error('  3. Replace it in backend/.env');
        console.error('  4. Update Vercel: vercel env add OPEN_AI_KEY production');
      } else if (error.response.status === 429) {
        console.error('\n🚨 PROBLEM: Rate limit or insufficient credits!');
        console.error('💡 SOLUTION:');
        console.error('  1. Check credits: https://platform.openai.com/account/usage');
        console.error('  2. Add credits: https://platform.openai.com/account/billing');
      }
    } else {
      console.error('Network Error:', error.message);
    }
  }
}

testOpenAIKey();
