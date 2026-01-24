const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  console.error('⚠️  Database operations will fail until env vars are configured');
  // Create a dummy client to prevent crashes
  supabase = {
    from: () => ({
      select: () => Promise.resolve({ data: null, error: { message: 'Database not configured' } }),
      insert: () => Promise.resolve({ data: null, error: { message: 'Database not configured' } }),
      update: () => Promise.resolve({ data: null, error: { message: 'Database not configured' } }),
      delete: () => Promise.resolve({ data: null, error: { message: 'Database not configured' } }),
    }),
  };
} else {
  supabase = createClient(supabaseUrl, supabaseServiceKey, {
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
}

/**
 * SQL query wrapper for Supabase
 * Converts parameterized SQL queries to work with Supabase
 *
 * NOTE: This is a compatibility layer. For best performance and features,
 * refactor code to use Supabase query builder directly.
 */
async function query(text, params = []) {
  // #region agent log
  const DEBUG_INGEST = 'http://127.0.0.1:7242/ingest/763f5855-a7cf-4b2d-abed-e04d96151c45';
  const dbg = (payload) => {
    fetch(DEBUG_INGEST, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1' }) }).catch(() => {});
  };
  const dbgLog = (loc, msg, data, hyp) => console.log('[DEBUG]', JSON.stringify({ location: loc, message: msg, data, hypothesisId: hyp, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1' }));
  
  const isInsert = text.trim().toUpperCase().startsWith('INSERT');
  const isSelect = text.trim().toUpperCase().startsWith('SELECT');
  const hasTranscript = params.some((p, i) => {
    const paramName = text.match(new RegExp(`\\$${i + 1}\\b`));
    return paramName && typeof p === 'string' && p.length > 10; // Likely transcript if long string
  });
  
  dbgLog('db.js:query:entry', 'DB query started', { 
    isInsert, 
    isSelect, 
    hasTranscript,
    paramCount: params.length,
    queryPreview: text.substring(0, 100),
    paramsPreview: params.map(p => typeof p === 'string' ? (p.length > 50 ? p.substring(0, 50) + '...' : p) : p)
  }, 'H7');
  // #endregion
  
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

    // #region agent log
    if (isInsert && hasTranscript) {
      dbgLog('db.js:query:pre-exec', 'About to execute INSERT with transcript', { 
        sqlPreview: sqlQuery.substring(0, 200),
        transcriptLength: params.find(p => typeof p === 'string' && p.length > 10)?.length
      }, 'H7');
    }
    // #endregion

    // Execute raw SQL using Supabase RPC
    const { data, error } = await supabase.rpc('exec_sql', { sql: sqlQuery });

    if (error) {
      // #region agent log
      dbgLog('db.js:query:error', 'DB query error', { 
        errorCode: error.code, 
        errorMessage: error.message,
        isInsert,
        hasTranscript
      }, 'H7');
      // #endregion
      
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

    // #region agent log
    if (isInsert && hasTranscript) {
      dbgLog('db.js:query:success', 'INSERT with transcript succeeded', { 
        rowCount,
        hasRows: rows.length > 0,
        entryId: rows[0]?.id,
        transcriptSaved: !!rows[0]?.transcript,
        transcriptLength: rows[0]?.transcript?.length
      }, 'H7');
    } else {
      dbgLog('db.js:query:success', 'DB query succeeded', { 
        rowCount,
        hasRows: rows.length > 0,
        isInsert,
        isSelect
      }, 'H7');
    }
    // #endregion

    return {
      rows: Array.isArray(rows) ? rows : (rows ? [rows] : []),
      rowCount: rowCount,
    };
  } catch (err) {
    // #region agent log
    dbgLog('db.js:query:catch', 'DB query exception', { 
      errorMessage: err.message,
      errorStack: err.stack?.substring(0, 500),
      isInsert,
      hasTranscript
    }, 'H7');
    // #endregion
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
