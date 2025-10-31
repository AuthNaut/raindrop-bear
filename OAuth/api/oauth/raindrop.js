/**
 * OAuth Initiation Handler
 * 
 * This endpoint initiates the OAuth flow by redirecting the user
 * to Raindrop's authorization page.
 * 
 * GET /api/oauth/raindrop?state={extensionId}
 */

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { state } = req.query;
  
  // Validate state parameter contains extension ID
  if (!state) {
    return res.status(400).json({ error: 'Missing state parameter' });
  }

  // Raindrop OAuth Configuration
  const RAINDROP_CLIENT_ID = process.env.RAINDROP_CLIENT_ID;
  const RAINDROP_CLIENT_SECRET = process.env.RAINDROP_CLIENT_SECRET;
  const BASE_URL = process.env.BASE_URL || process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'https://your-domain.com';

  if (!RAINDROP_CLIENT_ID) {
    console.error('RAINDROP_CLIENT_ID is not set');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Build authorization URL
  const redirectUri = `${BASE_URL}/api/oauth/raindrop/callback`;
  const authUrl = new URL('https://app.raindrop.io/oauth/authorize');
  authUrl.searchParams.set('client_id', RAINDROP_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('state', state); // Preserve extension ID

  console.log('Redirecting to Raindrop OAuth:', authUrl.toString());

  // Redirect to Raindrop OAuth page
  res.redirect(302, authUrl.toString());
}

