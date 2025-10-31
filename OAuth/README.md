# Raindrop OAuth Proxy Service

This is a standalone OAuth proxy service for the Raindrop Bear Chrome extension. It handles the OAuth flow between the extension and Raindrop, allowing you to maintain full control over the authentication process.

## 📁 Project Structure

```
OAuth/
├── api/
│   └── oauth/
│       └── raindrop/
│           ├── raindrop.js          # OAuth initiation endpoint
│           ├── callback.js          # OAuth callback handler
│           └── refresh.js            # Token refresh endpoint
├── vercel.json                       # Vercel configuration
├── package.json                      # Node.js dependencies
├── .gitignore                        # Git ignore rules
├── README.md                         # This file
└── VERCEL_SETUP.md                  # Detailed Vercel setup guide
```

## 🚀 Quick Start

1. **Register Raindrop OAuth App**:
   - Go to [Raindrop OAuth settings](https://app.raindrop.io/settings/integrations)
   - Create a new OAuth application
   - Set redirect URI to: `https://your-project.vercel.app/api/oauth/raindrop/callback`
   - Copy Client ID and Client Secret

2. **Deploy to Vercel**:
   ```bash
   cd OAuth
   vercel login
   vercel
   ```

3. **Configure Environment Variables** in Vercel Dashboard:
   - `RAINDROP_CLIENT_ID` - Your Raindrop OAuth Client ID
   - `RAINDROP_CLIENT_SECRET` - Your Raindrop OAuth Client Secret
   - `BASE_URL` (optional) - Your Vercel URL or custom domain

4. **Update Chrome Extension**:
   - Update OAuth URLs in extension code
   - Update `manifest.json` with your Vercel URL
   - Reload extension

See [VERCEL_SETUP.md](./VERCEL_SETUP.md) for detailed instructions.

## 📋 Environment Variables

Required environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `RAINDROP_CLIENT_ID` | Your Raindrop OAuth Client ID | `abc123def456...` |
| `RAINDROP_CLIENT_SECRET` | Your Raindrop OAuth Client Secret | `xyz789uvw012...` |
| `BASE_URL` | Base URL of your deployment (optional) | `https://raindrop-oauth.vercel.app` |

**Note**: For Vercel, `BASE_URL` can be automatically determined from `VERCEL_URL`. Only set `BASE_URL` if you're using a custom domain.

## 🔗 Endpoints

### GET `/api/oauth/raindrop`
Initiates OAuth flow by redirecting to Raindrop authorization page.

**Query Parameters:**
- `state` - JSON-encoded extension ID: `{"extensionId":"your-extension-id"}`

**Example:**
```
GET /api/oauth/raindrop?state=%7B%22extensionId%22%3A%22abcdefghijklmnop%22%7D
```

### GET `/api/oauth/raindrop/callback`
Handles OAuth callback from Raindrop, exchanges code for tokens, and sends tokens to extension.

**Query Parameters:**
- `code` - Authorization code from Raindrop
- `state` - Original state parameter with extension ID

### POST `/api/oauth/raindrop/refresh`
Refreshes an expired OAuth access token.

**Request Body:**
```json
{
  "refresh_token": "your-refresh-token"
}
```

**Response:**
```json
{
  "access_token": "new-access-token",
  "refresh_token": "new-refresh-token",
  "expires_in": 1209600,
  "token_type": "Bearer"
}
```

## 🔒 Security

- ✅ Tokens are **never stored** on the server
- ✅ Tokens are sent **directly** to the extension
- ✅ Service acts as a **pass-through proxy**
- ✅ HTTPS required (automatic on Vercel)
- ✅ State parameter validation

## 🧪 Testing

### Test OAuth Flow Locally

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Create `.env.local`** (not committed):
   ```bash
   RAINDROP_CLIENT_ID=your_client_id
   RAINDROP_CLIENT_SECRET=your_client_secret
   BASE_URL=http://localhost:3000
   ```

3. **Run locally**:
   ```bash
   vercel dev
   ```

4. **Test endpoints** at `http://localhost:3000`

### Test in Production

1. Deploy to Vercel
2. Test OAuth URL with your extension ID
3. Verify tokens are received by extension

## 📝 Message Format

The service sends this format to the Chrome extension:

```javascript
{
  type: 'oauth_success',
  provider: 'raindrop',
  tokens: {
    access_token: '...',
    refresh_token: '...',
    expires_in: 1209600,  // seconds
    token_type: 'Bearer'
  }
}
```

## 🔧 Development

### Local Development

```bash
# Install Vercel CLI
npm i -g vercel

# Run locally
vercel dev

# Server will run on http://localhost:3000
```

### Deploy

```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

## 📚 Documentation

- **[VERCEL_SETUP.md](./VERCEL_SETUP.md)** - Complete Vercel setup guide
- **[Raindrop API Docs](../references/raindrop%20api/)** - Raindrop API documentation

## 🐛 Troubleshooting

### Common Issues

1. **"Server configuration error"**
   - Check environment variables are set in Vercel
   - Redeploy after adding variables

2. **"Extension not receiving message"**
   - Verify `externally_connectable` in extension manifest
   - Check extension ID matches state parameter

3. **"Token refresh failing"**
   - Verify refresh token is valid
   - Check Client ID/Secret are correct

See [VERCEL_SETUP.md](./VERCEL_SETUP.md) for detailed troubleshooting.

## 📄 License

MIT

## 🔗 Links

- [Vercel Documentation](https://vercel.com/docs)
- [Raindrop API Documentation](https://developer.raindrop.io/)
- [Chrome Extension External Messaging](https://developer.chrome.com/docs/extensions/mv3/messaging/#external)

