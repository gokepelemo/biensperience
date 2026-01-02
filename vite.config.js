import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import envCompatible from 'vite-plugin-env-compatible';
import path from 'path';
import { execSync } from 'child_process';
import pkg from './package.json' with { type: 'json' };

// Get git commit hash for version tracking
function getGitCommitHash() {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'unknown';
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on mode (development, production, etc.)
  const env = loadEnv(mode, process.cwd(), '');

  // Get version info
  const appVersion = pkg.version;
  const commitHash = getGitCommitHash();
  const buildTime = new Date().toISOString();

  return {
    plugins: [
      react({
        // Enable JSX in .js files
        include: '**/*.{jsx,js}',
      }),
      // Enable importing SVG files as React components
      svgr({
        svgrOptions: {
          // SVGR options
          icon: true,
          dimensions: false,
        },
      }),
      // Support REACT_APP_ environment variables for backward compatibility
      envCompatible({
        prefix: 'REACT_APP_'
      })
    ],

    // Define environment variables without VITE_ prefix
    define: {
      // App Version Info (injected at build time)
      'import.meta.env.APP_VERSION': JSON.stringify(appVersion),
      'import.meta.env.COMMIT_HASH': JSON.stringify(commitHash),
      'import.meta.env.BUILD_TIME': JSON.stringify(buildTime),
      // AI Configuration
      'import.meta.env.AI_DEFAULT_PROVIDER': JSON.stringify(env.AI_DEFAULT_PROVIDER || 'openai'),
      'import.meta.env.OPENAI_API_KEY': JSON.stringify(env.OPENAI_API_KEY || ''),
      'import.meta.env.ANTHROPIC_API_KEY': JSON.stringify(env.ANTHROPIC_API_KEY || ''),
      'import.meta.env.MISTRAL_API_KEY': JSON.stringify(env.MISTRAL_API_KEY || ''),
      'import.meta.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
      'import.meta.env.AI_AUTOCOMPLETE_PROVIDER': JSON.stringify(env.AI_AUTOCOMPLETE_PROVIDER || ''),
      'import.meta.env.AI_EDIT_PROVIDER': JSON.stringify(env.AI_EDIT_PROVIDER || ''),
      'import.meta.env.AI_IMPROVE_PROVIDER': JSON.stringify(env.AI_IMPROVE_PROVIDER || ''),
      'import.meta.env.AI_SUMMARIZE_PROVIDER': JSON.stringify(env.AI_SUMMARIZE_PROVIDER || ''),
      'import.meta.env.AI_TIPS_PROVIDER': JSON.stringify(env.AI_TIPS_PROVIDER || ''),
      'import.meta.env.AI_TRANSLATE_PROVIDER': JSON.stringify(env.AI_TRANSLATE_PROVIDER || ''),
    },

  // Enable esbuild to handle JSX in .js files
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.jsx?$/,
    exclude: [],
    // Enable tree shaking
    treeShaking: true,
    // Minify identifiers
    minifyIdentifiers: true,
    // Minify syntax
    minifySyntax: true,
  },

  // Set the root directory for the app
  root: '.',

  // Public directory for static assets
  publicDir: 'public',

  // Build output directory
  build: {
    outDir: 'build',
    sourcemap: true,
    chunkSizeWarningLimit: 1000,
    // Enable CSS code splitting for better caching and loading
    cssCodeSplit: true,
    // Consistent CSS minification
    cssMinify: process.env.NODE_ENV === 'production' ? 'esbuild' : false,
    // Minification options
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor chunks for better caching
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'bootstrap-vendor': ['react-bootstrap', 'bootstrap'],
          'icons': ['react-icons'],
          // Split large utility libraries
          'utils-vendor': ['js-cookie', 'dompurify', 'store2'],
          // AWS SDK is large, split it
          'aws-vendor': ['@aws-sdk/client-s3'],
        },
        // Optimize chunk file names for caching
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          // Separate CSS files from other assets for better caching
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'assets/[name]-[hash].css';
          }
          return 'assets/[name]-[hash].[ext]';
        }
      }
    }
    ,
    // Improve CommonJS handling for packages that export mixed ESM/CJS
    commonjsOptions: {
      // Process all node_modules through the CommonJS plugin to
      // support packages that only provide CJS entrypoints.
      include: [/node_modules/],
      transformMixedEsModules: true,
      // Prefer exposing default when requiring CommonJS modules
      requireReturnsDefault: 'preferred'
    }
  },

  // Dev server configuration
  server: {
    port: 3001,
    open: true,
    // Proxy API requests to backend
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/auth': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      }
    },
    // Watch configuration - exclude files that are updated by backend
    watch: {
      ignored: ['**/fallback-exchange-rates.json']
    }
  },

  // Preview server (for production build preview)
  preview: {
    port: 3001,
    open: true,
  },

  // Resolve aliases
    resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@views': path.resolve(__dirname, './src/views'),
      '@utilities': path.resolve(__dirname, './src/utilities'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@contexts': path.resolve(__dirname, './src/contexts'),
      '@styles': path.resolve(__dirname, './src/styles'),
    }
  },

  // CSS configuration with PostCSS and consistent processing
  css: {
    devSourcemap: true,
    // Enable CSS code splitting for better caching in production
    devCodeSplit: false,
    // PostCSS configuration
    postcss: './postcss.config.js',
    // Preprocessor options for SASS
    preprocessorOptions: {
      scss: {
        // Ensure consistent SASS compilation
        api: 'modern-compiler', // Use modern SASS compiler API
        silenceDeprecations: ['legacy-js-api'], // Silence legacy API warnings
        // Include paths for @import resolution
        includePaths: [
          path.resolve(__dirname, 'src/styles'),
          path.resolve(__dirname, 'node_modules'),
        ],
      },
    },
    // CSS modules configuration
    modules: {
      localsConvention: 'camelCase', // Convert CSS class names to camelCase
      generateScopedName: process.env.NODE_ENV === 'production'
        ? '[hash:base64:5]' // Short hash in production
        : '[name]__[local]___[hash:base64:5]', // Descriptive names in development
    },
  },

  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'react-bootstrap',
      'bootstrap',
      'react-icons',
      'js-cookie',
      'dompurify',
      'store2',
      '@aws-sdk/client-s3',
      // Pre-bundle stream chat packages to avoid Rollup static import issues
      'stream-chat',
      'stream-chat-react',
      // Prebundle react-helmet and its shallowEqual dependency
      'react-helmet-async',
      'shallowequal',
      'invariant',
      'react-fast-compare',
      'prop-types',
      'react-transition-group',
      'classnames'
    ],
    // Exclude large dependencies from pre-bundling if they're not used immediately
    exclude: ['@aws-sdk/client-s3']
  },
  
};
});
