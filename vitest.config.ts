import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@homeai/contracts": fileURLToPath(new URL("./packages/contracts/src/index.ts", import.meta.url)),
      "@homeai/creative-render-spec": fileURLToPath(new URL("./packages/creative-render-spec/src/index.ts", import.meta.url)),
      "@homeai/creative-render-spec/fixtures": fileURLToPath(new URL("./packages/creative-render-spec/src/fixtures.ts", import.meta.url)),
      "@homeai/design-kernel": fileURLToPath(new URL("./packages/design-kernel/src/index.ts", import.meta.url)),
      "@homeai/geometry": fileURLToPath(new URL("./packages/geometry/src/index.ts", import.meta.url)),
      "@homeai/floorplan-parser": fileURLToPath(new URL("./packages/floorplan-parser/src/index.ts", import.meta.url)),
      "@homeai/render-pipeline": fileURLToPath(new URL("./packages/render-pipeline/src/index.ts", import.meta.url)),
      "@homeai/scheme-page": fileURLToPath(new URL("./packages/scheme-page/src/index.ts", import.meta.url)),
      "@homeai/scheme-page/fixtures": fileURLToPath(new URL("./packages/scheme-page/src/fixtures.ts", import.meta.url)),
      "@homeai/scene": fileURLToPath(new URL("./packages/scene/src/index.ts", import.meta.url)),
      "@homeai/ads-render": fileURLToPath(new URL("./packages/ads-render/src/index.ts", import.meta.url)),
      "@homeai/render-verifier": fileURLToPath(new URL("./packages/render-verifier/src/index.ts", import.meta.url)),
      "@homeai/ads-runtime": fileURLToPath(new URL("./packages/ads-runtime/src/index.ts", import.meta.url))
    }
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"]
  }
});
