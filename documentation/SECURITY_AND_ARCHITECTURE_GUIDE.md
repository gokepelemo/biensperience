# Security & Architecture Guide

**Last Updated**: October 18, 2025
**Version**: 1.0.0

This guide consolidates findings from comprehensive code reviews and provides actionable recommendations for the Biensperience application.

---

## Table of Contents

1. [Critical Security Issues](#critical-security-issues)
2. [Permissions Framework](#permissions-framework)
3. [Logging Framework](#logging-framework)
4. [OAuth Authentication](#oauth-authentication)
5. [Architecture Recommendations](#architecture-recommendations)
6. [Implementation Checklist](#implementation-checklist)

---

## Critical Security Issues

### 🔴 P0 - Fix Immediately

#### 1. Twitter OAuth Missing CSRF Protection
**File**: `routes/api/auth.js:162`

**Issue**: Comment incorrectly states Twitter OAuth 1.0a doesn't support state parameter, but implementation uses OAuth 2.0.

**Fix**:
```javascript
// Add state parameter
router.get('/twitter', (req, res, next) => {
  const csrfToken = req.app.get('csrfTokenGenerator')(req, res);
  req.session.oauthState = csrfToken;
  passport.authenticate('twitter', {
    scope: ['tweet.read', 'users.read', 'offline.access'],
    state: csrfToken
  })(req, res, next);
});

// Validate state in callback
router.get('/twitter/callback',
  (req, res, next) => {
    if (!req.query.state || req.query.state !== req.session.oauthState) {
      return res.redirect('/login?error=oauth_csrf_failed');
    }
    delete req.session.oauthState;
    next();
  },
  // ... rest of callback
);
```

#### 2. JWT Tokens Exposed in URL
**Files**: `routes/api/auth.js` (lines 71, 122, 188)

**Issue**: Tokens visible in browser history, referrer headers, server logs

**Fix**: Use HTTP-only cookie instead:
```javascript
// In OAuth callbacks:
res.cookie('auth_token', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 24 * 60 * 60 * 1000
});
res.redirect(`/?oauth=${provider}`);

// Update middleware to read from cookie:
// config/checkToken.js
let token = req.get("Authorization") || req.cookies.auth_token;
```

#### 3. Request Body Logging Exposes Passwords
**File**: `utilities/api-logger-middleware.js:37`

**Fix**: Remove or sanitize:
```javascript
// Remove body logging entirely
// OR implement sanitization
const sanitizedBody = sanitize(req.body);
// where sanitize redacts password, token, secret fields
```

#### 4. Backend Logger Import Error
**File**: `utilities/backend-logger.js:16`

**Fix**: Create shared constants file:
```javascript
// utilities/log-levels.js
const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3, TRACE: 4 };
module.exports = { LOG_LEVELS };

// Then import in both backend-logger.js and src/utilities/logger.js
```

#### 5. Permission Check Parameter Order Bug
**File**: `controllers/api/experiences.js:951`

**Fix**:
```javascript
// BEFORE (incorrect):
if (!permissions.isOwner(experience, req.user._id)) {

// AFTER (correct):
if (!permissions.isOwner(req.user._id, experience)) {
```

#### 6. Missing isSuperAdmin Export
**File**: `utilities/permissions.js:639`

**Fix**:
```javascript
module.exports = {
  // ... existing exports
  isSuperAdmin,
  isRegularUser
};
```

### 🟠 P1 - High Priority

1. **Increase bcrypt salt rounds** from 6 to 12 (`models/user.js`)
2. **Add rate limiting** to OAuth endpoints
3. **Remove debug logging** from production code
4. **Implement session regeneration** after OAuth login
5. **Add ObjectId validation** middleware

---

## Permissions Framework

### Architecture

```
Permission Types:
├── User Roles (System Level)
│   ├── SUPER_ADMIN: Full access to all resources
│   └── REGULAR_USER: Standard permissions
│
└── Resource Permissions (Resource Level)
    ├── Owner: Full control (creator)
    ├── Collaborator: Can edit and modify
    └── Contributor: Can add posts (future)
```

### Inheritance

- **Max Depth**: 3 levels
- **Circular Prevention**: BFS traversal with visited Set
- **Backwards Compatible**: Checks both legacy `user` field and `permissions` array

### Best Practices

```javascript
// Always use PermissionEnforcer for consistency
const { getEnforcer } = require('../../utilities/permission-enforcer');

const enforcer = getEnforcer({ Destination, Experience, User });
const canEdit = await enforcer.canEdit(req.user._id, resource);

if (!canEdit) {
  return res.status(403).json({ error: 'Not authorized' });
}
```

### Key Issues Fixed

- ✅ Parameter order bug in ownership checks
- ✅ Export missing functions
- ✅ Standardized photo management permissions
- ⏳ Super admin audit logging (planned)
- ⏳ User deletion cascade (planned)

---

## Logging Framework

### Consolidated Architecture

```
utilities/
├── logger.js (KEEP - Primary backend logger)
├── log-levels.js (NEW - Shared constants)
└── logging-middleware.js (RENAME from api-logging-middleware.js)

src/utilities/
├── logger.js (KEEP - Frontend logger)
└── debug.js (KEEP - Development debugging)

REMOVE:
├── utilities/backend-logger.js (duplicate)
└── utilities/api-logger-middleware.js (duplicate)
```

### Configuration

**Environment Variables** (add to `.env.example`):
```bash
# Logging
LOG_LEVEL=2              # 0=ERROR, 1=WARN, 2=INFO, 3=DEBUG, 4=TRACE
LOG_CONSOLE=true         # Console output
LOG_FILE=false           # File logging (needs rotation)
LOG_FILE_PATH=./logs/app.log
```

### Security Best Practices

**Never log**:
- Passwords
- JWT tokens
- API keys
- Authorization headers
- Credit card numbers
- Social security numbers

**Sanitization pattern**:
```javascript
const SENSITIVE_FIELDS = ['password', 'token', 'secret', 'authorization'];

function sanitize(obj) {
  const sanitized = { ...obj };
  for (const key of Object.keys(sanitized)) {
    if (SENSITIVE_FIELDS.some(field => key.toLowerCase().includes(field))) {
      sanitized[key] = '[REDACTED]';
    }
  }
  return sanitized;
}
```

### Key Issues Fixed

- ✅ Fixed import error in backend-logger
- ✅ Removed password logging
- ✅ Removed duplicate implementations
- ⏳ Log rotation (planned)
- ⏳ Kafka producer pooling (planned)

---

## OAuth Authentication

### Supported Providers

1. **Facebook** OAuth 2.0 (✅ CSRF protected)
2. **Google** OAuth 2.0 (✅ CSRF protected)
3. **X (Twitter)** OAuth 2.0 (❌ No CSRF - needs fix)

### Flow Overview

```
1. User clicks "Sign in with [Provider]"
   ↓
2. Generate CSRF token, store in session
   ↓
3. Redirect to provider with state parameter
   ↓
4. Provider authenticates user
   ↓
5. Callback with code + state
   ↓
6. Validate state === session.oauthState
   ↓
7. Exchange code for access token
   ↓
8. Fetch user profile
   ↓
9. Create or link account
   ↓
10. Generate JWT, set secure cookie
   ↓
11. Redirect to app with success
```

### Account Linking

Users can link multiple OAuth providers to one account:

```javascript
// Check for existing account with email
const existingUser = await User.findOne({ email });
if (existingUser) {
  // Link provider to existing account
  existingUser.facebookId = profile.id;
  existingUser.linkedAccounts.push({
    provider: 'facebook',
    providerId: profile.id,
    linkedAt: new Date()
  });
  await existingUser.save();
}
```

### Security Checklist

- [x] CSRF protection (Facebook, Google)
- [ ] CSRF protection (Twitter) - **needs fix**
- [ ] JWT in secure cookie (not URL)
- [x] State parameter validation
- [x] Duplicate account prevention
- [ ] Refresh token storage
- [ ] Rate limiting
- [ ] Session regeneration

### Key Issues Fixed

- ⏳ Twitter OAuth CSRF protection (in progress)
- ⏳ JWT secure cookie (in progress)
- ✅ Debug logging removed
- ⏳ Refresh token storage (planned)

---

## Architecture Recommendations

### 1. Consolidate Duplicate Code

**Permission Schema** (19 lines duplicated in 2 files):
```javascript
// Create: models/schemas/permission-schema.js
const permissionSchema = new Schema({
  _id: { type: Schema.Types.ObjectId, required: true },
  entity: { type: String, required: true, enum: ['user', 'destination', 'experience'] },
  type: { type: String, enum: ['owner', 'collaborator', 'contributor'] }
}, { _id: false });

module.exports = permissionSchema;

// Use in models/experience.js and models/destination.js:
const permissionSchema = require('./schemas/permission-schema');
```

**Photo Management** (200+ lines duplicated):
```javascript
// Create: utilities/photo-management.js
async function addPhotoToResource(resource, photoData, userId, models) {
  // Unified implementation with permission checking
}

// Use in both experiences and destinations controllers
```

### 2. Add Middleware for Common Patterns

**ObjectId Validation**:
```javascript
// middleware/validateObjectId.js
function validateObjectId(...paramNames) {
  return (req, res, next) => {
    for (const paramName of paramNames) {
      const id = req.params[paramName];
      if (id && !mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: `Invalid ${paramName} format` });
      }
    }
    next();
  };
}

// Usage:
router.put('/:id', validateObjectId('id'), controller.update);
```

**Permission Enforcement**:
```javascript
// middleware/requirePermission.js
function requirePermission(level = 'owner') {
  return async (req, res, next) => {
    const enforcer = getEnforcer(models);
    const hasPermission = await enforcer.can(req.user._id, req.resource, level);

    if (!hasPermission) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// Usage:
router.put('/:id',
  ensureLoggedIn,
  loadResource('Experience'),
  requirePermission('collaborator'),
  controller.update
);
```

### 3. Implement Caching

**Permission Cache**:
```javascript
// utilities/permission-cache.js
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 300 }); // 5 minutes

function getCachedPermission(userId, resourceId, resourceType) {
  return cache.get(`perm:${userId}:${resourceType}:${resourceId}`);
}

// Invalidate on permission changes
function invalidateResourcePermissions(resourceId, resourceType) {
  const keys = cache.keys().filter(key => key.includes(`:${resourceType}:${resourceId}`));
  keys.forEach(key => cache.del(key));
}
```

### 4. Persistent Session Store

```javascript
// app.js
const MongoStore = require('connect-mongo');

session({
  store: MongoStore.create({
    mongoUrl: process.env.DATABASE_URL,
    collectionName: 'sessions',
    ttl: 24 * 60 * 60
  }),
  // ... other config
})
```

### 5. Structured Error Handling

```javascript
// utilities/errors.js
class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
  }
}

class NotFoundError extends AppError {
  constructor(resource) {
    super(`${resource} not found`, 404, 'RESOURCE_NOT_FOUND');
  }
}

class PermissionError extends AppError {
  constructor(action) {
    super(`Not authorized to ${action}`, 403, 'INSUFFICIENT_PERMISSIONS');
  }
}

// Usage:
if (!resource) {
  throw new NotFoundError('Experience');
}

if (!canEdit) {
  throw new PermissionError('edit this resource');
}

// Error handling middleware:
app.use((err, req, res, next) => {
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code
    });
  }

  // Unexpected error - log and send generic message
  logger.error('Unexpected error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});
```

---

## Implementation Checklist

### Week 1: Critical Security Fixes

**Permissions**:
- [ ] Fix parameter order bug (`experiences.js:951`)
- [ ] Export `isSuperAdmin` function
- [ ] Fix syntax error on line 13
- [ ] Standardize photo permission checks (6 functions)

**Logging**:
- [ ] Fix backend-logger import error
- [ ] Remove request body logging
- [ ] Delete duplicate `api-logger-middleware.js`
- [ ] Create shared `log-levels.js`

**OAuth**:
- [ ] Add CSRF protection to Twitter OAuth
- [ ] Move JWT to secure HTTP-only cookie
- [ ] Remove all `console.log` statements
- [ ] Add JWT validation before storage

**Testing**:
- [ ] Add permission check tests
- [ ] Add OAuth CSRF tests
- [ ] Add logging sanitization tests

### Week 2: High Priority Improvements

**Security**:
- [ ] Increase bcrypt rounds to 12
- [ ] Add OAuth rate limiting
- [ ] Implement session regeneration
- [ ] Add ObjectId validation middleware

**Code Quality**:
- [ ] Consolidate permission schema
- [ ] Consolidate photo management code
- [ ] Add super admin audit logging
- [ ] Create error handling classes

**Testing**:
- [ ] Increase coverage to >50%
- [ ] Add integration tests
- [ ] Add security tests

### Week 3-4: Medium Priority Features

**Functionality**:
- [ ] Implement refresh token storage
- [ ] Add persistent session store
- [ ] Implement permission caching
- [ ] Add log rotation

**UX**:
- [ ] Add account linking UI
- [ ] Add OAuth loading states
- [ ] Improve error messages
- [ ] Add success notifications

**Documentation**:
- [ ] Update .env.example
- [ ] Create API documentation
- [ ] Add code examples
- [ ] Write troubleshooting guide

### Production Readiness

Before deploying to production:

- [ ] All P0 issues resolved
- [ ] Test coverage >75%
- [ ] Security audit passed
- [ ] Load testing completed
- [ ] Monitoring configured
- [ ] Rollback plan documented
- [ ] Team training completed

---

## Quick Reference

### Critical Files

```
Permissions:
├── utilities/permissions.js (core logic)
├── utilities/permission-enforcer.js (middleware)
├── utilities/user-roles.js (constants)
└── controllers/api/*.js (usage)

Logging:
├── utilities/logger.js (backend)
├── utilities/logging-middleware.js (API middleware)
└── src/utilities/logger.js (frontend)

OAuth:
├── config/passport.js (strategies)
├── routes/api/auth.js (routes)
└── src/utilities/oauth-service.js (frontend)
```

### Environment Variables

```bash
# Security
SECRET=your-jwt-secret
SESSION_SECRET=your-session-secret
BCRYPT_ROUNDS=12

# OAuth
FACEBOOK_APP_ID=xxx
FACEBOOK_APP_SECRET=xxx
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
TWITTER_CLIENT_ID=xxx
TWITTER_CLIENT_SECRET=xxx

# Logging
LOG_LEVEL=2
LOG_CONSOLE=true
LOG_FILE=false

# Database
DATABASE_URL=mongodb://localhost:27017/biensperience
```

### Common Commands

```bash
# Run tests
npm test                          # Frontend
npm run test:api                  # Backend
npm run test:api:coverage         # Coverage report

# Linting
npm run lint                      # Check code style
npm run lint:fix                  # Auto-fix issues

# Database
npm run db:migrate                # Run migrations
npm run db:seed                   # Seed data

# Development
npm start                         # Frontend
npm run dev                       # Backend with nodemon
```

---

## Support & Resources

- **CLAUDE.md**: Development log and architectural decisions
- **AGENTS.md**: AI agent guidelines and workflows
- **API Documentation**: `/documentation/API_*.md` files
- **GitHub Issues**: Report bugs and feature requests

**Last Reviewed**: October 18, 2025
**Next Review**: November 18, 2025
