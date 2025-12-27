/**
 * Version utility for Biensperience
 *
 * Provides version information and console display utilities.
 * In demo mode, logs version info on startup.
 * Always exposes `version.show()` command in browser console.
 */

// Version info from build-time injection
const VERSION = import.meta.env.APP_VERSION || '0.0.0';
const COMMIT_HASH = import.meta.env.COMMIT_HASH || 'unknown';
const BUILD_TIME = import.meta.env.BUILD_TIME || null;
const IS_DEMO_MODE = import.meta.env.REACT_APP_DEMO_MODE === 'true';

/**
 * Format version string with commit hash
 * @returns {string} Formatted version string (e.g., "v0.6.4 (4f8f0de)")
 */
function getVersionString() {
  return `v${VERSION} (${COMMIT_HASH})`;
}

/**
 * Get full version info object
 * @returns {Object} Version information
 */
function getVersionInfo() {
  return {
    version: VERSION,
    commitHash: COMMIT_HASH,
    buildTime: BUILD_TIME,
    isDemoMode: IS_DEMO_MODE,
    formatted: getVersionString()
  };
}

/**
 * Display version info in console with styled output
 */
function showVersion() {
  const info = getVersionInfo();

  // Styled console output
  console.log(
    '%c Biensperience %c ' + info.formatted + ' ',
    'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 4px 8px; border-radius: 4px 0 0 4px; font-weight: bold;',
    'background: #f0f0f0; color: #333; padding: 4px 8px; border-radius: 0 4px 4px 0;'
  );

  if (info.buildTime) {
    try {
      const buildDate = new Date(info.buildTime);
      if (!isNaN(buildDate.getTime())) {
        console.log(
          '%c Build: %c ' + buildDate.toLocaleString() + ' ',
          'color: #666; font-weight: bold;',
          'color: #888;'
        );
      }
    } catch {
      // Ignore invalid build time
    }
  }

  if (info.isDemoMode) {
    console.log(
      '%c Demo Mode %c Active ',
      'background: #ffc107; color: #000; padding: 2px 6px; border-radius: 4px 0 0 4px; font-weight: bold;',
      'background: #fff3cd; color: #856404; padding: 2px 6px; border-radius: 0 4px 4px 0;'
    );
  }

  // Return version info for programmatic use
  return info;
}

/**
 * Initialize version system
 * - Logs version in demo mode
 * - Exposes version.show() to global window object
 */
function initVersion() {
  // Expose version object to window for console access
  if (typeof window !== 'undefined') {
    window.version = {
      show: showVersion,
      info: getVersionInfo,
      get: getVersionString,
      VERSION,
      COMMIT_HASH,
      BUILD_TIME
    };
  }

  // Auto-show version in demo mode
  if (IS_DEMO_MODE) {
    // Delay slightly to ensure console is ready and other logs don't interfere
    setTimeout(() => {
      console.log('');
      showVersion();
      console.log('%c Type version.show() to display version info anytime', 'color: #888; font-style: italic;');
      console.log('');
    }, 100);
  }
}

// Export for module use
export {
  VERSION,
  COMMIT_HASH,
  BUILD_TIME,
  IS_DEMO_MODE,
  getVersionString,
  getVersionInfo,
  showVersion,
  initVersion
};

export default {
  VERSION,
  COMMIT_HASH,
  BUILD_TIME,
  IS_DEMO_MODE,
  get: getVersionString,
  info: getVersionInfo,
  show: showVersion,
  init: initVersion
};
