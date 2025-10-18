# Security Implementation Quick Reference

This is a quick reference for the session management and CSRF protection implementation in Biensperience.

## Environment Variables Required

Add to your `.env` file:

```bash
# Session & CSRF Configuration
SESSION_SECRET=your_random_session_secret_here
CSRF_SECRET=your_random_csrf_secret_here
```

**Generate secure secrets**:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run twice to generate both `SESSION_SECRET` and `CSRF_SECRET`.

## How It Works

### 1. OAuth Initiation (Facebook/Google)

When user clicks "Sign in with Facebook":

```javascript
// User clicks button → Redirects to /api/auth/facebook
router.get('/facebook', (req, res, next) => {
  // 1. Generate CSRF token
  const csrfToken = generateToken(req, res);
  
  // 2. Store token in session
  req.session.oauthState = csrfToken;
  
  // 3. Send token as OAuth state parameter
  passport.authenticate('facebook', {
    state: csrfToken  // ← This gets sent to Facebook
  })(req, res, next);
});
```

### 2. OAuth Callback Validation

Facebook redirects back with state parameter:

```javascript
// Facebook redirects to /api/auth/facebook/callback?state=xxx&code=yyy
router.get('/facebook/callback',
  (req, res, next) => {
    // 1. Get state from URL
    const state = req.query.state;
    
    // 2. Get state from session
    const sessionState = req.session.oauthState;
    
    // 3. Validate they match
    if (!state || !sessionState || state !== sessionState) {
      // ❌ CSRF attack detected!
      return res.redirect('/login?error=oauth_csrf_failed');
    }
    
    // 4. Clean up session
    delete req.session.oauthState;
    
    // ✅ Validation passed, continue
    next();
  },
  // ... Passport authentication
);
```

### 3. Session Cookie Security

Sessions use secure cookies:

```javascript
session({
  secret: process.env.SESSION_SECRET,
  cookie: {
    httpOnly: true,      // Can't be accessed by JavaScript
    secure: production,  // HTTPS only in production
    sameSite: 'strict',  // Prevents CSRF via cookies
    maxAge: 24 * 60 * 60 * 1000  // 24 hours
  }
})
```

## API Endpoints

### Get CSRF Token (for future use)
```
GET /api/auth/csrf-token
```

Returns:
```json
{
  "csrfToken": "generated_token_here"
}
```

### OAuth Endpoints (with CSRF protection)
```
GET /api/auth/facebook            → Initiate OAuth (generates state)
GET /api/auth/facebook/callback   → Callback (validates state)
GET /api/auth/google              → Initiate OAuth (generates state)
GET /api/auth/google/callback     → Callback (validates state)
GET /api/auth/twitter             → Initiate OAuth (no state - OAuth 1.0a)
GET /api/auth/twitter/callback    → Callback (OAuth 1.0a has built-in protection)
```

### Account Linking Endpoints (also protected)
```
GET /api/auth/link/facebook         → Link account (generates state)
GET /api/auth/link/facebook/callback → Callback (validates state)
GET /api/auth/link/google           → Link account (generates state)
GET /api/auth/link/google/callback  → Callback (validates state)
GET /api/auth/link/twitter          → Link account
GET /api/auth/link/twitter/callback → Callback
```

## Security Features Checklist

- [x] **HTTP-Only Cookies**: JavaScript cannot access session cookies
- [x] **Secure Flag**: Cookies only sent over HTTPS in production
- [x] **SameSite Protection**: Prevents CSRF via cookie transmission
- [x] **OAuth State Validation**: Facebook and Google state parameters validated
- [x] **Session Storage**: CSRF tokens stored server-side in sessions
- [x] **Token Expiration**: Sessions expire after 24 hours
- [x] **Token Cleanup**: Sessions cleared after OAuth callback
- [x] **Error Handling**: Clear error messages for validation failures
- [x] **Twitter OAuth 1.0a**: Relies on built-in oauth_token protection

## Testing CSRF Protection

### ✅ Valid OAuth Flow (Should Work)
1. Click "Sign in with Facebook"
2. Authorize on Facebook
3. ✅ Redirected back and logged in

### ❌ Tampered State (Should Fail)
1. Initiate OAuth flow
2. Intercept callback URL: `/api/auth/facebook/callback?state=abc&code=xyz`
3. Change state parameter: `/api/auth/facebook/callback?state=TAMPERED&code=xyz`
4. ❌ Redirected to `/login?error=oauth_csrf_failed`

### ❌ Missing State (Should Fail)
1. Directly access: `/api/auth/facebook/callback?code=xyz`
2. ❌ Redirected to `/login?error=oauth_csrf_failed`

### ❌ Expired Session (Should Fail)
1. Start OAuth flow
2. Wait 24+ hours (or clear cookies)
3. Complete OAuth flow
4. ❌ Redirected to `/login?error=oauth_csrf_failed`

## Error Messages

Frontend handles these error codes in `oauth-service.js`:

```javascript
const errorMessages = {
  oauth_csrf_failed: 'Security validation failed. Please try signing in again.',
  facebook_auth_failed: 'Facebook authentication failed. Please try again.',
  google_auth_failed: 'Google authentication failed. Please try again.',
  twitter_auth_failed: 'Twitter authentication failed. Please try again.',
  // ... more errors
};
```

## Production Deployment

### Required Environment Variables
```bash
NODE_ENV=production
SESSION_SECRET=<strong-random-secret>
CSRF_SECRET=<strong-random-secret>
FACEBOOK_APP_ID=<your-facebook-app-id>
FACEBOOK_APP_SECRET=<your-facebook-app-secret>
FACEBOOK_CALLBACK_URL=https://yourdomain.com/api/auth/facebook/callback
# ... (Google, Twitter similar)
```

### HTTPS Required
- Set `NODE_ENV=production` to enable secure cookie flags
- Must use HTTPS in production (OAuth providers require it)
- Reverse proxy (nginx) should forward HTTPS headers

### Session Store (Optional but Recommended)
For production, consider using Redis or MongoDB instead of memory:

```javascript
const RedisStore = require('connect-redis')(session);
const redisClient = require('redis').createClient();

app.use(session({
  store: new RedisStore({ client: redisClient }),
  // ... other options
}));
```

## Troubleshooting

### "OAuth state mismatch" Error
**Cause**: State validation failed

**Solutions**:
- Check cookies are enabled
- Verify `SESSION_SECRET` is set in `.env`
- Ensure domain allows cross-origin cookies
- Check session middleware is loaded before auth routes

### Session Not Persisting
**Cause**: Cookie configuration issue

**Solutions**:
- Verify `NODE_ENV=production` is set in production
- Check HTTPS is properly configured
- Verify CORS allows credentials
- Check `sameSite` cookie setting

### Callback Loops
**Cause**: Repeated redirects due to failed validation

**Solutions**:
- Clear browser cookies and cache
- Check `CLIENT_ORIGIN` matches actual origin
- Verify CORS configuration
- Check browser console for errors

## Key Files

| File | Purpose |
|------|---------|
| `app.js` | Session and CSRF middleware configuration |
| `routes/api/auth.js` | OAuth routes with state validation |
| `config/passport.js` | OAuth strategies (unchanged) |
| `src/utilities/oauth-service.js` | Frontend OAuth error handling |
| `documentation/SECURITY_ENHANCEMENTS.md` | Complete security documentation |

## Summary

**What we implemented**:
- ✅ Express session with secure HTTP-only cookies
- ✅ CSRF protection via OAuth state parameter
- ✅ State validation on all OAuth callbacks
- ✅ Session cleanup after validation
- ✅ Production-ready cookie security

**What this protects against**:
- ✅ CSRF attacks on OAuth flows
- ✅ Session hijacking via XSS
- ✅ Malicious OAuth callbacks
- ✅ Account takeover via OAuth

**What this does NOT protect against**:
- ❌ XSS vulnerabilities (need CSP + sanitization)
- ❌ SQL/NoSQL injection (need input validation)
- ❌ Man-in-the-middle (need HTTPS/TLS)
- ❌ Brute force (need rate limiting)

For complete security, combine this implementation with:
- Content Security Policy (CSP)
- Rate limiting on auth endpoints
- Input validation and sanitization
- HTTPS/TLS in production
- Security headers (Helmet)
- Logging and monitoring
