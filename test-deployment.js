const axios = require('axios');

const BACKEND_URL = 'https://backend-ten-chi-98.vercel.app';
const FRONTEND_URL = 'https://frontend-mu-wheat-65.vercel.app';

async function testDeployment() {
  console.log('🧪 Testing Deployment...\n');

  // Test 1: Backend is responding
  console.log('1️⃣ Testing backend availability...');
  try {
    const response = await axios.get(`${BACKEND_URL}/api/journal-ease/health`, {
      validateStatus: () => true // Accept any status code
    });
    if (response.status === 200 || response.data) {
      console.log('✅ Backend is responding');
      console.log('   Response:', JSON.stringify(response.data).substring(0, 100));
    } else {
      console.log('⚠️  Backend responded with status:', response.status);
    }
  } catch (err) {
    console.log('❌ Backend connection failed:', err.message);
  }

  // Test 2: Frontend is accessible
  console.log('\n2️⃣ Testing frontend availability...');
  try {
    const response = await axios.get(FRONTEND_URL);
    if (response.status === 200) {
      console.log('✅ Frontend is accessible');
      console.log('   Status:', response.status);
    } else {
      console.log('⚠️  Frontend responded with status:', response.status);
    }
  } catch (err) {
    console.log('❌ Frontend connection failed:', err.message);
  }

  // Test 3: Create a test user (signup)
  console.log('\n3️⃣ Testing user signup...');
  const testEmail = `test${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';
  const testName = 'Test User';

  try {
    const signupResponse = await axios.post(
      `${BACKEND_URL}/api/journal-ease/auth/signup`,
      {
        email: testEmail,
        password: testPassword,
        name: testName
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );

    if (signupResponse.status === 201 || signupResponse.status === 200) {
      console.log('✅ User signup successful!');
      console.log('   User:', signupResponse.data.user?.email || testEmail);

      // Test 4: Login with the created user
      console.log('\n4️⃣ Testing user login...');
      try {
        const loginResponse = await axios.post(
          `${BACKEND_URL}/api/journal-ease/auth/login`,
          {
            email: testEmail,
            password: testPassword
          },
          {
            headers: { 'Content-Type': 'application/json' }
          }
        );

        if (loginResponse.status === 200 && loginResponse.data.token) {
          console.log('✅ User login successful!');
          console.log('   Token received:', loginResponse.data.token.substring(0, 20) + '...');

          // Test 5: Access protected route
          console.log('\n5️⃣ Testing protected route access...');
          try {
            const entriesResponse = await axios.get(
              `${BACKEND_URL}/api/journal-ease/entries`,
              {
                headers: {
                  'Authorization': `Bearer ${loginResponse.data.token}`
                }
              }
            );

            if (entriesResponse.status === 200) {
              console.log('✅ Protected route access successful!');
              console.log('   Entries:', Array.isArray(entriesResponse.data) ? entriesResponse.data.length : 0);
            }
          } catch (err) {
            if (err.response) {
              console.log('⚠️  Protected route error:', err.response.status, err.response.data);
            } else {
              console.log('❌ Protected route failed:', err.message);
            }
          }
        } else {
          console.log('⚠️  Login response:', loginResponse.data);
        }
      } catch (err) {
        if (err.response) {
          console.log('❌ Login failed:', err.response.status, err.response.data);
        } else {
          console.log('❌ Login failed:', err.message);
        }
      }
    } else {
      console.log('⚠️  Signup response:', signupResponse.data);
    }
  } catch (err) {
    if (err.response) {
      console.log('❌ Signup failed:', err.response.status, err.response.data);
    } else {
      console.log('❌ Signup failed:', err.message);
    }
  }

  console.log('\n📋 Deployment Summary:');
  console.log('━'.repeat(60));
  console.log('Frontend URL:', FRONTEND_URL);
  console.log('Backend URL:', BACKEND_URL);
  console.log('━'.repeat(60));
  console.log('\n✅ Deployment test complete!');
}

testDeployment().catch(console.error);
