// Global story settings: the app's CSS, and a11y violations treated as test
// failures so "fix what it flags" is enforced rather than hoped for.
import type { Preview } from "@storybook/nextjs-vite";
import "../src/app/globals.css";

const preview: Preview = {
  parameters: {
    a11y: { test: "error" },
    layout: "padded",
  },
};

export default preview;
