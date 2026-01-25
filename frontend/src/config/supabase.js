import { createClient } from '@supabase/supabase-js';

// Use environment variables, with fallback to the correct production database
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ubgbiaxrmnypqciezqge.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InViZ2JpYXhybW55cHFjaWV6cWdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5NjY4NTYsImV4cCI6MjA4NDU0Mjg1Nn0.0mMNzZRVhDVjBdBOdallgUxnQop80Za7iJS12oTBgGs';

console.log('🔍 Supabase Configuration:');
console.log('  - VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL || 'using fallback');
console.log('  - Supabase URL:', supabaseUrl);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

