import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts", "src/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          // Integration tests share one PostgreSQL database: run serially.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
          setupFiles: ["tests/integration/setup.ts"],
        },
      },
    ],
  },
});
