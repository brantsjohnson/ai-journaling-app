-- ============================================================
-- Supabase Storage RLS Policy for Audio Bucket
-- ============================================================
-- 
-- ERROR: "new row violates row-level security policy"
--
-- This happens when the frontend uploads directly to Supabase storage
-- using the anon key. Users who login with email/password (custom JWT)
-- don't have a Supabase Auth session, so RLS blocks the upload.
--
-- FIX: Run this SQL in your Supabase project to allow uploads to the
--      'audio' bucket. The backend uses service_role (bypasses RLS),
--      but frontend uploads use anon key and need these policies.
--
-- ============================================================
-- INSTRUCTIONS:
-- 1. Go to https://supabase.com/dashboard
-- 2. Select your project
-- 3. Go to SQL Editor
-- 4. Paste this entire file and click "Run"
-- ============================================================

-- Enable RLS on storage.objects (if not already enabled)
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow public uploads to audio bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read from audio bucket" ON storage.objects;

-- Policy: Allow anyone to INSERT (upload) into the audio bucket
-- This allows the frontend to upload recordings without Supabase Auth
CREATE POLICY "Allow public uploads to audio bucket"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'audio');

-- Policy: Allow anyone to SELECT (read) from the audio bucket
-- Needed for public bucket access and for upsert operations
CREATE POLICY "Allow public read from audio bucket"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'audio');

-- Policy: Allow anyone to UPDATE in the audio bucket (for upsert)
CREATE POLICY "Allow public update in audio bucket"
ON storage.objects
FOR UPDATE
TO public
USING (bucket_id = 'audio')
WITH CHECK (bucket_id = 'audio');
