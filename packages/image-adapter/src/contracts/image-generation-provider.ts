import type { CreativeRenderSpecConsumer } from "@homeai/ads-render";

import type { ProviderTrace } from "./provider-trace.js";
import type { RenderProviderPolicy } from "./render-provider-policy.js";

export interface ImageProviderCapabilities {
  supportsControlRender: boolean;
  supportsDepth: boolean;
  supportsSemanticMask: boolean;
  supportsLineMap: boolean;
  supportsLockedGeometryMask: boolean;
  supportsAnchorLayoutMask: boolean;
  maxCandidatesPerRequest: number;
}

export interface ProviderCostEstimate {
  estimatedCostCents: number;
  currency: "USD" | "CNY" | "EUR" | "GBP";
}

export interface ImageGenerationInput {
  spec: CreativeRenderSpecConsumer;
  policy: RenderProviderPolicy;
  jobId: string;
  attempt: number;
}

export interface ImageGenerationResult {
  imageUrl: string;
  thumbnailUrl?: string;
  providerTrace: ProviderTrace;
}

export interface ImageGenerationProvider {
  readonly providerName: string;
  readonly providerModel: string;
  readonly adapterVersion: string;
  capabilities(): ImageProviderCapabilities;
  estimateCost(input: ImageGenerationInput): Promise<ProviderCostEstimate>;
  generate(input: ImageGenerationInput): Promise<ImageGenerationResult>;
}
