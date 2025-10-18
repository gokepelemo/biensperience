# OAuth Social Login Setup Guide

## Overview
Biensperience now supports social login via Facebook, Google, and Twitter using Passport.js. This guide walks you through setting up OAuth authentication.

## Prerequisites
- Node.js and npm installed
- MongoDB database
- Developer accounts with Facebook, Google, and Twitter

## Step 1: Register OAuth Applications

### Facebook App Setup
1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app or use existing
3. Navigate to **Settings > Basic**
4. Copy your **App ID** and **App Secret**
5. Add OAuth Redirect URI:
   - Development: `http://localhost:3001/api/auth/facebook/callback`
   - Production: `https://yourdomain.com/api/auth/facebook/callback`
6. Enable **Facebook Login** product

### Google OAuth Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Navigate to **APIs & Services > Credentials**
4. Create **OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Add Authorized redirect URIs:
   - Development: `http://localhost:3001/api/auth/google/callback`
   - Production: `https://yourdomain.com/api/auth/google/callback`
7. Copy your **Client ID** and **Client Secret**

### Twitter App Setup
1. Go to [Twitter Developer Portal](https://developer.twitter.com/)
2. Create a new app or use existing
3. Navigate to app settings
4. Enable **3-legged OAuth**
5. Add Callback URL:
   - Development: `http://localhost:3001/api/auth/twitter/callback`
   - Production: `https://yourdomain.com/api/auth/twitter/callback`
6. Request email permission (Settings > User authentication settings)
7. Copy your **API Key** and **API Secret Key**

## Step 2: Configure Environment Variables

Create or update `.env` file in your project root:

```env
# Existing variables...
SECRET=your_jwt_secret_here

# Facebook OAuth
FACEBOOK_APP_ID=your_facebook_app_id_here
FACEBOOK_APP_SECRET=your_facebook_app_secret_here
FACEBOOK_CALLBACK_URL=http://localhost:3001/api/auth/facebook/callback

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id_here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback

# Twitter OAuth
TWITTER_CONSUMER_KEY=your_twitter_api_key_here
TWITTER_CONSUMER_SECRET=your_twitter_api_secret_here
TWITTER_CALLBACK_URL=http://localhost:3001/api/auth/twitter/callback
```

**Important**: Never commit `.env` file to version control!

## Step 3: Test OAuth Locally

### Start Development Server
```bash
npm start
```

### Test OAuth Flows

1. **New User Signup via OAuth**:
   - Navigate to `/login` or `/signup`
   - Click "Sign in with Facebook/Google/Twitter"
   - Authorize the application
   - Should redirect back with user logged in
   - Check MongoDB - new user should be created

2. **Existing User Login**:
   - Create a user manually with email
   - Use OAuth with same email
   - Accounts should automatically link

3. **Account Linking** (Future Feature):
   - Log in with local account
   - Go to profile settings
   - Click "Connect Facebook/Google/Twitter"
   - Accounts should link

## OAuth User Flow

### New User Journey
```
1. User clicks "Sign in with Facebook"
   ↓
2. Redirects to Facebook OAuth page
   ↓
3. User authorizes app
   ↓
4. Facebook redirects to callback URL with auth code
   ↓
5. Backend exchanges code for access token
   ↓
6. Fetches user profile from Facebook
   ↓
7. Creates new user in MongoDB with facebookId
   ↓
8. Generates JWT token
   ↓
9. Redirects to frontend with token
   ↓
10. Frontend stores token and fetches user data
```

### Existing User Login
```
1. User clicks "Sign in with Google"
   ↓
2. OAuth flow (same as above)
   ↓
3. Backend finds existing user by googleId or email
   ↓
4. Links account if not already linked
   ↓
5. Generates JWT token
   ↓
6. User logged in
```

## Database Changes

### User Model Updates
The User model now includes:
- `facebookId`: String (unique, sparse)
- `googleId`: String (unique, sparse)
- `twitterId`: String (unique, sparse)
- `provider`: Enum ['local', 'facebook', 'google', 'twitter']
- `oauthProfilePhoto`: String (URL to OAuth profile photo)
- `linkedAccounts`: Array of linked social accounts
- `password`: Now optional for OAuth users

### Migration Notes
- Existing users are unaffected
- OAuth users can optionally set passwords later
- Accounts auto-link on email match

## API Endpoints

### Authentication Endpoints
- `GET /api/auth/facebook` - Initiate Facebook OAuth
- `GET /api/auth/facebook/callback` - Facebook callback
- `GET /api/auth/google` - Initiate Google OAuth
- `GET /api/auth/google/callback` - Google callback
- `GET /api/auth/twitter` - Initiate Twitter OAuth
- `GET /api/auth/twitter/callback` - Twitter callback

### Account Management (Future)
- `GET /api/auth/link/:provider` - Link social account (requires authentication)
- `DELETE /api/auth/unlink/:provider` - Unlink social account
- `GET /api/auth/linked-accounts` - Get user's linked accounts

## Frontend Components

### SocialLoginButtons Component
Located: `src/components/SocialLoginButtons/SocialLoginButtons.jsx`

**Usage:**
```jsx
import SocialLoginButtons from '../components/SocialLoginButtons/SocialLoginButtons';

// In login/signup form
<SocialLoginButtons />

// For account linking
<SocialLoginButtons isLinking={true} buttonText="Connect to" />
```

**Props:**
- `isLinking`: Boolean - Use linking endpoints vs login endpoints
- `buttonText`: String - Button text prefix (default: "Sign in with")
- `showDivider`: Boolean - Show "OR" divider (default: true)

### OAuth Utilities
Located: `src/utilities/oauth-service.js`

Functions:
- `handleOAuthCallback()` - Process OAuth callback tokens
- `getLinkedAccounts()` - Fetch linked accounts
- `unlinkAccount(provider)` - Unlink social account
- `linkAccount(provider)` - Initiate account linking

## Security Considerations

### CSRF Protection
- OAuth state parameter validation (TODO)
- Session-based CSRF tokens (TODO)

### Token Security
- JWT tokens expire in 24 hours
- Tokens stored in localStorage
- Secure HTTP-only cookies recommended for production

### Email Verification
- OAuth emails are pre-verified by providers
- Consider adding email verification for local accounts

### Account Conflicts
- Duplicate email handling: Auto-links to existing account
- Provider ID conflicts: Returns error
- Password requirement: Optional for OAuth, but recommended

## Troubleshooting

### Common Issues

**Issue**: "OAuth callback failed"
- **Solution**: Check callback URLs match exactly in provider settings
- Verify environment variables are set correctly
- Check server logs for detailed error

**Issue**: "User not found after OAuth"
- **Solution**: Ensure passport strategies are properly initialized
- Check MongoDB connection
- Verify User model has OAuth fields

**Issue**: "Token not stored"
- **Solution**: Check browser localStorage
- Verify JWT_SECRET is set
- Check token expiration

**Issue**: "Facebook: Can't Load URL"
- **Solution**: App must be in "Development" or "Live" mode
- Callback URL must use HTTPS in production
- Add domain to Facebook app settings

**Issue**: "Google: redirect_uri_mismatch"
- **Solution**: Exact match required for redirect URIs
- Check for trailing slashes
- Verify protocol (http vs https)

**Issue**: "Twitter: Callback URL not approved"
- **Solution**: Enable 3-legged OAuth in Twitter app settings
- Request email permissions
- Use exact callback URL

### Debugging

Enable debug mode:
```bash
DEBUG=passport:* npm start
```

Check logs:
- Browser console for frontend errors
- Terminal for backend logs
- Network tab for OAuth redirects

## Production Deployment

### Pre-Deployment Checklist
- [ ] Update OAuth callback URLs to production domain
- [ ] Set environment variables in production
- [ ] Enable HTTPS (required by most OAuth providers)
- [ ] Configure CORS for production domain
- [ ] Set secure session cookies
- [ ] Enable rate limiting on auth endpoints
- [ ] Add CSRF protection
- [ ] Monitor OAuth error rates

### Environment Variables for Production
```env
# Production URLs
CLIENT_ORIGIN=https://yourdomain.com
FACEBOOK_CALLBACK_URL=https://yourdomain.com/api/auth/facebook/callback
GOOGLE_CALLBACK_URL=https://yourdomain.com/api/auth/google/callback
TWITTER_CALLBACK_URL=https://yourdomain.com/api/auth/twitter/callback
NODE_ENV=production
```

### SSL/HTTPS Required
Most OAuth providers require HTTPS in production:
- Facebook: HTTPS required for App Domains
- Google: Allows HTTP only for localhost
- Twitter: HTTPS recommended

## Testing

### Manual Testing Checklist
- [ ] New user signup via Facebook
- [ ] New user signup via Google
- [ ] New user signup via Twitter
- [ ] Existing user login via Facebook
- [ ] Existing user login via Google
- [ ] Existing user login via Twitter
- [ ] Email auto-linking works
- [ ] JWT token generation works
- [ ] User data populates correctly
- [ ] Profile photos load from OAuth
- [ ] Error handling for failed OAuth
- [ ] Logout and re-login works
- [ ] Token expiration handling

### Integration Tests
Create tests for:
- OAuth callback handling
- User creation/linking logic
- Token generation
- Error scenarios

## Future Enhancements

### Account Linking UI
- Profile settings page with linked accounts
- "Connect Facebook/Google/Twitter" buttons
- Unlink account functionality
- Show linked account status

### Password Management
- "Set Password" for OAuth users
- "Forgot Password" flow
- Security settings page

### Additional Providers
- Microsoft/Outlook
- LinkedIn
- GitHub
- Apple Sign In

### Enhanced Security
- Two-factor authentication
- OAuth scope management
- Session management dashboard
- Activity log

## Support

### Documentation
- [Passport.js Documentation](http://www.passportjs.org/)
- [Facebook Login Documentation](https://developers.facebook.com/docs/facebook-login)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Twitter OAuth Documentation](https://developer.twitter.com/en/docs/authentication/oauth-2-0)

### Questions?
- Check existing issues in repository
- Review server logs for errors
- Test with OAuth provider's debug tools
- Verify environment configuration

## Next Steps

1. **Get OAuth Credentials**: Register apps with Facebook, Google, Twitter
2. **Configure Environment**: Add credentials to `.env`
3. **Test Locally**: Verify each OAuth flow works
4. **Update UI**: Customize button styling if needed
5. **Deploy**: Update production OAuth settings
6. **Monitor**: Watch for OAuth errors in logs
