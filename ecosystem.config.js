module.exports = {
  apps: [
    {
      name: 'biensperience-api',
      script: 'bun',
      args: 'run server.js',
      instances: 1,
      autorestart: true,
      watch: [
        './server.js',
        './routes',
        './controllers',
        './models',
        './config',
        './utilities'
      ],
      ignore_watch: [
        'node_modules',
        'logs',
        '*.log',
        'uploads',
        'build',
        'dist',
        '.git'
      ],
      max_memory_restart: '512M',
      version: '1.0.0',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
    {
      name: 'biensperience-frontend',
      script: 'bun',
      // Run Vite dev server so frontend changes apply immediately.
      // NOTE: In production, the API server serves the built frontend from /build.
      args: 'run dev',
      instances: 1,
      autorestart: true,
      watch: [
        './src',
        './public',
        './index.html',
        './vite.config.js'
      ],
      ignore_watch: [
        'node_modules',
        'logs',
        '*.log',
        'build',
        'dist',
        '.git',
        'src/**/*.test.js',
        'src/**/*.test.jsx',
        'src/data/fallback-exchange-rates.json'
      ],
      max_memory_restart: '512M',
      version: '1.0.0',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
