require('dotenv').config({ path: './backend/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkBucket() {
  console.log('🔍 Checking Supabase storage bucket...\n');

  try {
    // List all buckets
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      console.error('❌ Error listing buckets:', listError.message);
      process.exit(1);
    }

    console.log('📦 Available buckets:');
    buckets.forEach(bucket => {
      console.log(`  - ${bucket.name} (${bucket.public ? 'public' : 'private'})`);
    });

    const audioBucket = buckets.find(b => b.name === 'audio');

    if (!audioBucket) {
      console.log('\n⚠️  Audio bucket does not exist!');
      console.log('\n📝 Creating audio bucket...');

      const { data: newBucket, error: createError } = await supabase.storage.createBucket('audio', {
        public: true,
        fileSizeLimit: 26214400, // 25MB
      });

      if (createError) {
        console.error('❌ Error creating bucket:', createError.message);
        console.log('\n🔧 Please create it manually:');
        console.log('1. Go to https://supabase.com/dashboard');
        console.log('2. Select your project');
        console.log('3. Go to Storage');
        console.log('4. Click "Create bucket"');
        console.log('5. Name: audio');
        console.log('6. Make it public');
        process.exit(1);
      }

      console.log('✅ Audio bucket created successfully!');
    } else {
      console.log('\n✅ Audio bucket exists!');
      console.log('   Public:', audioBucket.public);
    }

    console.log('\n🎉 Storage is ready!');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

checkBucket();
