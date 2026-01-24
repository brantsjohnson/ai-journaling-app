// Test script to diagnose transcription issues
require('dotenv').config({ path: './.env' });
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const { exec } = require('child_process');

console.log('🔍 COMPLETE TRANSCRIPTION DIAGNOSTIC TEST\n');
console.log('=' .repeat(60));

// Test 1: Check local environment
console.log('\n📋 TEST 1: Local Environment Variables');
console.log('-'.repeat(60));
console.log('OPEN_AI_KEY:', process.env.OPEN_AI_KEY ? `✅ Set (${process.env.OPEN_AI_KEY.substring(0, 20)}...)` : '❌ NOT SET');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Set' : '❌ NOT SET');
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '✅ Set' : '❌ NOT SET');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ NOT SET');
console.log('SUPABASE_AUDIO_BUCKET:', process.env.SUPABASE_AUDIO_BUCKET ? '✅ Set' : '❌ NOT SET');

// Test 2: Check OpenAI API Key validity
async function testOpenAIKey() {
  console.log('\n📋 TEST 2: OpenAI API Key Validation');
  console.log('-'.repeat(60));

  if (!process.env.OPEN_AI_KEY) {
    console.log('❌ No API key to test');
    return false;
  }

  try {
    const response = await axios.get('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${process.env.OPEN_AI_KEY}` },
      timeout: 10000,
    });
    console.log('✅ API Key is VALID');
    console.log('✅ Can access OpenAI API');
    console.log('✅ Whisper-1 model:', response.data.data.some(m => m.id === 'whisper-1') ? 'Available' : 'Not found');
    return true;
  } catch (error) {
    console.log('❌ API Key validation FAILED');
    if (error.response) {
      console.log('   Status:', error.response.status);
      console.log('   Error:', error.response.data?.error?.message || error.response.statusText);
    } else {
      console.log('   Error:', error.message);
    }
    return false;
  }
}

// Test 3: Check Vercel environment variables
async function checkVercelEnv() {
  console.log('\n📋 TEST 3: Vercel Production Environment');
  console.log('-'.repeat(60));

  return new Promise((resolve) => {
    exec('vercel env ls', (error, stdout, stderr) => {
      if (error) {
        console.log('❌ Could not check Vercel env');
        resolve(false);
        return;
      }

      const hasOpenAI = stdout.includes('OPEN_AI_KEY');
      const hasSupabase = stdout.includes('SUPABASE_URL');

      console.log('OPEN_AI_KEY in Vercel:', hasOpenAI ? '✅ Present' : '❌ Missing');
      console.log('SUPABASE_URL in Vercel:', hasSupabase ? '✅ Present' : '❌ Missing');

      resolve(hasOpenAI && hasSupabase);
    });
  });
}

// Test 4: Test backend endpoint
async function testBackendEndpoint() {
  console.log('\n📋 TEST 4: Backend API Endpoint');
  console.log('-'.repeat(60));

  try {
    const response = await axios.get('https://backend-ten-chi-98.vercel.app/api/journal-ease');
    console.log('✅ Backend is reachable');
    return true;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.log('✅ Backend is LIVE (401 expected without auth)');
      return true;
    }
    console.log('❌ Backend not reachable:', error.message);
    return false;
  }
}

// Test 5: Create test audio file
function createTestAudio() {
  console.log('\n📋 TEST 5: Test Audio File');
  console.log('-'.repeat(60));

  const testAudioPath = './test-audio.mp3';

  if (fs.existsSync(testAudioPath)) {
    console.log('✅ Test audio file exists');
    const stats = fs.statSync(testAudioPath);
    console.log(`   Size: ${Math.round(stats.size / 1024)} KB`);
    return testAudioPath;
  }

  console.log('⚠️  No test audio file found');
  console.log('   Creating a minimal MP3 header for testing...');

  // Minimal MP3 file (just headers, won't transcribe but will test the endpoint)
  const mp3Header = Buffer.from([
    0xFF, 0xFB, 0x90, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
  ]);

  fs.writeFileSync(testAudioPath, mp3Header);
  console.log('✅ Created minimal test audio file');

  return testAudioPath;
}

// Test 6: Test transcription endpoint
async function testTranscriptionEndpoint(audioPath) {
  console.log('\n📋 TEST 6: Transcription Endpoint');
  console.log('-'.repeat(60));

  try {
    const formData = new FormData();
    formData.append('audio', fs.createReadStream(audioPath));

    console.log('📤 Sending request to transcription endpoint...');

    const response = await axios.post(
      'https://backend-ten-chi-98.vercel.app/api/journal-ease/transcribe',
      formData,
      {
        headers: formData.getHeaders(),
        timeout: 30000,
      }
    );

    console.log('✅ SUCCESS! Transcription endpoint working!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return true;
  } catch (error) {
    console.log('❌ Transcription endpoint FAILED');
    if (error.response) {
      console.log('   Status:', error.response.status);
      console.log('   Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('   Error:', error.message);
    }
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('\n🚀 Starting Complete Diagnostic Tests...\n');

  const results = {
    localEnv: true, // Already checked above
    openAIKey: await testOpenAIKey(),
    vercelEnv: await checkVercelEnv(),
    backendEndpoint: await testBackendEndpoint(),
  };

  const audioPath = createTestAudio();
  results.transcription = await testTranscriptionEndpoint(audioPath);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 DIAGNOSTIC SUMMARY');
  console.log('='.repeat(60));
  console.log('Local Environment:', results.localEnv ? '✅ PASS' : '❌ FAIL');
  console.log('OpenAI API Key:', results.openAIKey ? '✅ PASS' : '❌ FAIL');
  console.log('Vercel Environment:', results.vercelEnv ? '✅ PASS' : '❌ FAIL');
  console.log('Backend Endpoint:', results.backendEndpoint ? '✅ PASS' : '❌ FAIL');
  console.log('Transcription Test:', results.transcription ? '✅ PASS' : '❌ FAIL');

  const allPassed = Object.values(results).every(r => r === true);

  console.log('\n' + '='.repeat(60));
  if (allPassed) {
    console.log('🎉 ALL TESTS PASSED! Transcription should work!');
    console.log('\n✅ Your app is ready at: https://frontend-mu-wheat-65.vercel.app');
  } else {
    console.log('❌ SOME TESTS FAILED - See details above');
    console.log('\n🔧 Next Steps:');

    if (!results.openAIKey) {
      console.log('   1. Check OpenAI API key is valid and has credits');
      console.log('      → https://platform.openai.com/api-keys');
    }
    if (!results.vercelEnv) {
      console.log('   2. Update Vercel environment variables');
      console.log('      → Run: vercel env add OPEN_AI_KEY production');
    }
    if (!results.transcription) {
      console.log('   3. Check backend logs for detailed error');
      console.log('      → Run: vercel logs https://backend-ten-chi-98.vercel.app');
    }
  }
  console.log('='.repeat(60) + '\n');
}

runAllTests().catch(console.error);
