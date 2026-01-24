# Simple Deployment Steps

## ✅ Step 1: Git is Ready!
Your code is now saved in git. ✓

## 📤 Step 2: Create GitHub Repository

1. Go to https://github.com in your web browser
2. Sign in (or create an account if you don't have one)
3. Click the **"+"** button in the top right corner
4. Click **"New repository"**
5. Name it: `ai-journaling-app` (or any name you like)
6. Make it **Public** or **Private** (your choice)
7. **DO NOT** check "Initialize with README" (we already have code)
8. Click **"Create repository"**

## 🔗 Step 3: Connect Your Code to GitHub

After creating the repository, GitHub will show you commands. 
But I'll give you the exact commands to run here:

Copy and paste these commands one at a time in your terminal:

```bash
cd /Users/brantsjohnson/Desktop/ai-journaling-app-main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

**Important**: Replace `YOUR_USERNAME` with your GitHub username and `YOUR_REPO_NAME` with the repository name you created.

## 🚀 Step 4: Deploy to Vercel

1. Go to https://vercel.com in your web browser
2. Sign in (or create an account - you can use your GitHub account!)
3. Click **"Add New..."** → **"Project"**
4. Find your repository and click **"Import"**
5. Vercel will auto-detect your settings - just click **"Deploy"**
6. Wait 2-3 minutes for it to build
7. You'll get a URL like: `https://your-app-name.vercel.app`

## ⚙️ Step 5: Add Environment Variables (Important!)

After the first deployment, you need to add your secret keys:

1. In Vercel, go to your project
2. Click **"Settings"** → **"Environment Variables"**
3. Add these one by one (you'll need to get the values from your `.env` file):

**Frontend Variables:**
- `VITE_SUPABASE_URL` = (your Supabase URL)
- `VITE_SUPABASE_ANON_KEY` = (your Supabase anon key)

**Backend Variables:**
- `NODE_ENV` = `production`
- `JWT_SECRET` = (your JWT secret)
- `OPEN_AI_KEY` = (your OpenAI API key)
- `SUPABASE_URL` = (your Supabase URL)
- `SUPABASE_SERVICE_ROLE_KEY` = (your service role key)
- `SUPABASE_ANON_KEY` = (your anon key)
- `SUPABASE_AUDIO_BUCKET` = `audio`

4. After adding all variables, go to **"Deployments"** tab
5. Click the **three dots** (⋯) on the latest deployment
6. Click **"Redeploy"**

## 📱 Step 6: Update API URL

After redeploying, you need to update one more variable:

1. Copy your Vercel URL (e.g., `https://your-app-name.vercel.app`)
2. Go back to **Settings** → **Environment Variables**
3. Add or update: `VITE_API_URL` = `https://your-app-name.vercel.app/api/journal-ease`
4. Redeploy again

## 🎉 Done!

Your app should now work on your phone! Just open the Vercel URL in your phone's browser.
