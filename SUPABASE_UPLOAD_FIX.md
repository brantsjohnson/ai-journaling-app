# Fix: Supabase Upload Errors on Mobile/Vercel

## Errors You May See

1. **"Supabase upload failed: new row violates row-level security policy"**
2. **"uploadError is not defined"**

## Root Cause

### Why It Works on Localhost But Not on Vercel/Mobile

1. **RLS Policy**: Supabase Storage has Row Level Security (RLS). When the frontend uploads using the anon key, Supabase checks if the user is "authenticated." Users who login with **email/password** (your app's custom JWT) don't have a Supabase Auth session—so RLS blocks the upload.

2. **uploadError Bug**: A backend bug caused `uploadError` to be referenced when it wasn't in scope (fixed in code).

### Why Audio Goes Through Supabase (Not Vercel)

- **Vercel limit**: 4.5MB max request body size
- **Your recordings**: 10 min = ~4.2MB, 30 min = ~12.6MB
- **Solution**: Upload directly to Supabase Storage from the browser (bypasses Vercel's limit)
- **Trade-off**: Direct uploads must pass Supabase's RLS—hence the policy fix below

**You cannot bypass Supabase** for large files—Vercel's 4.5MB limit is hard. The fix is to configure Supabase correctly.

## Fix (Required - One-Time Setup)

### Step 1: Add Storage RLS Policy in Supabase

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project (`ubgbiaxrmnypqciezqge`)
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy the contents of `backend/supabase/storage_rls_policy.sql`
6. Paste into the editor
7. Click **Run**

You should see: "Success. No rows returned"

### Step 2: Verify the Fix

1. Redeploy your app (or wait for auto-deploy)
2. On your mobile device, try recording and transcribing
3. The upload should now succeed

## What Was Fixed in Code

### 1. Backend: `uploadError is not defined` (transcriptionController.js)

- **Bug**: When `file_path` was provided (file already in Supabase), the code still referenced `uploadError` which was only defined in the `else` block
- **Fix**: Declared `uploadError` in outer scope and fixed variable references

### 2. Supabase RLS (You Must Run SQL)

- **Issue**: No policy allowed anon/public uploads to the audio bucket
- **Fix**: Added policies for INSERT, SELECT, and UPDATE on `storage.objects` for bucket `audio`

## Alternative: Use Backend Upload (Small Files Only)

For files **under 4.5MB** (~10 min at 56kbps), you could route through the backend. The Retry Transcription flow already does this. But for longer recordings, direct Supabase upload is required.

## Troubleshooting

### Still getting RLS error after running SQL?

- Check you're in the correct Supabase project
- Verify the bucket is named exactly `audio`
- Try creating the bucket manually if it doesn't exist: Storage → New bucket → name: `audio` → Public

### "uploadError is not defined" still appears?

- Ensure you've pulled the latest code and redeployed
- The fix is in `backend/controllers/transcriptionController.js`
- Check Vercel deployment completed successfully

### Works on desktop but not mobile?

- Mobile browsers may handle sessions differently
- Ensure you're logged in before recording
- Try clearing browser cache/data
- The RLS policy fix should resolve session-related upload failures
