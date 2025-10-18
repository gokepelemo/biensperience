# Security Enhancements - Session Management & CSRF Protection

This document details the security enhancements added to the Biensperience platform, specifically focusing on session management and CSRF (Cross-Site Request Forgery) protection for OAuth flows.

## Table of Contents
1. [Overview](#overview)
2. [Session Management](#session-management)
3. [CSRF Protection](#csrf-protection)
4. [OAuth State Parameter Validation](#oauth-state-parameter-validation)
5. [Configuration](#configuration)
6. [API Endpoints](#api-endpoints)
7. [Security Best Practices](#security-best-practices)
8. [Testing](#testing)

## Overview

The platform now implements two critical security features:

1. **Session Management**: Secure HTTP-only cookies for maintaining user sessions during OAuth flows
2. **CSRF Protection**: Token-based validation to prevent Cross-Site Request Forgery attacks

These enhancements specifically protect OAuth authentication flows and account linking operations.

## Session Management

### Implementation

**Package**: `express-session`

**Configuration** (`app.js`):
```javascript
app.use(
  session({
    secret: process.env.SESSION_SECRET || process.env.SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      httpOnly: true, // Prevents client-side JS from accessing the cookie
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    },
    name: 'biensperience.sid', // Custom session cookie name
  })
);
```

### Features

- **HTTP-Only Cookies**: Session cookies cannot be accessed via JavaScript, preventing XSS attacks
- **Secure Flag**: Cookies only transmitted over HTTPS in production
- **SameSite Protection**: 
  - `strict` in production: Cookies not sent with cross-site requests
  - `lax` in development: Allows some cross-site GET requests for development ease
- **Custom Cookie Name**: Uses `biensperience.sid` instead of default to avoid fingerprinting
- **24-Hour Expiration**: Sessions expire after one day of inactivity

### Session Data Storage

During OAuth flows, sessions temporarily store:
- `oauthState`: CSRF token for state parameter validation

Sessions are cleaned up immediately after OAuth callback validation.

## CSRF Protection

### Implementation

**Package**: `csrf-csrf` (modern replacement for deprecated `csurf`)

**Configuration** (`app.js`):
```javascript
const {
  generateToken, // Used to create a CSRF token pair
  doubleCsrfProtection, // Middleware to validate CSRF tokens
} = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || process.env.SECRET,
  cookieName: '__Host-biensperience.x-csrf-token',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    path: '/',
  },
  size: 64,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getTokenFromRequest: (req) => req.headers['x-csrf-token'],
});
```

### Features

- **Double-Submit Cookie Pattern**: Uses both cookie and header for validation
- **HTTP-Only Cookie**: CSRF token cookie protected from JavaScript access
- **64-Byte Token**: Strong random token generation
- **Selective Protection**: Only validates POST, PUT, DELETE, PATCH requests
- **Header-Based Validation**: Expects token in `X-CSRF-Token` header

### Token Generation

The `generateToken` function is exposed to routes via:
```javascript
app.set('csrfTokenGenerator', generateToken);
```

Routes can access it with:
```javascript
const generateToken = req.app.get('csrfTokenGenerator');
const csrfToken = generateToken(req, res);
```

## OAuth State Parameter Validation

### Purpose

OAuth 2.0 state parameter provides CSRF protection by ensuring the OAuth callback came from a legitimate initiation request.

### Implementation Flow

#### 1. OAuth Initiation (Facebook/Google)

```javascript
router.get('/facebook', (req, res, next) => {
  // Generate CSRF token and store in session
  const generateToken = req.app.get('csrfTokenGenerator');
  const csrfToken = generateToken(req, res);
  req.session.oauthState = csrfToken;
  
  passport.authenticate('facebook', {
    scope: ['email'],
    state: csrfToken  // Send as OAuth state parameter
  })(req, res, next);
});
```

#### 2. OAuth Callback Validation

```javascript
router.get('/facebook/callback',
  (req, res, next) => {
    // Validate state parameter matches session
    const state = req.query.state;
    const sessionState = req.session.oauthState;
    
    if (!state || !sessionState || state !== sessionState) {
      console.error('OAuth state mismatch - potential CSRF attack');
      return res.redirect('/login?error=oauth_csrf_failed');
    }
    
    // Clear session state after validation
    delete req.session.oauthState;
    next();
  },
  passport.authenticate('facebook', { ... }),
  // ... success handler
);
```

### Twitter OAuth 1.0a

Twitter uses OAuth 1.0a protocol, which has built-in CSRF protection via `oauth_token` parameter. State parameter validation is not used for Twitter, but the session is still cleaned up:

```javascript
router.get('/twitter/callback',
  (req, res, next) => {
    // Twitter OAuth 1.0a has built-in CSRF protection via oauth_token
    next();
  },
  passport.authenticate('twitter', { ... }),
  (req, res) => {
    // ... token generation
    delete req.session.oauthState; // Clean up session
    // ... redirect
  }
);
```

### Account Linking Protection

Account linking flows (for logged-in users) use the same state parameter validation:

```javascript
router.get('/link/facebook', ensureLoggedIn, (req, res, next) => {
  const generateToken = req.app.get('csrfTokenGenerator');
  const csrfToken = generateToken(req, res);
  req.session.oauthState = csrfToken;
  
  passport.authenticate('facebook', {
    scope: ['email'],
    state: csrfToken
  })(req, res, next);
});

router.get('/link/facebook/callback', ensureLoggedIn,
  (req, res, next) => {
    // Validate state parameter
    const state = req.query.state;
    const sessionState = req.session.oauthState;
    
    if (!state || !sessionState || state !== sessionState) {
      return res.redirect('/profile/settings?error=oauth_csrf_failed');
    }
    
    delete req.session.oauthState;
    next();
  },
  // ... rest of handler
);
```

## Configuration

### Environment Variables

Add to your `.env` file:

```bash
# Session & CSRF Configuration
SESSION_SECRET=your_random_session_secret_here
CSRF_SECRET=your_random_csrf_secret_here
```

**Important**: 
- Use strong random secrets (minimum 32 characters)
- Never commit secrets to version control
- Use different secrets for development and production
- Rotate secrets periodically in production

### Generate Strong Secrets

Use Node.js to generate secure random secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run this command twice to generate separate secrets for `SESSION_SECRET` and `CSRF_SECRET`.

### Production Considerations

In production:
1. **HTTPS Required**: Set `NODE_ENV=production` to enable secure cookie flags
2. **Persistent Session Store**: Consider using Redis or MongoDB for session storage instead of memory:
   ```javascript
   const RedisStore = require('connect-redis')(session);
   const redisClient = require('redis').createClient();
   
   app.use(session({
     store: new RedisStore({ client: redisClient }),
     // ... other options
   }));
   ```
3. **Separate Secrets**: Use different secrets from JWT secret
4. **Secret Rotation**: Implement periodic secret rotation strategy

## API Endpoints

### Get CSRF Token

**Endpoint**: `GET /api/auth/csrf-token`

**Description**: Returns a CSRF token for client-side requests (if needed in future)

**Response**:
```json
{
  "csrfToken": "generated_csrf_token_here"
}
```

**Example**:
```javascript
const response = await fetch('/api/auth/csrf-token');
const { csrfToken } = await response.json();
```

**Note**: Currently not required for OAuth flows as state parameter is generated server-side. This endpoint is available for future API endpoints that require CSRF protection.

## Security Best Practices

### What This Protects Against

1. **CSRF Attacks on OAuth**: 
   - Attacker cannot trick user into linking attacker's social account
   - Prevents malicious OAuth callbacks
   
2. **Session Hijacking**:
   - HTTP-only cookies prevent XSS attacks from stealing sessions
   - Secure flag ensures transmission only over HTTPS
   - SameSite prevents CSRF via session cookies

3. **Token Leakage**:
   - CSRF tokens stored in HTTP-only cookies
   - State parameter validation ensures tokens match

### What This Does NOT Protect Against

1. **XSS Vulnerabilities**: Content Security Policy (CSP) and input sanitization still required
2. **SQL/NoSQL Injection**: Input validation and parameterized queries still required
3. **Man-in-the-Middle Attacks**: HTTPS/TLS required in production
4. **Brute Force Attacks**: Rate limiting and account lockout still required

### Additional Security Recommendations

1. **Content Security Policy (CSP)**:
   ```javascript
   app.use(helmet.contentSecurityPolicy({
     directives: {
       defaultSrc: ["'self'"],
       scriptSrc: ["'self'", "'unsafe-inline'"], // Remove unsafe-inline in production
       styleSrc: ["'self'", "'unsafe-inline'"],
       imgSrc: ["'self'", "data:", "https:"],
     },
   }));
   ```

2. **Rate Limiting on OAuth Endpoints**:
   ```javascript
   const authLimiter = rateLimit({
     windowMs: 15 * 60 * 1000, // 15 minutes
     max: 5 // limit each IP to 5 requests per windowMs
   });
   
   router.get('/facebook', authLimiter, ...);
   router.get('/google', authLimiter, ...);
   router.get('/twitter', authLimiter, ...);
   ```

3. **Logging and Monitoring**:
   - Log all failed OAuth state validations
   - Monitor for suspicious patterns
   - Alert on repeated CSRF validation failures

4. **Security Headers**:
   ```javascript
   app.use(helmet()); // Sets various security headers
   ```

## Testing

### Manual Testing OAuth CSRF Protection

#### Test 1: Normal OAuth Flow (Should Succeed)

1. Start server with session enabled
2. Navigate to login page
3. Click "Sign in with Facebook" (or Google)
4. Complete OAuth flow
5. ✅ Should successfully log in

#### Test 2: State Parameter Tampering (Should Fail)

1. Start OAuth flow
2. Intercept callback URL
3. Modify `state` parameter in URL
4. Submit modified URL
5. ✅ Should redirect to `/login?error=oauth_csrf_failed`

#### Test 3: Missing State Parameter (Should Fail)

1. Directly access callback URL: `/api/auth/facebook/callback?code=xxx`
2. ✅ Should redirect to `/login?error=oauth_csrf_failed`

#### Test 4: Session Expiration (Should Fail)

1. Start OAuth flow
2. Wait for session to expire (or clear cookies)
3. Complete OAuth flow
4. ✅ Should redirect to `/login?error=oauth_csrf_failed`

### Automated Testing

```javascript
describe('OAuth CSRF Protection', () => {
  it('should reject OAuth callback with invalid state', async () => {
    const response = await request(app)
      .get('/api/auth/facebook/callback')
      .query({ state: 'invalid_state', code: 'test_code' });
    
    expect(response.status).toBe(302);
    expect(response.headers.location).toContain('error=oauth_csrf_failed');
  });
  
  it('should accept OAuth callback with valid state', async () => {
    const agent = request.agent(app);
    
    // Initiate OAuth to generate state
    await agent.get('/api/auth/facebook');
    
    // Extract state from session (test helper needed)
    const state = agent.jar.getCookies('oauthState');
    
    // Complete callback with valid state
    const response = await agent
      .get('/api/auth/facebook/callback')
      .query({ state, code: 'test_code' });
    
    expect(response.status).toBe(302);
    expect(response.headers.location).not.toContain('error');
  });
});
```

### Security Audit Checklist

- [ ] Session secrets are strong random values (32+ characters)
- [ ] CSRF secrets are strong random values (32+ characters)
- [ ] Different secrets used in production vs development
- [ ] Secrets not committed to version control
- [ ] HTTPS enabled in production (`NODE_ENV=production`)
- [ ] Session cookies have `httpOnly: true`
- [ ] Session cookies have `secure: true` in production
- [ ] Session cookies have appropriate `sameSite` setting
- [ ] OAuth state parameter validation implemented for Facebook
- [ ] OAuth state parameter validation implemented for Google
- [ ] Twitter OAuth relies on built-in OAuth 1.0a protection
- [ ] Account linking flows protected with state validation
- [ ] Failed validation attempts are logged
- [ ] Rate limiting applied to OAuth endpoints
- [ ] Security headers configured (Helmet)
- [ ] CORS properly configured with credentials support

## Troubleshooting

### Error: "OAuth state mismatch - potential CSRF attack"

**Cause**: State parameter doesn't match session-stored value

**Solutions**:
1. Check that cookies are enabled in browser
2. Verify `SESSION_SECRET` is set in `.env`
3. Ensure domain allows cross-origin cookies if using separate frontend
4. Check that session middleware is loaded before auth routes
5. Verify clock synchronization (state tokens have timestamps)

### Error: "Session store not found"

**Cause**: Session middleware not properly configured

**Solutions**:
1. Verify `express-session` is installed: `npm install express-session`
2. Check session middleware is added before auth routes in `app.js`
3. Ensure `cookieParser` middleware is loaded before session middleware

### OAuth Callback Loops

**Cause**: State validation failing repeatedly, causing redirects

**Solutions**:
1. Clear browser cookies and cache
2. Check that `CLIENT_ORIGIN` in `.env` matches actual origin
3. Verify CORS configuration allows credentials
4. Check browser console for CORS errors

### Production Deployment Issues

**Cause**: Secure cookies not working

**Solutions**:
1. Ensure `NODE_ENV=production` is set
2. Verify HTTPS is properly configured
3. Check reverse proxy (nginx/Apache) forwards HTTPS headers
4. Consider using `trust proxy` setting in Express

## Summary

The implementation of session management and CSRF protection significantly enhances the security of OAuth flows in the Biensperience platform. By validating state parameters and using secure session cookies, the application is protected against common CSRF attacks targeting OAuth authentication and account linking features.

**Key Security Improvements**:
- ✅ OAuth CSRF protection via state parameter validation
- ✅ Secure session management with HTTP-only cookies
- ✅ Modern CSRF protection using `csrf-csrf` package
- ✅ Production-ready cookie security settings
- ✅ Account linking flows protected
- ✅ Twitter OAuth 1.0a inherent protection maintained

**Next Steps**:
1. Test OAuth flows thoroughly with state validation
2. Monitor logs for CSRF validation failures
3. Consider Redis/MongoDB session store for production
4. Implement additional rate limiting on OAuth endpoints
5. Add comprehensive security headers with Helmet
6. Conduct security audit before production deployment
