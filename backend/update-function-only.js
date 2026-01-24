require('dotenv').config({ path: './.env' });
const { createClient } = require('@supabase/supabase-js');

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

  const functionSQL = `CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
  rec record;
  results json[] := '{}';
  affected_rows int;
BEGIN
  -- For SELECT queries
  IF sql ILIKE 'SELECT%' THEN
    FOR rec IN EXECUTE sql
    LOOP
      results := array_append(results, row_to_json(rec));
    END LOOP;
    RETURN json_build_object('data', results);
  END IF;

  -- For INSERT/UPDATE/DELETE with RETURNING
  IF sql ILIKE '%RETURNING%' THEN
    FOR rec IN EXECUTE sql
    LOOP
      results := array_append(results, row_to_json(rec));
    END LOOP;
    RETURN json_build_object('data', results);
  END IF;

  -- For INSERT/UPDATE/DELETE without RETURNING
  EXECUTE sql;
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RETURN json_build_object('data', null, 'success', true, 'row_count', affected_rows);
END;
$$`;

  try {
    console.log('1. Updating exec_sql function...');
    const { data, error } = await supabase.rpc('exec_sql', { sql: functionSQL });

    if (error) {
      console.error('❌ Error:', error.message);
      return;
    }

    console.log('✅ Function updated successfully!');
    console.log('');

    // Test with a dummy UPDATE
    console.log('2. Testing with dummy UPDATE...');
    const testResult = await supabase.rpc('exec_sql', {
      sql: "UPDATE users SET name = name WHERE id = -99999"
    });

    if (testResult.error) {
      console.error('❌ Test error:', testResult.error.message);
    } else {
      console.log('   Result:', JSON.stringify(testResult.data, null, 2));
      if (testResult.data.row_count !== undefined) {
        console.log('✅ Function now returns row_count! Value:', testResult.data.row_count);
      } else {
        console.log('⚠️  row_count not found in response');
      }
    }

    console.log('');
    console.log('='.repeat(60));
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

updateFunction().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
