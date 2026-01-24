require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupDatabase() {
  console.log('🔧 Setting up database...\n');

  try {
    // Read schema file
    const schemaPath = path.join(__dirname, 'supabase', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Split schema into individual statements
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log(`Found ${statements.length} SQL statements to execute\n`);

    // Execute via Supabase REST API (requires enabling in dashboard)
    console.log('⚠️  Note: SQL execution via API requires using Supabase SQL Editor or CLI');
    console.log('\nPlease run the following steps:');
    console.log('1. Go to https://supabase.com/dashboard');
    console.log('2. Select your project');
    console.log('3. Go to SQL Editor');
    console.log('4. Run the schema.sql file content\n');
    console.log('Schema file location:', schemaPath);
    console.log('\nAlternatively, if you have Supabase CLI installed:');
    console.log('   supabase db push\n');

    // Try to check if tables exist
    console.log('Checking if tables already exist...');

    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('count', { count: 'exact', head: true });

    const { data: entriesData, error: entriesError } = await supabase
      .from('entries')
      .select('count', { count: 'exact', head: true });

    if (!usersError && !entriesError) {
      console.log('✅ Tables already exist! Database is ready.');
      process.exit(0);
    } else if (usersError?.code === '42P01' || entriesError?.code === '42P01') {
      console.log('❌ Tables do not exist yet. Please run the schema in Supabase SQL Editor.');
      console.log('\nSchema to run:');
      console.log('─'.repeat(60));
      console.log(schema);
      console.log('─'.repeat(60));
      process.exit(1);
    } else {
      console.log('⚠️  Could not check table status:', usersError || entriesError);
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Error setting up database:', err.message);
    process.exit(1);
  }
}

setupDatabase();
