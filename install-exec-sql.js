require('dotenv').config({ path: './backend/.env' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function installExecSqlFunction() {
  console.log('🔧 Installing exec_sql function in Supabase...\n');

  try {
    // First test if exec_sql already exists
    const { error: testError } = await supabase.rpc('exec_sql', {
      sql: 'SELECT NOW() as current_time'
    });

    if (!testError) {
      console.log('✅ exec_sql function already exists and is working!');
      process.exit(0);
    }

    if (testError.code !== '42883') {
      console.error('❌ Unexpected error:', testError.message);
      process.exit(1);
    }

    // Function doesn't exist, show instructions
    console.log('⚠️  exec_sql function does not exist in your Supabase database.\n');
    console.log('📝 To install it, follow these steps:\n');
    console.log('1. Go to: https://supabase.com/dashboard');
    console.log('2. Select your project');
    console.log('3. Go to SQL Editor');
    console.log('4. Create a new query and paste the following:\n');

    const sqlFunctionPath = path.join(__dirname, 'backend', 'supabase', 'exec_sql_function.sql');
    const sqlFunction = fs.readFileSync(sqlFunctionPath, 'utf8');

    console.log('─'.repeat(60));
    console.log(sqlFunction);
    console.log('─'.repeat(60));
    console.log('\n5. Click "Run" to execute the query');
    console.log('6. Run this script again to verify\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

installExecSqlFunction();
