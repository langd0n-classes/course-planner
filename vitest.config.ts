import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    maxWorkers: 4,
    testTimeout: 15_000,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "scripts/**/*.test.ts"],
    exclude: ["e2e/**"],
    setupFiles: ["./src/test/setup.ts"],
  },
  resolve: {
    alias: {
      "@/auth": path.resolve(__dirname, "auth.ts"),
      "@": path.resolve(__dirname, "src"),
    },
  },
});
