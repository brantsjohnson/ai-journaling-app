const { createClient } = require('@supabase/supabase-js');

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('Supabase env vars missing: SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

// Export a singleton client for convenience
const supabase = getSupabaseClient();

module.exports = supabase;
