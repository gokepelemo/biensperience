/**
 * Test Logger Utility
 *
 * Provides detailed console logging for tests when DEBUG env var is set to true.
 * Usage: Set DEBUG=true in environment variables to enable detailed test logging.
 */

const isDebugEnabled = process.env.DEBUG === 'true';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

class TestLogger {
  constructor(testName) {
    this.testName = testName;
    this.startTime = null;
  }

  log(message, data = null) {
    if (!isDebugEnabled) return;

    const timestamp = new Date().toISOString();
    console.log(`${colors.dim}[${timestamp}]${colors.reset} ${colors.cyan}[${this.testName}]${colors.reset} ${message}`);

    if (data) {
      console.log(`${colors.dim}${JSON.stringify(data, null, 2)}${colors.reset}`);
    }
  }

  success(message, data = null) {
    if (!isDebugEnabled) return;

    console.log(`${colors.green}✓${colors.reset} ${colors.cyan}[${this.testName}]${colors.reset} ${message}`);

    if (data) {
      console.log(`${colors.dim}${JSON.stringify(data, null, 2)}${colors.reset}`);
    }
  }

  error(message, error = null) {
    if (!isDebugEnabled) return;

    console.log(`${colors.red}✗${colors.reset} ${colors.cyan}[${this.testName}]${colors.reset} ${message}`);

    if (error) {
      console.error(`${colors.red}${error.stack || error}${colors.reset}`);
    }
  }

  warn(message, data = null) {
    if (!isDebugEnabled) return;

    console.log(`${colors.yellow}⚠${colors.reset} ${colors.cyan}[${this.testName}]${colors.reset} ${message}`);

    if (data) {
      console.log(`${colors.dim}${JSON.stringify(data, null, 2)}${colors.reset}`);
    }
  }

  info(message, data = null) {
    if (!isDebugEnabled) return;

    console.log(`${colors.blue}ℹ${colors.reset} ${colors.cyan}[${this.testName}]${colors.reset} ${message}`);

    if (data) {
      console.log(`${colors.dim}${JSON.stringify(data, null, 2)}${colors.reset}`);
    }
  }

  section(title) {
    if (!isDebugEnabled) return;

    console.log(`\n${colors.bright}${colors.magenta}━━━ ${title} ━━━${colors.reset}\n`);
  }

  request(method, url, data = null) {
    if (!isDebugEnabled) return;

    console.log(`${colors.blue}→${colors.reset} ${colors.bright}${method}${colors.reset} ${url}`);

    if (data) {
      console.log(`${colors.dim}Request body:${colors.reset}`);
      console.log(`${colors.dim}${JSON.stringify(data, null, 2)}${colors.reset}`);
    }
  }

  response(status, data = null) {
    if (!isDebugEnabled) return;

    const statusColor = status >= 200 && status < 300 ? colors.green : colors.red;
    console.log(`${colors.blue}←${colors.reset} ${statusColor}${status}${colors.reset}`);

    if (data) {
      console.log(`${colors.dim}Response body:${colors.reset}`);
      console.log(`${colors.dim}${JSON.stringify(data, null, 2)}${colors.reset}`);
    }
  }

  startTimer() {
    this.startTime = Date.now();
  }

  endTimer(label = 'Operation') {
    if (!isDebugEnabled) return;

    if (this.startTime) {
      const elapsed = Date.now() - this.startTime;
      console.log(`${colors.dim}⏱  ${label} took ${elapsed}ms${colors.reset}`);
      this.startTime = null;
    }
  }

  table(data, title = null) {
    if (!isDebugEnabled) return;

    if (title) {
      console.log(`\n${colors.bright}${title}${colors.reset}`);
    }
    console.table(data);
  }

  separator() {
    if (!isDebugEnabled) return;
    console.log(`${colors.dim}${'─'.repeat(80)}${colors.reset}`);
  }
}

module.exports = {
  TestLogger,
  isDebugEnabled,
};
