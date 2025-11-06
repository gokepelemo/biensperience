/** @type { import('@storybook/react-vite').StorybookConfig } */
const config = {
  stories: [
    "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"
  ],
  addons: [
    "@storybook/addon-essentials",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {}
  },
  staticDirs: ["../public"],
  docs: {
    defaultName: 'Documentation',
  },
  async viteFinal(config) {
    // Ensure MDX files are handled correctly
    config.optimizeDeps = config.optimizeDeps || {};
    config.optimizeDeps.include = config.optimizeDeps.include || [];
    config.optimizeDeps.include.push('@storybook/blocks');
    
    // Handle JSX in .js files (for preview.js and story files)
    config.esbuild = config.esbuild || {};
    config.esbuild.loader = 'jsx';
    config.esbuild.include = /\.(jsx?|tsx?)$/;
    
    // Exclude MDX files from esbuild processing (let Storybook's MDX plugin handle them)
    config.esbuild.exclude = /\.mdx$/;
    
    return config;
  },
};

export default config;