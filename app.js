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

/**
 * CSRF protection configuration
 * Generates and validates CSRF tokens for state-changing requests
 */
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
  getTokenFromRequest: (req) => req.headers['x-csrf-token'], // Get token from header
});

/**
 * Expose CSRF token generation function for routes
 */
app.set('csrfTokenGenerator', generateToken);

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

// Passport configuration for OAuth
const { passport } = require('./config/passport');
app.use(passport.initialize());

app.use(require("./config/checkToken"));
app.use("/api/auth", require("./routes/api/auth"));
app.use("/api/users", require("./routes/api/users"));
app.use("/api/destinations", require("./routes/api/destinations"));
app.use("/api/experiences", require("./routes/api/experiences"));
app.use("/api/photos", require("./routes/api/photos"));
app.use("/api/plans", require("./routes/api/plans"));
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
