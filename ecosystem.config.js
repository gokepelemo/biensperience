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
      max_memory_restart: '512M',
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
      watch: false, // Vite has its own HMR
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
