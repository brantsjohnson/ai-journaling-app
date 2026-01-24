require('dotenv').config({ path: './.env' });
const axios = require('axios');

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
$$;

GRANT EXECUTE ON FUNCTION exec_sql(text) TO authenticated;
GRANT EXECUTE ON FUNCTION exec_sql(text) TO service_role;`;

  try {
    console.log('1. Sending request to Supabase SQL endpoint...');

    const response = await axios.post(
      `${supabaseUrl}/rest/v1/rpc/pg_exec`,
      { query: functionSQL },
      {
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Response:', response.data);
    console.log('');
    console.log('='.repeat(60));
  } catch (err) {
    if (err.response) {
      console.error('❌ HTTP Error:', err.response.status);
      console.error('   Response:', err.response.data);
    } else {
      console.error('❌ Error:', err.message);
    }
    console.log('');
    console.log('⚠️  Could not update automatically. Please run this SQL manually in Supabase SQL Editor:');
    console.log('   https://supabase.com/dashboard → SQL Editor');
    console.log('');
    console.log(functionSQL);
  }
}

updateFunction().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
