/**
 * Express Application Configuration
 *
 * This file exports the configured Express app without starting the server.
 * Used by both server.js (for production) and tests (for testing).
 */

const express = require("express");
const rateLimit = require("express-rate-limit");
const path = require("path");
const favicon = require("serve-favicon");
const logger = require("morgan");
const bodyParser = require("body-parser");
const cors = require("cors");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const backendLogger = require("./utilities/backend-logger");
const cookieParser = require("cookie-parser");
const { doubleCsrf } = require("csrf-csrf");

// Load environment variables from the repo-root .env reliably.
// This avoids issues when the server is started from a different CWD (e.g. pm2, scripts).
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

// Only require database connection if not in test environment
if (process.env.NODE_ENV !== 'test') {
  require("./config/database");
}

/**
 * Client development server port
 * @type {number}
 */
const CLIENTDEVPORT = 3000;

/**
 * Express application instance
 * @type {express.Application}
 */
const app = express();

/**
 * Configure CORS middleware
 */
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || `http://localhost:${CLIENTDEVPORT}`,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  })
);

/**
 * Cookie parser middleware (required for CSRF)
 */
app.use(cookieParser());

/**
 * Session configuration
 * Uses MongoDB store in production to avoid memory leaks and support scaling
 * Falls back to memory store in development/test environments
 */
const isProduction = process.env.NODE_ENV === 'production';
const sessionConfig = {
  secret: process.env.SESSION_SECRET || process.env.SECRET,
  resave: false,
  saveUninitialized: true, // Changed to true to create sessions for CSRF tokens
  cookie: {
    secure: isProduction, // HTTPS only in production
    httpOnly: true, // Prevents client-side JS from accessing the cookie
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: isProduction ? 'strict' : 'lax',
  },
  name: 'biensperience.sid', // Custom session cookie name
};

// Use MongoDB session store in production to prevent memory leaks
if (isProduction && process.env.DATABASE_URL) {
  sessionConfig.store = MongoStore.create({
    mongoUrl: process.env.DATABASE_URL,
    collectionName: 'sessions',
    ttl: 24 * 60 * 60, // 24 hours in seconds (matches cookie maxAge)
    autoRemove: 'native', // Use MongoDB TTL index for automatic cleanup
    touchAfter: 24 * 3600, // Only update session once per 24 hours unless data changes
    crypto: {
      secret: process.env.SESSION_SECRET || process.env.SECRET
    }
  });
  backendLogger.info('Session store: MongoDB (production)');
} else if (isProduction) {
  backendLogger.warn('Session store: MemoryStore (DATABASE_URL not set) - not recommended for production');
} else {
  backendLogger.info('Session store: MemoryStore (development)');
}

app.use(session(sessionConfig));

/**
 * CSRF protection configuration
 * Generates and validates CSRF tokens for state-changing requests
 * Note: __Host- prefix requires secure: true, so only use in production
 *
 * SECURITY NOTE: Using a fixed session identifier is intentional and secure.
 * The Double Submit Cookie pattern works as follows:
 * 1. Server generates a random token and sets it in an httpOnly cookie
 * 2. Server also returns the token to the client
 * 3. Client must send the token in the X-CSRF-Token header
 * 4. Server validates that header token matches cookie token
 *
 * This prevents CSRF because:
 * - Attacker can't read the httpOnly cookie to get the token
 * - SameSite cookie policy blocks cross-origin cookie sending
 * - Origin/Referer headers provide additional validation
 *
 * We use a fixed identifier because:
 * - In-memory session store doesn't persist across server restarts/instances
 * - The security comes from the cookie-header comparison, not session binding
 * - JWT provides user authentication independently
 */
const {
  generateCsrfToken, // Used to create a CSRF token pair (correct name from csrf-csrf v4)
  doubleCsrfProtection, // Middleware to validate CSRF tokens
} = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || process.env.SECRET,
  // Fixed identifier - security comes from cookie-header matching, not session binding
  getSessionIdentifier: () => 'biensperience-csrf-v1',
  cookieName: isProduction ? '__Host-biensperience.x-csrf-token' : 'biensperience.x-csrf-token',
  cookieOptions: {
    secure: isProduction,
    httpOnly: true,
    sameSite: isProduction ? 'strict' : 'lax',
    path: '/',
  },
  size: 64,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'], // Get token from header (note: renamed in v4)
});

/**
 * Expose CSRF token generation function for routes
 */
if (typeof generateCsrfToken === 'function') {
  app.set('csrfTokenGenerator', generateCsrfToken);
  backendLogger.info('CSRF token generator registered successfully');
} else {
  backendLogger.error('ERROR: generateCsrfToken is not a function', { type: typeof generateCsrfToken });
}

/**
 * Morgan logger middleware for development
 * Disabled in test environment
 */
if (process.env.NODE_ENV !== 'test') {
  app.use(logger("dev"));
}

/**
 * Express JSON parsing middleware
 */
app.use(express.json());

// NOTE: Global rate limiter moved below (after auth) to allow super admin skip logic

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Root endpoint - API info for API clients (must be BEFORE static file serving)
app.get('/', (req, res, next) => {
  // Check if request is from an API client (curl, Postman, etc.)
  const userAgent = req.get('User-Agent') || '';
  const acceptsJson = req.accepts('json') && !req.accepts('html');
  const isApiClient = acceptsJson ||
                      userAgent.includes('curl') ||
                      userAgent.includes('Postman') ||
                      userAgent.includes('HTTPie') ||
                      userAgent.includes('Insomnia');

  if (isApiClient) {
    // Return API information for API clients
    const clientOrigin = process.env.CLIENT_ORIGIN || `http://localhost:${CLIENTDEVPORT}`;
    const apiPort = process.env.PORT || 3001;
    const apiHost = req.get('host') || `localhost:${apiPort}`;

    return res.json({
      message: 'Biensperience API Server',
      status: 'running',
      version: '0.3.1',
      frontend: {
        url: clientOrigin,
        message: `Please visit ${clientOrigin} to use the application`
      },
      api: {
        url: `${req.protocol}://${apiHost}`,
        endpoints: {
          auth: '/api/auth',
          users: '/api/users',
          destinations: '/api/destinations',
          experiences: '/api/experiences',
          photos: '/api/photos',
          plans: '/api/plans',
          search: '/api/search',
          tokens: '/api/tokens',
          invites: '/api/invites',
          health: '/health-check'
        }
      },
      documentation: 'https://github.com/gokepelemo/biensperience'
    });
  }

  // Browser request - continue to static file serving
  next();
});

// Only serve static files if build directory exists (not in test environment)
const buildPath = path.join(__dirname, "build");
try {
  if (process.env.NODE_ENV !== 'test') {
    app.use(favicon(path.join(buildPath, "icon.svg")));
    // Serve the built frontend.
    // IMPORTANT: Do not cache index.html aggressively (it references hashed assets).
    // Hash-busted assets under /assets/ can be cached immutably.
    app.use(
      express.static(buildPath, {
        setHeaders: (res, filePath) => {
          // Ensure the HTML shell is always revalidated.
          if (filePath.endsWith(`${path.sep}index.html`)) {
            res.setHeader('Cache-Control', 'no-store');
            return;
          }

          // Vite build assets are content-hashed; they can be cached forever.
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        }
      })
    );
  }
} catch (err) {
  // Build directory doesn't exist, skip static file serving
}

// API logging middleware (async, non-blocking)
const apiLogger = require('./utilities/api-logger-middleware');
app.use('/api', apiLogger);

// Trace ID middleware - attach trace ID to all API requests
const { attachTraceId, addTraceIdToResponse } = require('./utilities/trace-middleware');
app.use('/api', attachTraceId);
app.use('/api', addTraceIdToResponse);

// Passport configuration for OAuth
const { passport } = require('./config/passport');
app.use(passport.initialize());

// API token checking (populate req.user and req.isApiToken) - must be before JWT
app.use(require("./utilities/api-token-middleware"));

// JWT token checking (populate req.user) - needs to be before CSRF to check super admin status
app.use(require("./config/checkToken"));

/**
 * Global API rate limiting (after auth so we can skip super admins)
 * Uses config/rateLimiters apiLimiter with higher thresholds and skip for super admins
 */
if (process.env.NODE_ENV !== 'test') {
  const { apiLimiter } = require('./config/rateLimiters');
  app.use('/api', apiLimiter);
}

// Register auth routes AFTER JWT/token middleware (so logout can access req.user)
// Apply strict auth rate limiter to authentication endpoints (login, password)
// to mitigate brute-force attacks. The authLimiter is configured in
// `config/rateLimiters.js` and skips successful requests where appropriate.
const { authLimiter, modificationLimiter } = require('./config/rateLimiters');
app.use('/api/auth', authLimiter, require('./routes/api/auth'));

// Session ID middleware - manage session IDs for authenticated requests (after auth)
const { attachSessionId } = require('./utilities/session-middleware');
app.use('/api', attachSessionId);

// Apply CSRF protection to state-changing API routes (after auth routes)
// Skip CSRF for safe methods and login endpoint
app.use('/api', (req, res, next) => {
  // Skip CSRF entirely in test environment
  if (process.env.NODE_ENV === 'test') {
    backendLogger.debug('Skipping CSRF entirely in test environment');
    return next();
  }

  // Skip CSRF for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  // Skip CSRF for login and signup endpoints (authentication doesn't need CSRF protection)
  if (req.path === '/users/login' || req.path === '/users/') {
    return next();
  }

  // Debug logging for CSRF validation
  const csrfTokenFromHeader = req.headers['x-csrf-token'];
  backendLogger.debug('CSRF check', {
    method: req.method,
    path: req.path,
    sessionId: req.session?.id ? req.session.id.substring(0, 8) + '...' : 'none',
    hasSession: !!req.session,
    hasCsrfHeader: !!csrfTokenFromHeader,
    csrfHeaderPreview: csrfTokenFromHeader ? csrfTokenFromHeader.substring(0, 16) + '...' : 'none',
    user: req.user ? {
      id: req.user._id,
      isSuperAdmin: req.user.isSuperAdmin,
      role: req.user.role
    } : 'No user'
  });

  // Skip CSRF for API token authentication
  if (req.isApiToken) {
    backendLogger.debug('Skipping CSRF for API token authentication', { userId: req.user._id });
    return next();
  }

  // Skip CSRF for super admins
  if (req.user && (req.user.isSuperAdmin || req.user.role === 'super_admin')) {
    backendLogger.debug('Skipping CSRF for super admin', { userId: req.user._id, isSuperAdmin: req.user.isSuperAdmin, role: req.user.role });
    return next();
  }

  backendLogger.debug('Applying CSRF protection', {
    sessionId: req.session?.id ? req.session.id.substring(0, 8) + '...' : 'none'
  });

  // Apply CSRF protection for state-changing methods
  doubleCsrfProtection(req, res, (err) => {
    if (err) {
      backendLogger.error('CSRF validation failed', {
        error: err.message,
        path: req.path,
        method: req.method,
        sessionId: req.session?.id ? req.session.id.substring(0, 8) + '...' : 'none',
        hasCsrfHeader: !!csrfTokenFromHeader
      });
    }
    next(err);
  });
});

// Protect user creation/modification endpoints with a modification limiter
// to reduce abuse and credential stuffing vectors.
app.use('/api/users', modificationLimiter, require('./routes/api/users'));
app.use("/api/destinations", require("./routes/api/destinations"));
app.use("/api/experiences", require("./routes/api/experiences"));
app.use("/api/photos", require("./routes/api/photos"));
app.use("/api/plans", require("./routes/api/plans"));
app.use("/api/documents", require("./routes/api/documents"));
app.use("/api/search", require("./routes/api/search"));
app.use("/api/tokens", require("./routes/api/tokens"));
app.use("/api/invites", require("./routes/api/invites"));
app.use("/api/invite-tracking", require("./routes/api/invite-tracking"));
app.use("/api/activities", require("./routes/api/activities"));
app.use("/api/dashboard", require("./routes/api/dashboard"));
app.use("/api/follows", require("./routes/api/follows"));
app.use("/api/ai", require("./routes/api/ai"));
app.use("/api/chat", require("./routes/api/chat"));
app.use("/api/geocode", require("./routes/api/geocode"));
app.use("/api/countries", require("./routes/api/countries"));
app.use("/health-check", (req, res) => {
  res.send("OK");
});

// Centralized API error handler: ensure API routes always return JSON
// This catches errors thrown by middleware/controllers and prevents HTML error pages
app.use('/api', (err, req, res, next) => {
  backendLogger.error('Unhandled API error', { error: err && err.message, stack: err && err.stack, path: req.path });
  // If headers already sent, delegate to default handler
  if (res.headersSent) return next(err);
  // Use standardized error response payload
  const status = (err && (err.statusCode || err.status)) ? (err.statusCode || err.status) : 500;
  return res.status(status).json({ success: false, error: (err && err.message) || 'Internal server error' });
});

// Catch-all route for React app (only in production)
if (process.env.NODE_ENV !== 'test') {
  app.get('/*', (req, res, next) => {
    // Never hijack API routes.
    if (req.path.startsWith('/api/')) return next();

    // If the request is for a static asset (has an extension) or an /assets/* file,
    // do NOT fall back to index.html.
    // Returning HTML for missing JS causes the browser's strict module MIME checks
    // to fail and can break the app after deploys/restarts.
    const hasFileExtension = path.extname(req.path);
    const isAssetPath = req.path.startsWith('/assets/');
    if (hasFileExtension || isAssetPath) {
      return res.status(404).end();
    }

    // Only serve the SPA shell for browser navigation (HTML).
    const acceptsHtml = req.accepts('html');
    if (!acceptsHtml) {
      return res.status(404).end();
    }

    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(path.join(buildPath, 'index.html'));
  });
}

module.exports = app;
