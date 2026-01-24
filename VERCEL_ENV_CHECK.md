# Vercel Environment Variables Checklist

## The Problem
Your app works on localhost but not on Vercel because:
1. Frontend is calling `http://127.0.0.1:4000` instead of your Vercel URL
2. Backend might be missing environment variables
3. API routes might not be configured correctly

## Step 1: Find Your Vercel URL

Your app is deployed at a URL like:
- `https://ai-journaling-app-rose.vercel.app` (or similar)

**Important**: On Vercel, your frontend and backend API are on the SAME domain:
- Frontend: `https://ai-journaling-app-rose.vercel.app`
- API: `https://ai-journaling-app-rose.vercel.app/api/journal-ease`

They're not separate - the API is a serverless function on the same domain!

## Step 2: Add Frontend Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Click **Settings** → **Environment Variables**
3. Add these variables (make sure to select **Production**, **Preview**, and **Development**):

### Frontend Variables (must start with `VITE_`):

```
VITE_API_URL=https://YOUR-VERCEL-URL.vercel.app/api/journal-ease
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Important**: 
- Replace `YOUR-VERCEL-URL` with your actual Vercel deployment URL
- If you haven't deployed yet, you can set this AFTER the first deployment
- For now, you can use a relative path: `/api/journal-ease` (but absolute URL is better)

## Step 3: Add Backend Environment Variables in Vercel

In the same Environment Variables section, add:

```
NODE_ENV=production
JWT_SECRET=your_jwt_secret
OPEN_AI_KEY=your_openai_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_AUDIO_BUCKET=audio
```

## Step 4: Redeploy

After adding all environment variables:
1. Go to **Deployments** tab
2. Click the **three dots** (⋯) on the latest deployment
3. Click **"Redeploy"**

## How to Find Your Values

- **Supabase values**: Go to https://supabase.com/dashboard → Your Project → Settings → API
- **JWT_SECRET**: Any random string (keep it secret!)
- **OpenAI Key**: From https://platform.openai.com/api-keys
- **Vercel URL**: Check your Vercel dashboard - it's your deployment URL

## Step 5: Check Vercel Project Settings

Make sure your Vercel project is configured correctly:

1. Go to **Settings** → **General**
2. Check **Root Directory**: Should be `.` (root) or leave default
3. Check **Build Command**: Should be `cd frontend && npm install && npm run build`
4. Check **Output Directory**: Should be `frontend/dist`

## Step 6: Verify API Functions Are Detected

Vercel should automatically detect your API functions in `backend/api/journal-ease/[...all].js`.

To verify:
1. Go to **Deployments** tab
2. Click on a deployment
3. Check the **Functions** tab
4. You should see `/api/journal-ease/[...all]` listed

If it's not there, Vercel might not be detecting the functions. In that case:
- The functions are in `backend/api/` but Vercel might need them in root `api/`
- OR you need to configure the build settings

## Quick Test

After redeploying, check the browser console. You should see:
- API calls going to `https://your-vercel-url.vercel.app/api/journal-ease/auth/signup`
- NOT `http://127.0.0.1:4000`

## Alternative: Use Relative Path (Easier)

If setting the absolute URL is confusing, you can temporarily use a relative path:

In Vercel Environment Variables, set:
```
VITE_API_URL=/api/journal-ease
```

This will work because frontend and API are on the same domain on Vercel!
