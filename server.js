/**
 * Main Express server application for Biensperience.
 * Handles API routes, middleware configuration, and serves the React frontend.
 *
 * @module server
 */

const express = require("express");
const rateLimit = require("express-rate-limit");
const path = require("path");
const favicon = require("serve-favicon");
const logger = require("morgan");
const bodyParser = require("body-parser");
const cors = require("cors");

require("dotenv").config();

require("./config/database");

/**
 * Express application instance
 * @type {express.Application}
 */
const app = express();

/**
 * Client development server port
 * @type {number}
 */
const CLIENTDEVPORT = 3000;

/**
 * Configure CORS middleware
 */
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || `http://localhost:${CLIENTDEVPORT}`,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

/**
 * Morgan logger middleware for development
 */
app.use(logger("dev"));

/**
 * Express JSON parsing middleware
 */
app.use(express.json());

/**
 * Rate limiting configuration - 1000 requests per 10 minutes per IP
 */
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

app.use(favicon(path.join(__dirname, "build", "favicon.ico")));
app.use(express.static(path.join(__dirname, "build")));

const port = process.env.PORT || 3001;

app.listen(port, function () {
  console.log(`Express app running on ${port}`);
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(require("./config/checkToken"));
app.use("/api/users", require("./routes/api/users"));
app.use("/api/destinations", require("./routes/api/destinations"));
app.use("/api/experiences", require("./routes/api/experiences"));
app.use("/api/photos", require("./routes/api/photos"));
app.use("/health-check", (req, res) => {
  res.send("OK");
});
app.get("/*", (req, res) => {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});
