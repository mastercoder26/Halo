import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const windowEntries = [
  "dial-window.html",
  "edge-window.html",
  "media-window.html",
  "onboarding-window.html",
  "settings-window.html",
];

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist/renderer",
    rollupOptions: {
      input: Object.fromEntries(
        windowEntries.map((entry) => [entry.replace(/\.html$/, ""), path.join(projectRoot, entry)]),
      ),
    },
  },
});
