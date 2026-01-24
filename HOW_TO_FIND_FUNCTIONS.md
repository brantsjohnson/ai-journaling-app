# How to Find Serverless Functions in Vercel

## Option 1: Check the Deployment Page Tabs

On your deployment details page, look at the **top tabs**:
- Deployment
- **Logs** ← Check here first!
- Resources
- Source
- Open Graph

The **Logs** tab will show function invocations and errors.

## Option 2: Check the Resources Tab

1. Click on the **"Resources"** tab on the deployment page
2. Look for a section called **"Serverless Functions"** or **"Functions"**
3. You should see `/api/journal-ease/[...all]` listed if it's detected

## Option 3: Check Runtime Logs

1. Scroll down on the deployment page
2. Look for the **"Runtime Logs"** card
3. Click **"View Logs"** or **"Open"**
4. This will show all function invocations and console.log output

## Option 4: Use the Logs Section (Left Sidebar)

1. In the left sidebar, click **"Logs"**
2. This shows all logs across all deployments
3. Filter by function name or search for your API calls

## Option 5: Check if Function is Detected

If you don't see the function anywhere, Vercel might not be detecting it. To verify:

1. Go to **Settings** → **General**
2. Check the **Root Directory** - should be `.` (root)
3. Make sure the `api/` folder is at the root level (not in `backend/`)

## Quick Test

Try making a request to your API:
- Open browser console
- Try: `fetch('/api/journal-ease/auth/login', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({email: 'test@test.com', password: 'test'})})`
- Then check the **Logs** tab - you should see the function being invoked

## If Function Still Not Showing

The function might not be building correctly. Check:
1. **Build Logs** on the deployment page - look for errors
2. Make sure `api/journal-ease/[...all].js` exists in your repo
3. Verify the file was committed and pushed to GitHub
