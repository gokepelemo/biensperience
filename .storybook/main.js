/** @type { import('@storybook/react-vite').StorybookConfig } */
const config = {
  stories: [
    "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"
  ],
  addons: [
    {
      name: "@storybook/addon-essentials",
      options: {
        measure: false,
        outline: false
      }
    }
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {}
  },
  staticDirs: ["../public"],
  docs: {
    defaultName: 'Documentation',
  },
  // Include Vite config for path aliases
  async viteFinal(config) {
    // Add path aliases to match main Vite config
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': new URL('../src', import.meta.url).pathname,
      '@components': new URL('../src/components', import.meta.url).pathname,
      '@views': new URL('../src/views', import.meta.url).pathname,
      '@utilities': new URL('../src/utilities', import.meta.url).pathname,
      '@hooks': new URL('../src/hooks', import.meta.url).pathname,
      '@contexts': new URL('../src/contexts', import.meta.url).pathname,
      '@styles': new URL('../src/styles', import.meta.url).pathname,
    };
    return config;
  },
  // Rely on Storybook's default Vite/MDX handling to avoid renderer conflicts
};

export default config;