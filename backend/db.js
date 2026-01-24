const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  throw new Error('Supabase configuration missing');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Test connection
(async () => {
  try {
    const { data, error } = await supabase.from('users').select('count', { count: 'exact', head: true });

    if (error && error.code === '42P01') {
      console.log('✅ Supabase connected (run schema.sql in Supabase SQL Editor to create tables)');
    } else if (error) {
      console.log('⚠️  Supabase connection warning:', error.message);
    } else {
      console.log('✅ Database connected successfully via Supabase client');
    }
  } catch (err) {
    console.error('❌ Error connecting to Supabase:', err.message);
  }
})();

/**
 * SQL query wrapper for Supabase
 * Converts parameterized SQL queries to work with Supabase
 *
 * NOTE: This is a compatibility layer. For best performance and features,
 * refactor code to use Supabase query builder directly.
 */
async function query(text, params = []) {
  try {
    // Replace parameterized queries ($1, $2, etc.) with actual values
    let sqlQuery = text;

    // Process parameters in reverse order to avoid issues with $10 vs $1
    for (let i = params.length; i >= 1; i--) {
      const param = params[i - 1];
      let value;

      if (param === null || param === undefined) {
        value = 'NULL';
      } else if (typeof param === 'string') {
        // Escape single quotes
        value = `'${param.replace(/'/g, "''")}'`;
      } else if (typeof param === 'boolean') {
        value = param ? 'TRUE' : 'FALSE';
      } else if (param instanceof Date) {
        value = `'${param.toISOString()}'`;
      } else {
        value = param.toString();
      }

      // Replace $i with the value
      const regex = new RegExp(`\\$${i}\\b`, 'g');
      sqlQuery = sqlQuery.replace(regex, value);
    }

    // Execute raw SQL using Supabase RPC
    const { data, error } = await supabase.rpc('exec_sql', { sql: sqlQuery });

    if (error) {
      // Check if the error is because exec_sql doesn't exist
      if (error.code === '42883' || error.message?.includes('function') || error.message?.includes('does not exist')) {
        throw new Error(
          `❌ The exec_sql function doesn't exist in your Supabase database.\n\n` +
          `To fix this, run the SQL file in Supabase SQL Editor:\n` +
          `   backend/supabase/exec_sql_function.sql\n\n` +
          `Steps:\n` +
          `1. Go to https://supabase.com/dashboard\n` +
          `2. Select your project: kdttmphelrwdmlnjisat\n` +
          `3. Go to SQL Editor\n` +
          `4. Copy and paste the content from exec_sql_function.sql\n` +
          `5. Click "Run"\n` +
          `6. Restart your backend server\n\n` +
          `Original error: ${error.message}`
        );
      }
      throw error;
    }

    // The exec_sql function returns {data: [...]} for SELECT/RETURNING
    // or {data: null, success: true, row_count: N} for UPDATE/DELETE/INSERT
    const rows = data?.data || [];

    // Use row_count from exec_sql for UPDATE/DELETE/INSERT, otherwise count rows
    const rowCount = data?.row_count !== undefined
      ? data.row_count
      : (Array.isArray(rows) ? rows.length : (rows ? 1 : 0));

    return {
      rows: Array.isArray(rows) ? rows : (rows ? [rows] : []),
      rowCount: rowCount,
    };
  } catch (err) {
    console.error('Query execution error:', err.message);
    console.error('Query:', text);
    console.error('Params:', params);
    throw err;
  }
}

module.exports = {
  query,
  supabase,
};
