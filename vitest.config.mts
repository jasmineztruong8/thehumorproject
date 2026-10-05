import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    // tests/live calls the real Gemini API and is run only by `npm run test:live`
    include: process.env.LIVE ? ["tests/live/**/*.test.ts"] : ["tests/**/*.test.ts"],
    exclude: process.env.LIVE ? [] : ["tests/live/**"],
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
