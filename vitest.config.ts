import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// The `@/` alias matches tsconfig, so tests import modules by the same
// specifier the app uses and can't drift onto a different file.
export default defineConfig({
  resolve: { alias: { "@": resolve(__dirname, ".") } },
  test: {
    environment: "node",
    include: ["lib/__tests__/**/*.test.ts"],
  },
});
