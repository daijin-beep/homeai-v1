import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@homeai/contracts": fileURLToPath(new URL("./packages/contracts/src/index.ts", import.meta.url)),
      "@homeai/geometry": fileURLToPath(new URL("./packages/geometry/src/index.ts", import.meta.url)),
      "@homeai/floorplan-parser": fileURLToPath(new URL("./packages/floorplan-parser/src/index.ts", import.meta.url)),
      "@homeai/scene": fileURLToPath(new URL("./packages/scene/src/index.ts", import.meta.url)),
      "@homeai/ads-render": fileURLToPath(new URL("./packages/ads-render/src/index.ts", import.meta.url)),
      "@homeai/image-adapter": fileURLToPath(new URL("./packages/image-adapter/src/index.ts", import.meta.url)),
      "@homeai/render-verifier": fileURLToPath(new URL("./packages/render-verifier/src/index.ts", import.meta.url)),
      "@homeai/render-jobs": fileURLToPath(new URL("./packages/render-jobs/src/index.ts", import.meta.url))
    }
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"]
  }
});
