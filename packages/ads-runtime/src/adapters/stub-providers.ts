import { MockImageAdapter, type MockImageAdapterMode } from "./mock-image-adapter.js";
import type { ImageGenerationProvider } from "./image-generation-provider.js";

/**
 * "Stub providers" mimic the shape of a real-provider adapter (e.g. one
 * that would call GPT Image / FLUX / Qwen) but never reach the network.
 * They are MockImageAdapter under the hood with a different providerId
 * so the bakeoff harness can compare multiple "providers" side by side.
 *
 * Per recovery task card §9: every provider in the bakeoff must be
 * mock/stub. No external API is called.
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
