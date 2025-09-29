module.exports = {
  apps: [
    {
      name: 'biensperience',
      script: 'server.js',
      instances: 1,
      autorestart: true,
      watch: [
        './src',
        './server.js',
        './routes',
        './controllers',
        './models',
        './config'
      ],
  max_memory_restart: '512M',
  // Run build before restart
  pre_restart: 'npm run build',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
