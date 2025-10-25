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
const backendLogger = require("./utilities/backend-logger");
const cookieParser = require("cookie-parser");
const { doubleCsrf } = require("csrf-csrf");

require("dotenv").config();

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
 * Uses secure cookies in production and memory store for development
 */
app.use(
  session({
    secret: process.env.SESSION_SECRET || process.env.SECRET,
    resave: false,
    saveUninitialized: true, // Changed to true to create sessions for CSRF tokens
    cookie: {
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      httpOnly: true, // Prevents client-side JS from accessing the cookie
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    },
    name: 'biensperience.sid', // Custom session cookie name
  })
);

/**
 * CSRF protection configuration
 * Generates and validates CSRF tokens for state-changing requests
 * Note: __Host- prefix requires secure: true, so only use in production
 */
const isProduction = process.env.NODE_ENV === 'production';
const {
  generateCsrfToken, // Used to create a CSRF token pair (correct name from csrf-csrf v4)
  doubleCsrfProtection, // Middleware to validate CSRF tokens
} = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || process.env.SECRET,
  getSessionIdentifier: (req) => req.session?.id || 'anonymous', // Required in v4
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

/**
 * Rate limiting configuration - 1000 requests per 10 minutes per IP
 * Disabled in test environment
 */
if (process.env.NODE_ENV !== 'test') {
  const limiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(limiter);
}

// Only serve static files if build directory exists (not in test environment)
const buildPath = path.join(__dirname, "build");
try {
  if (process.env.NODE_ENV !== 'test') {
    app.use(favicon(path.join(buildPath, "favicon.ico")));
    app.use(express.static(buildPath));
  }
} catch (err) {
  // Build directory doesn't exist, skip static file serving
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// API logging middleware (async, non-blocking)
const apiLogger = require('./utilities/api-logger-middleware');
app.use('/api', apiLogger);

// Register auth routes BEFORE CSRF protection (csrf-token endpoint needs to be unprotected)
app.use("/api/auth", require("./routes/api/auth"));

// Passport configuration for OAuth
const { passport } = require('./config/passport');
app.use(passport.initialize());

// JWT token checking (populate req.user) - needs to be before CSRF to check super admin status
app.use(require("./config/checkToken"));

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
  
  // Debug logging
  backendLogger.debug('CSRF check', {
    method: req.method,
    path: req.path,
    user: req.user ? {
      id: req.user._id,
      isSuperAdmin: req.user.isSuperAdmin,
      role: req.user.role
    } : 'No user'
  });

  // Skip CSRF for super admins
  if (req.user && (req.user.isSuperAdmin || req.user.role === 'super_admin')) {
    backendLogger.debug('Skipping CSRF for super admin', { userId: req.user._id, isSuperAdmin: req.user.isSuperAdmin, role: req.user.role });
    return next();
  }

  backendLogger.debug('Applying CSRF protection');
  // Apply CSRF protection for state-changing methods
  doubleCsrfProtection(req, res, next);
});

app.use("/api/users", require("./routes/api/users"));
app.use("/api/destinations", require("./routes/api/destinations"));
app.use("/api/experiences", require("./routes/api/experiences"));
app.use("/api/photos", require("./routes/api/photos"));
app.use("/api/plans", require("./routes/api/plans"));
app.use("/api/search", require("./routes/api/search"));
app.use("/health-check", (req, res) => {
  res.send("OK");
});

// Catch-all route for React app (only in production)
if (process.env.NODE_ENV !== 'test') {
  app.get("/*", (req, res) => {
    res.sendFile(path.join(buildPath, "index.html"));
  });
}

module.exports = app;
