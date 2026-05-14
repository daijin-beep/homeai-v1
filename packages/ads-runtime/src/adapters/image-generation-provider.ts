import type {
  CreativeRenderSpec,
  RenderCandidate,
  RenderJob
} from "@homeai/contracts";

import type { RenderProviderPolicy } from "../policy/render-provider-policy.js";

/**
 * Provider-agnostic adapter interface. Implementations produce a single
 * canonical RenderCandidate from a CreativeRenderSpec.
 *
 * D-036: the return type is the canonical @homeai/contracts shape. No
 * package-local "AdapterResult" sneaks into adapters.
 */
export interface ImageGenerationProvider {
  readonly providerId: string;
  readonly providerName: string;
  readonly providerKind: "mock" | "external_adapter_placeholder";
  readonly modelId: string;
  readonly adapterVersion: string;
  /**
   * Generate a single canonical RenderCandidate for one spec. The adapter
   * is responsible for ensuring:
   *   - candidate.geometryHash === spec.geometryHash
   *   - candidate.trace is well-formed (canonical RenderTraceSchema)
   *   - candidate.output.imageUrl / artifactHash are set on success;
   *     left undefined on intentional missing-asset modes
   *   - candidate.status = "verification_pending"
   *
   * Adapters MUST NOT call the network. Real provider integration lives
   * behind a separate gated scaffold (Batch 06).
   */
  generate(input: ImageGenerationInput): Promise<RenderCandidate>;
}

export interface ImageGenerationInput {
  spec: CreativeRenderSpec;
  renderJob: RenderJob;
  policy: RenderProviderPolicy;
  candidateId: string;
  requestedAt: string;
}
