# Vercel Deployment Guide

This guide will help you deploy your AI Journaling App to Vercel.

## Prerequisites

1. A Vercel account (sign up at [vercel.com](https://vercel.com))
2. Your code pushed to GitHub (or GitLab/Bitbucket)
3. All environment variables ready

## Step 1: Push to GitHub

If you haven't already, push your code to GitHub:

```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

## Step 2: Import Project to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New..."** → **"Project"**
3. Import your GitHub repository
4. Vercel will auto-detect the project settings

## Step 3: Configure Project Settings

### Root Directory
- Set **Root Directory** to: `frontend` (for frontend-only deployment)
- OR keep it as root if deploying both frontend and backend

### Build Settings
- **Framework Preset**: Vite
- **Build Command**: `npm run build` (if root is frontend) or `cd frontend && npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

## Step 4: Configure Environment Variables

Add these environment variables in Vercel Dashboard → Settings → Environment Variables:

### Frontend Environment Variables

```
VITE_API_URL=https://your-project.vercel.app/api/journal-ease
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Important**: Replace `your-project.vercel.app` with your actual Vercel deployment URL after first deployment.

### Backend Environment Variables

```
NODE_ENV=production
JWT_SECRET=your_jwt_secret_key
OPEN_AI_KEY=your_openai_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_AUDIO_BUCKET=audio
```

## Step 5: Deploy

1. Click **"Deploy"**
2. Wait for the build to complete
3. Once deployed, you'll get a URL like: `https://your-project.vercel.app`

## Step 6: Update API URL

After the first deployment:

1. Copy your Vercel deployment URL
2. Go to Vercel Dashboard → Settings → Environment Variables
3. Update `VITE_API_URL` to: `https://your-project.vercel.app/api/journal-ease`
4. Redeploy (Vercel will auto-redeploy when you save env vars, or trigger a new deployment)

## Step 7: Update CORS (if needed)

If you get CORS errors, update `backend/app.js` to include your Vercel URL in the `allowedOrigins` array:

```javascript
const allowedOrigins = [
  'https://your-project.vercel.app',
  'https://your-project-*.vercel.app', // For preview deployments
  'http://localhost:5173',
];
```

## Testing on Mobile

1. Open your Vercel deployment URL on your phone's browser
2. The app should work responsively
3. Test recording functionality (may require HTTPS for microphone access)

## Troubleshooting

### Build Fails
- Check that all dependencies are in `package.json`
- Ensure Node.js version is compatible (Vercel uses Node 18.x by default)
- Check build logs in Vercel dashboard

### API Routes Not Working
- Verify `backend/api/journal-ease/[...all].js` exists
- Check that routes are prefixed with `/api/journal-ease/`
- Review serverless function logs in Vercel dashboard

### CORS Errors
- Update `allowedOrigins` in `backend/app.js`
- Ensure `VITE_API_URL` is set correctly
- Check that API calls use the correct base URL

### Environment Variables Not Loading
- Ensure variables are prefixed with `VITE_` for frontend
- Check that variables are set for the correct environment (Production/Preview/Development)
- Redeploy after adding new variables

## Additional Notes

- Vercel automatically creates preview deployments for each branch/PR
- The main branch deploys to production automatically
- You can set up custom domains in Vercel settings
- Check function logs in Vercel dashboard for debugging
