# Vercel Setup Guide for Raindrop OAuth Service

This guide walks you through deploying the Raindrop OAuth proxy service on Vercel.

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com) (free tier works)
2. **Raindrop OAuth App**: Register at [Raindrop OAuth settings](https://app.raindrop.io/settings/integrations)
3. **GitHub Account** (recommended for automatic deployments)

## Step 1: Register Raindrop OAuth App

1. Go to [Raindrop OAuth settings](https://app.raindrop.io/settings/integrations)
2. Click "Create Application" or "Add Integration"
3. Fill in the form:
   - **Name**: `Raindrop Bear` (or your preferred name)
   - **Redirect URI**: We'll set this after deploying (e.g., `https://your-project.vercel.app/api/oauth/raindrop/callback`)
   - **Description**: `OAuth proxy for Raindrop Bear Chrome extension`
4. Click "Create" or "Save"
5. **Important**: Copy and save:
   - **Client ID**
   - **Client Secret** (only shown once!)

## Step 2: Deploy to Vercel

### Option A: Deploy via Vercel CLI (Recommended)

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Navigate to the OAuth folder**:
   ```bash
   cd OAuth
   ```

3. **Login to Vercel**:
   ```bash
   vercel login
   ```

4. **Deploy**:
   ```bash
   vercel
   ```

5. Follow the prompts:
   - Link to existing project? **No**
   - Project name: `raindrop-oauth-proxy` (or your choice)
   - Directory: **./** (current directory)
   - Override settings? **No**

6. **Note your deployment URL**: 
   - Example: `https://raindrop-oauth-proxy.vercel.app`
   - Or custom domain if you have one

### Option B: Deploy via GitHub

1. **Create a GitHub repository**:
   - Go to GitHub and create a new repository
   - Don't initialize with README (or commit this folder first)

2. **Push your code**:
   ```bash
   cd OAuth
   git init
   git add .
   git commit -m "Initial commit: OAuth proxy service"
   git branch -M main
   git remote add origin https://github.com/yourusername/raindrop-oauth.git
   git push -u origin main
   ```

3. **Import to Vercel**:
   - Go to [vercel.com/dashboard](https://vercel.com/dashboard)
   - Click "Add New..." → "Project"
   - Import your GitHub repository
   - Configure:
     - **Framework Preset**: Other
     - **Root Directory**: `./`
     - Click "Deploy"

## Step 3: Configure Environment Variables

1. **Go to Vercel Dashboard**:
   - Open your project: `https://vercel.com/[your-username]/[project-name]`
   - Click "Settings" → "Environment Variables"

2. **Add Environment Variables**:

   | Name | Value | Environment |
   |------|-------|-------------|
   | `RAINDROP_CLIENT_ID` | Your Client ID from Step 1 | Production, Preview, Development |
   | `RAINDROP_CLIENT_SECRET` | Your Client Secret from Step 1 | Production, Preview, Development |
   | `BASE_URL` | Your Vercel URL (optional) | Production, Preview, Development |

   **Note**: For `BASE_URL`:
   - If using default Vercel domain: `https://your-project.vercel.app`
   - If using custom domain: `https://your-custom-domain.com`
   - Leave empty if you want to use `VERCEL_URL` automatically

3. **Save** each variable

## Step 4: Update Raindrop OAuth Redirect URI

1. Go back to [Raindrop OAuth settings](https://app.raindrop.io/settings/integrations)
2. Find your OAuth app
3. Edit the **Redirect URI**:
   - Set to: `https://your-project.vercel.app/api/oauth/raindrop/callback`
   - Replace `your-project` with your actual Vercel project name
4. **Save** the changes

## Step 5: Test the Deployment

### Test OAuth Flow

1. **Get your extension ID**:
   - Open Chrome extensions: `chrome://extensions/`
   - Enable "Developer mode"
   - Find "Raindrop Bear" extension
   - Copy the Extension ID (looks like: `abcdefghijklmnopqrstuvwxyz123456`)

2. **Test OAuth URL**:
   - Open in browser: `https://your-project.vercel.app/api/oauth/raindrop?state={"extensionId":"YOUR_EXTENSION_ID"}`
   - Replace `YOUR_EXTENSION_ID` with your actual extension ID
   - URL encode the state: `https://your-project.vercel.app/api/oauth/raindrop?state=%7B%22extensionId%22%3A%22YOUR_EXTENSION_ID%22%7D`

3. **You should be redirected to**:
   - Raindrop login/authorization page
   - After authorizing, redirected back to your callback page
   - Page should show "Authorization Successful!" and close automatically

### Test Token Refresh Endpoint

```bash
curl -X POST https://your-project.vercel.app/api/oauth/raindrop/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"YOUR_REFRESH_TOKEN"}'
```

**Note**: Replace `YOUR_REFRESH_TOKEN` with an actual refresh token from a successful OAuth flow.

## Step 6: Update Chrome Extension

1. **Update `manifest.json`**:
   ```json
   {
     "externally_connectable": {
       "matches": [
         "https://your-project.vercel.app/*",
         "http://localhost:3030/*"
       ]
     }
   }
   ```

2. **Update `src/popup.js`**:
   ```javascript
   // Find this line:
   const oauthUrl = `https://ohauth.vercel.app/oauth/raindrop?state=${encodedState}`;
   
   // Replace with:
   const oauthUrl = `https://your-project.vercel.app/api/oauth/raindrop?state=${encodedState}`;
   ```

3. **Update `src/options.js`**:
   ```javascript
   // Find this line:
   const oauthUrl = `https://ohauth.vercel.app/oauth/raindrop?state=${encodedState}`;
   
   // Replace with:
   const oauthUrl = `https://your-project.vercel.app/api/oauth/raindrop?state=${encodedState}`;
   ```

4. **Update `src/modules/raindrop.js`**:
   ```javascript
   // Find this line:
   const OAUTH_REFRESH_URL = 'https://ohauth.vercel.app/oauth/raindrop/refresh';
   
   // Replace with:
   const OAUTH_REFRESH_URL = 'https://your-project.vercel.app/api/oauth/raindrop/refresh';
   ```

5. **Reload extension**:
   - Go to `chrome://extensions/`
   - Click the reload icon on "Raindrop Bear"

## Step 7: Set Up Custom Domain (Optional)

If you want to use a custom domain:

1. **Add Domain in Vercel**:
   - Go to project Settings → Domains
   - Add your custom domain (e.g., `oauth.yourdomain.com`)
   - Follow DNS configuration instructions

2. **Update Environment Variables**:
   - Set `BASE_URL` to your custom domain: `https://oauth.yourdomain.com`

3. **Update Raindrop OAuth Redirect URI**:
   - Change redirect URI to: `https://oauth.yourdomain.com/api/oauth/raindrop/callback`

4. **Update Extension Code**:
   - Replace all instances of `your-project.vercel.app` with your custom domain

## Troubleshooting

### "Method not allowed" Error

- **Cause**: Wrong HTTP method
- **Fix**: Make sure you're using GET for `/oauth/raindrop` and POST for `/refresh`

### "Missing state parameter" Error

- **Cause**: State parameter not included in OAuth URL
- **Fix**: Make sure extension includes state with extension ID

### "Server configuration error" Error

- **Cause**: Missing environment variables
- **Fix**: 
  1. Check Vercel dashboard → Settings → Environment Variables
  2. Ensure `RAINDROP_CLIENT_ID` and `RAINDROP_CLIENT_SECRET` are set
  3. Redeploy after adding variables

### Extension Not Receiving Message

- **Cause**: Extension ID mismatch or `externally_connectable` not updated
- **Fix**:
  1. Verify extension ID in `manifest.json` matches your domain
  2. Check `externally_connectable` includes your Vercel URL
  3. Reload extension after changes

### Token Refresh Failing

- **Cause**: Invalid refresh token or expired token
- **Fix**:
  1. Re-authenticate to get new refresh token
  2. Check refresh token is valid
  3. Verify environment variables are set correctly

### CORS Errors

- **Cause**: Missing CORS headers
- **Fix**: Already handled in `vercel.json`, but verify headers are set correctly

## Security Best Practices

1. **Never commit `.env` files** - Already in `.gitignore`
2. **Use HTTPS only** - Vercel provides this automatically
3. **Rotate secrets regularly** - Update `RAINDROP_CLIENT_SECRET` if compromised
4. **Monitor usage** - Check Vercel logs for suspicious activity
5. **Rate limiting** - Consider adding rate limiting for production

## Monitoring

1. **View Logs in Vercel**:
   - Go to project → "Deployments" → Click a deployment → "Functions" tab
   - View function logs

2. **Monitor Errors**:
   - Check Vercel dashboard for failed requests
   - Review function execution logs

## Updating the Service

### Via CLI:
```bash
cd OAuth
vercel --prod
```

### Via GitHub:
- Push changes to your repository
- Vercel will automatically deploy

## Next Steps

1. ✅ Deploy to Vercel
2. ✅ Configure environment variables
3. ✅ Update Raindrop OAuth redirect URI
4. ✅ Update Chrome extension
5. ✅ Test OAuth flow
6. ✅ Test token refresh
7. ✅ (Optional) Set up custom domain
8. ✅ Monitor and maintain

## Support

- **Vercel Docs**: [vercel.com/docs](https://vercel.com/docs)
- **Raindrop API Docs**: Check `references/raindrop api/` folder
- **Issues**: Check extension logs and Vercel function logs

## Cost

Vercel Free Tier includes:
- ✅ Unlimited deployments
- ✅ 100GB bandwidth/month
- ✅ Serverless functions included
- ✅ HTTPS/SSL automatically

Perfect for personal use! 🎉

