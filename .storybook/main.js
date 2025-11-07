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
  // Rely on Storybook's default Vite/MDX handling to avoid renderer conflicts
};

export default config;