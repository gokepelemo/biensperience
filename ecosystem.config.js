module.exports = {
  apps: [
    {
      name: 'biensperience-api',
      script: 'server.js',
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
      script: 'npm',
      args: 'start',
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
        'src/**/*.test.jsx'
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
