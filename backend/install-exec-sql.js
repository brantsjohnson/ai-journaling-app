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

async function installExecSql() {
  console.log('🔧 Installing exec_sql function in Supabase...\n');

  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'supabase', 'exec_sql_function.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Attempting to create exec_sql function...\n');

    // Try to execute the SQL
    // Note: Supabase doesn't allow executing DDL via RPC by default
    // So we'll try using the Management API

    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({ sql: sql }),
    });

    if (response.ok) {
      console.log('✅ exec_sql function installed successfully!');
      console.log('You can now use raw SQL queries in your backend.\n');
      process.exit(0);
    } else {
      const error = await response.text();
      throw new Error(`API returned: ${response.status} - ${error}`);
    }
  } catch (err) {
    console.error('❌ Auto-installation failed:', err.message);
    console.log('\n📋 Manual installation required:\n');
    console.log('1. Go to https://supabase.com/dashboard');
    console.log('2. Select your project');
    console.log('3. Go to SQL Editor');
    console.log('4. Create a new query');
    console.log('5. Copy and paste the content from:');
    console.log(`   ${path.join(__dirname, 'supabase', 'exec_sql_function.sql')}`);
    console.log('6. Click "Run"');
    console.log('\nThen restart your backend server: npm run dev\n');
    process.exit(1);
  }
}

installExecSql();
