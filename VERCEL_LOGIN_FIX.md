# Vercel Login Issue - Fix Guide

## Problem
Login works on localhost but fails on Vercel deployment with "Login failed. Please check your credentials." error.

## Root Causes Identified

### 1. CORS Configuration ✅ FIXED
Your deployment URL `ai-journaling-ffh8t3gc4-brant-johnsons-projects.vercel.app` was not in the allowed origins list, blocking API requests.

**Fixed in:**
- `backend/app.js` - Updated CORS origins
- `api/journal-ease/[...all].js` - Updated CORS headers

### 2. Environment Variables ⚠️ NEEDS VERIFICATION

The following environment variables MUST be set in Vercel for authentication to work:

#### Required Backend Environment Variables:
```
NODE_ENV=production
JWT_SECRET=<your-secure-secret-key>
SUPABASE_URL=https://ubgbiaxrmnypqciezqge.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
SUPABASE_ANON_KEY=<your-anon-key>
OPEN_AI_KEY=<your-openai-key>
SUPABASE_AUDIO_BUCKET=audio
```

#### Required Frontend Environment Variables:
```
VITE_SUPABASE_URL=https://ubgbiaxrmnypqciezqge.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
VITE_API_URL=/api/journal-ease
```

## Step-by-Step Fix Instructions

### Step 1: Commit and Push CORS Fixes

```bash
cd /Users/brantsjohnson/Desktop/ai-journaling-app-main
git add backend/app.js api/journal-ease/\[...all\].js
git commit -m "Fix CORS configuration for Vercel deployment"
git push origin main
```

### Step 2: Verify Vercel Environment Variables

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project: `ai-journaling-ffh8t3gc4-brant-johnsons-projects`
3. Go to **Settings** → **Environment Variables**
4. Verify ALL variables listed above are present

#### Critical Variables to Check:

**JWT_SECRET** - MUST be set and MUST be the same as what was used to create existing user accounts
- If missing: Login will fail completely
- If changed: Existing tokens become invalid

**SUPABASE_URL** and **SUPABASE_SERVICE_ROLE_KEY** - MUST be set
- If missing: Database queries will fail
- Check backend logs for "Supabase client not initialized" errors

**NODE_ENV** - Should be set to "production"
- Affects error messages and logging

### Step 3: Check Your Local .env Files

Your local environment variables should match what's in Vercel. Check:

```bash
# Backend .env
cat backend/.env | grep -v "^#" | grep -v "^$"

# Frontend .env
cat frontend/.env | grep -v "^#" | grep -v "^$"
```

**Important:** Make sure your local `JWT_SECRET` matches what you set in Vercel!

### Step 4: Set Missing Environment Variables in Vercel

If any variables are missing:

1. In Vercel Dashboard → Settings → Environment Variables
2. Add each missing variable
3. Select **All Environments** (Production, Preview, Development)
4. Click **Save**

### Step 5: Redeploy

After setting environment variables:

**Option A: Automatic Redeploy**
- Vercel may auto-redeploy when you save environment variables

**Option B: Manual Redeploy**
1. Go to **Deployments** tab
2. Click the **...** menu on the latest deployment
3. Click **Redeploy**

**Option C: Trigger via Git Push**
```bash
git commit --allow-empty -m "Trigger Vercel redeploy"
git push origin main
```

### Step 6: Test the Deployment

1. Open your Vercel URL: `https://ai-journaling-ffh8t3gc4-brant-johnsons-projects.vercel.app`
2. Try logging in with your credentials
3. Open browser console (F12) and check for errors

### Step 7: Check Vercel Logs

If login still fails:

1. Go to Vercel Dashboard → **Deployments**
2. Click on the latest deployment
3. Click **Functions** tab
4. Look for the `/api/journal-ease/[...all]` function
5. Check the logs for errors

Look for:
- "Supabase client not initialized"
- "JWT_SECRET" errors
- Database connection errors
- CORS errors

## Common Error Messages and Solutions

### Error: "Login failed. Please check your credentials."

**Possible Causes:**
1. JWT_SECRET not set in Vercel
2. Database connection failing
3. CORS blocking the request
4. Wrong email/password

**Debug Steps:**
1. Check browser console for network errors
2. Check if API request reaches the backend (Vercel logs)
3. Verify environment variables are set

### Error: "Invalid or expired token"

**Cause:** JWT_SECRET mismatch between Vercel and what was used to create the account

**Solution:** 
1. Find the correct JWT_SECRET from your local `.env` file
2. Update it in Vercel environment variables
3. Redeploy

### Error: "CORS policy" in browser console

**Cause:** CORS headers not being set correctly

**Solution:** The CORS fix in this commit should resolve this. If not:
1. Check the `origin` header in the failed request
2. Add that origin to the allowed list in `backend/app.js`

### Error: "Supabase client not initialized"

**Cause:** Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY

**Solution:**
1. Add these variables in Vercel environment variables
2. Redeploy

## Verification Checklist

- [ ] CORS configuration updated in code
- [ ] Changes committed and pushed to git
- [ ] Vercel auto-deployed or manually redeployed
- [ ] All environment variables verified in Vercel Dashboard
- [ ] JWT_SECRET matches between local and Vercel
- [ ] Login tested on Vercel deployment
- [ ] Browser console checked for errors
- [ ] Vercel function logs checked for errors

## Still Having Issues?

1. **Check if the account exists:** Try creating a new account on Vercel deployment
2. **Test locally vs production:** If local works but Vercel doesn't, it's likely an environment variable issue
3. **Check database:** Verify your Supabase database is accessible and has the correct schema
4. **Compare working local environment:** Copy exact environment variables from local `.env` to Vercel

## Additional Notes

- Vercel preview deployments (on branches) use separate environment variables
- Changes to environment variables require a redeploy
- Vercel functions have a cold start - first request may be slow
- Check function timeout (currently set to 800s in vercel.json)

## Need More Help?

Check these logs:
1. Browser DevTools Console (F12) - Client-side errors
2. Vercel Function Logs - Server-side errors
3. Network tab in DevTools - API request/response details
