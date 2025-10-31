/**
 * OAuth Callback Handler
 * 
 * This endpoint handles the OAuth callback from Raindrop, exchanges
 * the authorization code for tokens, and sends them to the Chrome extension.
 * 
 * GET /api/oauth/raindrop/callback?code={authCode}&state={extensionId}
 */

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, state, error } = req.query;

  // Handle OAuth errors from Raindrop
  if (error) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>OAuth Error</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background: #f5f5f5;
              color: #333;
            }
            .container {
              text-align: center;
              padding: 2rem;
              background: white;
              border-radius: 8px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            .error {
              color: #ef4444;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="error">OAuth Error</h1>
            <p>Authorization was denied or failed.</p>
            <p style="font-size: 0.9em; color: #666;">Error: ${error}</p>
            <p style="margin-top: 1rem;">
              <a href="javascript:window.close()">Close this window</a>
            </p>
          </div>
        </body>
      </html>
    `);
  }

  if (!code) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>OAuth Error</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background: #f5f5f5;
              color: #333;
            }
            .container {
              text-align: center;
              padding: 2rem;
              background: white;
              border-radius: 8px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            .error {
              color: #ef4444;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="error">OAuth Error</h1>
            <p>Missing authorization code. Please try again.</p>
            <p style="margin-top: 1rem;">
              <a href="javascript:window.close()">Close this window</a>
            </p>
          </div>
        </body>
      </html>
    `);
  }

  try {
    // Get configuration
    const RAINDROP_CLIENT_ID = process.env.RAINDROP_CLIENT_ID;
    const RAINDROP_CLIENT_SECRET = process.env.RAINDROP_CLIENT_SECRET;
    const BASE_URL = process.env.BASE_URL || process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'https://your-domain.com';

    if (!RAINDROP_CLIENT_ID || !RAINDROP_CLIENT_SECRET) {
      throw new Error('Server configuration error: Missing OAuth credentials');
    }

    const redirectUri = `${BASE_URL}/api/oauth/raindrop/callback`;

    // Exchange authorization code for tokens
    console.log('Exchanging authorization code for tokens...');
    const tokenResponse = await fetch('https://api.raindrop.io/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: RAINDROP_CLIENT_ID,
        client_secret: RAINDROP_CLIENT_SECRET,
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', tokenResponse.status, errorText);
      throw new Error(`Token exchange failed: ${tokenResponse.statusText}`);
    }

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token || !tokenData.refresh_token) {
      throw new Error('Invalid token response from Raindrop');
    }

    // Parse state to get extension ID
    let extensionId = null;
    try {
      if (state) {
        const stateData = JSON.parse(decodeURIComponent(state));
        extensionId = stateData.extensionId;
      }
    } catch (e) {
      console.error('Failed to parse state:', e);
    }

    console.log('Token exchange successful, sending to extension:', extensionId);

    // Sanitize tokens for HTML (basic XSS prevention)
    const accessToken = String(tokenData.access_token).replace(/['"\\]/g, '');
    const refreshToken = String(tokenData.refresh_token).replace(/['"\\]/g, '');
    const expiresIn = tokenData.expires_in || 1209600; // Default 14 days
    const tokenType = (tokenData.token_type || 'Bearer').replace(/['"\\]/g, '');

    // Send success page with message script
    res.setHeader('Content-Type', 'text/html');
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>OAuth Success</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
            }
            .container {
              text-align: center;
              padding: 2rem;
              background: rgba(255, 255, 255, 0.1);
              border-radius: 12px;
              backdrop-filter: blur(10px);
              box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            }
            .spinner {
              border: 3px solid rgba(255,255,255,0.3);
              border-radius: 50%;
              border-top: 3px solid white;
              width: 40px;
              height: 40px;
              animation: spin 1s linear infinite;
              margin: 0 auto 1rem;
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            h1 {
              margin: 0 0 0.5rem 0;
              font-size: 1.5rem;
            }
            p {
              margin: 0.5rem 0;
              opacity: 0.9;
            }
            .success {
              margin-top: 1rem;
              font-size: 0.9em;
              opacity: 0.8;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="spinner"></div>
            <h1>Authorization Successful!</h1>
            <p>Connecting to extension...</p>
            <p class="success" id="status">This window will close automatically.</p>
          </div>
          <script>
            (function() {
              // Prepare message for extension
              const message = {
                type: 'oauth_success',
                provider: 'raindrop',
                tokens: {
                  access_token: ${JSON.stringify(accessToken)},
                  refresh_token: ${JSON.stringify(refreshToken)},
                  expires_in: ${expiresIn},
                  token_type: ${JSON.stringify(tokenType)}
                }
              };

              // Parse extension ID from state
              const stateData = ${JSON.stringify({ extensionId: extensionId || '' })};
              const extensionId = stateData.extensionId;

              const statusEl = document.getElementById('status');
              
              if (extensionId) {
                try {
                  // Send message to Chrome extension via external messaging API
                  chrome.runtime.sendMessage(
                    extensionId,
                    message,
                    function(response) {
                      console.log('Message sent to extension:', response);
                      if (response && response.success) {
                        statusEl.textContent = 'Success! You can close this window.';
                        setTimeout(function() {
                          window.close();
                        }, 1500);
                      } else {
                        statusEl.textContent = 'Please return to the extension and refresh.';
                      }
                    }
                  );
                } catch (error) {
                  console.error('Failed to send message to extension:', error);
                  statusEl.textContent = 'Please return to the extension and refresh.';
                  statusEl.innerHTML += '<br><small>You can close this window manually.</small>';
                }
              } else {
                console.error('Extension ID not found in state parameter');
                statusEl.textContent = 'Extension ID not found. Please return to the extension.';
                statusEl.innerHTML += '<br><small>You can close this window manually.</small>';
              }
            })();
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>OAuth Error</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background: #f5f5f5;
              color: #333;
            }
            .container {
              text-align: center;
              padding: 2rem;
              background: white;
              border-radius: 8px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
              max-width: 500px;
            }
            .error {
              color: #ef4444;
            }
            code {
              background: #f5f5f5;
              padding: 0.2em 0.4em;
              border-radius: 3px;
              font-size: 0.9em;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="error">OAuth Error</h1>
            <p>Failed to complete authorization.</p>
            <p style="font-size: 0.9em; color: #666;">
              <code>${error.message}</code>
            </p>
            <p style="margin-top: 1rem;">
              <a href="javascript:window.close()">Close this window</a>
            </p>
          </div>
        </body>
      </html>
    `);
  }
}

