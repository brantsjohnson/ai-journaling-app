require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function updateFunction() {
  console.log('='.repeat(60));
  console.log('UPDATING SUPABASE exec_sql FUNCTION');
  console.log('='.repeat(60));
  console.log('');

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'supabase', 'exec_sql_function.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('1. Reading SQL file...');
    console.log(`   Path: ${sqlPath}`);
    console.log('');

    // Execute the SQL
    console.log('2. Executing SQL to update function...');
    const { data, error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
      console.error('❌ Error updating function:', error.message);
      console.error('');
      console.error('Please run this SQL manually in Supabase SQL Editor:');
      console.error('https://supabase.com/dashboard');
      console.error('');
      console.error(sql);
      return;
    }

    console.log('✅ Function updated successfully!');
    console.log('');

    // Test the function
    console.log('3. Testing the updated function...');
    const testResult = await supabase.rpc('exec_sql', {
      sql: "UPDATE users SET name = name WHERE id = -1"
    });

    if (testResult.error) {
      console.error('❌ Test failed:', testResult.error.message);
    } else {
      console.log('   Test result:', JSON.stringify(testResult.data, null, 2));
      if (testResult.data.row_count !== undefined) {
        console.log('✅ Function now returns row_count!');
      } else {
        console.log('⚠️  Function does not return row_count - may need manual update');
      }
    }

    console.log('');
    console.log('='.repeat(60));
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
  }
}

updateFunction().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
