# Quick Vercel Deployment Guide

## 🚀 Deploy in 5 Steps

### Step 1: Push to GitHub
```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

### Step 2: Import to Vercel
1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New..."** → **"Project"**
3. Import your GitHub repository
4. Click **"Deploy"** (we'll configure settings after)

### Step 3: Configure Build Settings
In Vercel Dashboard → Settings → General:
- **Root Directory**: Leave as root (`.`)
- **Framework Preset**: Vite
- **Build Command**: `cd frontend && npm install && npm run build`
- **Output Directory**: `frontend/dist`
- **Install Command**: `npm install` (in root, or leave default)

### Step 4: Add Environment Variables
Go to **Settings → Environment Variables** and add:

#### Frontend Variables (prefix with `VITE_`):
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Note**: After first deployment, add:
```
VITE_API_URL=https://your-project.vercel.app/api/journal-ease
```
(Replace `your-project` with your actual Vercel URL)

#### Backend Variables:
```
NODE_ENV=production
JWT_SECRET=your_jwt_secret
OPEN_AI_KEY=your_openai_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_AUDIO_BUCKET=audio
```

### Step 5: Redeploy
1. After adding environment variables, go to **Deployments**
2. Click the **three dots** (⋯) on the latest deployment
3. Click **"Redeploy"**
4. Or push a new commit to trigger auto-deploy

## 📱 Testing on Mobile

1. Copy your Vercel deployment URL (e.g., `https://your-project.vercel.app`)
2. Open it on your phone's browser
3. The app should work! 🎉

## ⚠️ Important Notes

- **API Routes**: Vercel automatically detects `backend/api/journal-ease/[...all].js` as a serverless function
- **CORS**: Already configured to allow all `.vercel.app` domains
- **HTTPS**: Required for microphone access on mobile devices
- **First Deploy**: You may need to update `VITE_API_URL` after the first deployment with your actual URL

## 🔧 Troubleshooting

**Build fails?**
- Check build logs in Vercel dashboard
- Ensure all dependencies are in `package.json`

**API not working?**
- Verify `VITE_API_URL` is set correctly
- Check serverless function logs in Vercel dashboard
- Ensure environment variables are set for "Production"

**CORS errors?**
- The backend already allows all `.vercel.app` domains
- Make sure `VITE_API_URL` matches your deployment URL

## 🎯 Quick Checklist

- [ ] Code pushed to GitHub
- [ ] Project imported to Vercel
- [ ] Build settings configured
- [ ] Environment variables added
- [ ] First deployment successful
- [ ] `VITE_API_URL` updated with actual URL
- [ ] Tested on mobile device

That's it! Your app should be live! 🚀
