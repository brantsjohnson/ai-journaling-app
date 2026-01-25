const { createClient } = require('@supabase/supabase-js');

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  console.log('[DEBUG] Supabase Client Config:');
  console.log('  - SUPABASE_URL:', url ? `${url.substring(0, 30)}...` : 'MISSING');
  console.log('  - SUPABASE_SERVICE_ROLE_KEY:', serviceRoleKey ? `${serviceRoleKey.substring(0, 20)}...` : 'MISSING');
  console.log('  - NODE_ENV:', process.env.NODE_ENV);
  console.log('  - VERCEL:', process.env.VERCEL);

  if (!url || !serviceRoleKey) {
    console.error('❌ Supabase env vars missing: SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY');
    console.error('❌ Available env vars:', Object.keys(process.env).filter(k => k.includes('SUPABASE')));
    throw new Error('Supabase configuration missing. Please check your environment variables.');
  }

  try {
    const client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false },
    });
    console.log('✅ Supabase client created successfully');
    return client;
  } catch (error) {
    console.error('❌ Error creating Supabase client:', error.message);
    throw error;
  }
}

// Export a singleton client for convenience
// Wrap in try-catch to prevent server crash if env vars are missing
let supabase;
try {
  supabase = getSupabaseClient();
} catch (error) {
  console.error('⚠️  Supabase client initialization failed:', error.message);
  console.error('⚠️  Server will continue but Supabase operations will fail');
  // Create a dummy client that will throw errors when used
  supabase = {
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
        list: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } })
      })
    },
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: { message: 'Supabase not configured' } })
    }
  };
}

module.exports = supabase;
