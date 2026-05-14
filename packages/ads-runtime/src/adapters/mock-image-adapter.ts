import {
  RenderCandidateSchema,
  type RenderCandidate
} from "@homeai/contracts";

import type {
  ImageGenerationInput,
  ImageGenerationProvider
} from "./image-generation-provider.js";

/**
 * Deterministic, in-process mock adapter. Produces a canonical
 * RenderCandidate (D-036 compliant) without any network call.
 *
 * Modes:
 *   "normal"       — well-formed output, all assets present
 *   "missing_asset" — output.imageUrl/artifactHash omitted (caller's
 *                      verifier should report output_asset_present=fail)
 *   "drift_hash"   — candidate.geometryHash is shifted to provoke
 *                     geometry_hash_match fail
 */
export type MockImageAdapterMode = "normal" | "missing_asset" | "drift_hash";

export interface MockImageAdapterOptions {
  providerId?: string;
  providerName?: string;
  modelId?: string;
  adapterVersion?: string;
  mode?: MockImageAdapterMode;
  // Hex digit substitute for drift_hash mode; must be in [a-f0-9].
  driftHashChar?: string;
}

export class MockImageAdapter implements ImageGenerationProvider {
  readonly providerId: string;
  readonly providerName: string;
  readonly providerKind = "mock" as const;
  readonly modelId: string;
  readonly adapterVersion: string;
  readonly #mode: MockImageAdapterMode;
  readonly #driftHashChar: string;

  constructor(options: MockImageAdapterOptions = {}) {
    this.providerId = options.providerId ?? "mock_render_provider";
    this.providerName = options.providerName ?? "MockImageAdapter";
    this.modelId = options.modelId ?? "mock";
    this.adapterVersion = options.adapterVersion ?? "0.1.0";
    this.#mode = options.mode ?? "normal";
    this.#driftHashChar = options.driftHashChar ?? "f";
  }

  async generate(input: ImageGenerationInput): Promise<RenderCandidate> {
    const { spec, renderJob, candidateId, requestedAt } = input;
    if (renderJob.geometryHash !== spec.geometryHash) {
      throw new Error("MockImageAdapter: renderJob and spec geometryHash must agree");
    }

    const candidateGeometryHash =
      this.#mode === "drift_hash"
        ? `sha256:${this.#driftHashChar.repeat(64)}`
        : spec.geometryHash;

    const missingAsset = this.#mode === "missing_asset";
    const artifactHash = missingAsset ? undefined : `mock-artifact-${candidateId}-${this.providerId}`;
    const imageUrl = missingAsset
      ? undefined
      : `mock://render/${renderJob.renderJobId}/${spec.renderSpecId}/${this.providerId}.png`;
    const thumbnailUrl = missingAsset ? undefined : imageUrl?.replace(/\.png$/, "-thumb.png");

    const candidateInput: Record<string, unknown> = {
      renderCandidateId: candidateId,
      renderJobId: renderJob.renderJobId,
      renderSpecId: spec.renderSpecId,
      schemeId: spec.schemeId,
      roomId: spec.roomId,
      cameraId: spec.cameraId,
      geometryHash: candidateGeometryHash,
      provider: {
        providerId: this.providerId,
        providerKind: this.providerKind,
        modelId: this.modelId,
        adapterVersion: this.adapterVersion
      },
      output: missingAsset
        ? {}
        : {
            imageUrl,
            thumbnailUrl,
            artifactHash,
            width: 1024,
            height: 768,
            mimeType: "image/png" as const
          },
      status: "verification_pending" as const,
      galleryEligibility: missingAsset
        ? ("blocked_missing_asset" as const)
        : this.#mode === "drift_hash"
          ? ("blocked_geometry_mismatch" as const)
          : ("blocked_pending_verification" as const),
      trace: {
        traceId: `mock-trace-${candidateId}-${this.providerId}`,
        sourceModule: "render_candidate_builder" as const,
        networkCalls: false,
        providerCalls: [
          {
            providerId: this.providerId,
            providerKind: "mock" as const,
            startedAt: requestedAt,
            completedAt: requestedAt,
            status: "success" as const
          }
        ],
        inputHashes: {
          geometryHash: candidateGeometryHash,
          renderSpecHash: spec.renderSpecId,
          ...(artifactHash === undefined ? {} : { candidateOutputHash: artifactHash })
        },
        warnings: missingAsset ? ["mock adapter produced no output asset"] : []
      },
      createdAt: requestedAt
    };
    return RenderCandidateSchema.parse(candidateInput);
  }
}
