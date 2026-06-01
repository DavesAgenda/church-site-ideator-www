import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["lib/parking/**", "lib/geocode/**", "lib/viewport/**"],
      reporter: ["text", "text-summary"],
    },
  },
});
