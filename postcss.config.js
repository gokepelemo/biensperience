module.exports = {
  plugins: {
    // Ensure consistent CSS processing across environments
    'postcss-preset-env': {
      stage: 1, // Enable modern CSS features
      autoprefixer: {
        grid: true, // Enable CSS Grid autoprefixing
      },
      features: {
        'custom-properties': {
          preserve: true, // Preserve CSS custom properties for runtime theming
        },
        'nesting-rules': true, // Enable CSS nesting
      },
    },
    // CSS minification with consistent settings
    cssnano: process.env.NODE_ENV === 'production' ? {
      preset: [
        'default',
        {
          discardComments: {
            removeAll: true,
          },
          normalizeWhitespace: true,
          colormin: true,
          convertValues: true,
          reduceInitial: true,
          reduceTransforms: true,
          svgo: true,
        },
      ],
    } : false,
  },
};