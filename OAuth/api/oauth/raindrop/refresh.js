/**
 * OAuth Token Refresh Handler
 * 
 * This endpoint refreshes an expired OAuth access token using a refresh token.
 * 
 * POST /api/oauth/raindrop/refresh
 * Body: { refresh_token: "..." }
 * 
 * Returns: {
 *   access_token: "...",
 *   refresh_token: "...",
 *   expires_in: 1209600,
 *   token_type: "Bearer"
 * }
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(400).json({ error: 'Missing refresh_token in request body' });
  }

  try {
    // Get configuration
    const RAINDROP_CLIENT_ID = process.env.RAINDROP_CLIENT_ID;
    const RAINDROP_CLIENT_SECRET = process.env.RAINDROP_CLIENT_SECRET;

    if (!RAINDROP_CLIENT_ID || !RAINDROP_CLIENT_SECRET) {
      console.error('Missing OAuth credentials');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    console.log('Refreshing OAuth token...');

    // Exchange refresh token for new tokens
    const tokenResponse = await fetch('https://api.raindrop.io/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: RAINDROP_CLIENT_ID,
        client_secret: RAINDROP_CLIENT_SECRET,
        refresh_token: refresh_token,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token refresh failed:', tokenResponse.status, errorText);
      
      // Return appropriate error
      if (tokenResponse.status === 401 || tokenResponse.status === 403) {
        return res.status(401).json({ 
          error: 'Invalid refresh token. Please re-authenticate.' 
        });
      }
      
      return res.status(tokenResponse.status).json({ 
        error: `Token refresh failed: ${tokenResponse.statusText}` 
      });
    }

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      console.error('Invalid token response:', tokenData);
      return res.status(500).json({ error: 'Invalid token response from Raindrop' });
    }

    console.log('Token refresh successful');

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    // Return new tokens
    res.status(200).json({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || refresh_token, // Use new refresh_token if provided, otherwise keep old one
      expires_in: tokenData.expires_in || 1209600, // Default 14 days
      token_type: tokenData.token_type || 'Bearer',
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({ 
      error: error.message || 'Internal server error' 
    });
  }
}

