// Storybook configuration: the Next.js-on-Vite framework so components render
// exactly as the app does, plus accessibility checks and Vitest-driven
// interaction tests (the play functions run in real Chromium in CI).
import type { StorybookConfig } from "@storybook/nextjs-vite";

const config: StorybookConfig = {
  framework: "@storybook/nextjs-vite",
  stories: ["../src/**/*.stories.tsx"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y", "@storybook/addon-vitest"],
};

export default config;
