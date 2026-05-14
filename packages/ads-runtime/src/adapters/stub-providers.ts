import { MockImageAdapter, type MockImageAdapterMode } from "./mock-image-adapter.js";
import type { ImageGenerationProvider } from "./image-generation-provider.js";

/**
 * "Stub providers" mimic the shape of a future real-provider adapter
 * but never reach the network. They are MockImageAdapter instances
 * under different providerIds so the bakeoff harness can compare
 * multiple "providers" side by side without external dependencies.
 *
 * Per recovery task card §9: every provider in the bakeoff must be
 * mock/stub. No external API is called. The blocked-report at
 * docs/ads/real-provider-spike-gate.md lists which real providers
 * remain pending; this file intentionally names none of them.
 */
export function createStubProvider(options: {
  providerId: string;
  providerName: string;
  modelId: string;
  mode?: MockImageAdapterMode;
}): ImageGenerationProvider {
  return new MockImageAdapter({
    providerId: options.providerId,
    providerName: options.providerName,
    modelId: options.modelId,
    adapterVersion: "0.1.0-stub",
    mode: options.mode ?? "normal"
  });
}

export function createDefaultStubProviderSuite(): ImageGenerationProvider[] {
  return [
    createStubProvider({ providerId: "stub_a_normal", providerName: "Stub A", modelId: "stub-a" }),
    createStubProvider({ providerId: "stub_b_normal", providerName: "Stub B", modelId: "stub-b" }),
    createStubProvider({
      providerId: "stub_c_missing_asset",
      providerName: "Stub C (missing asset)",
      modelId: "stub-c",
      mode: "missing_asset"
    })
  ];
}
