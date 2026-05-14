import {
  CreativeRenderSpecSchema,
  RenderCandidateSchema,
  RenderJobSchema,
  type CreativeRenderSpec,
  type RenderCandidate,
  type RenderJob
} from "@homeai/contracts";

export type MockRenderCandidateMode =
  | "all_pass_assets"
  | "missing_asset_for_one_room"
  | "geometry_mismatch_for_one_candidate";

const DEFAULT_CREATED_AT = "2026-05-14T00:00:00.000Z";

export function buildMockRenderCandidates(input: {
  renderJob: RenderJob;
  creativeRenderSpecs: CreativeRenderSpec[];
  mode?: MockRenderCandidateMode;
  createdAt?: string;
}): RenderCandidate[] {
  const renderJob = RenderJobSchema.parse(clone(input.renderJob));
  const specs = input.creativeRenderSpecs.map((spec) => CreativeRenderSpecSchema.parse(clone(spec)));
  const mode = input.mode ?? "all_pass_assets";
  const createdAt = input.createdAt ?? DEFAULT_CREATED_AT;
  const sortedSpecs = [...specs].sort((a, b) => a.renderSpecId.localeCompare(b.renderSpecId));

  return deepFreeze(sortedSpecs.map((spec, index) => {
    if (
      spec.schemeId !== renderJob.schemeId ||
      spec.sceneContractId !== renderJob.sceneContractId ||
      spec.geometryHash !== renderJob.geometryHash
    ) {
      throw new Error(`CreativeRenderSpec trace does not match RenderJob: ${spec.renderSpecId}.`);
    }

    const missingAsset = mode === "missing_asset_for_one_room" && index === 0;
    const geometryMismatch = mode === "geometry_mismatch_for_one_candidate" && index === 0;
    const candidateGeometryHash = geometryMismatch ? `sha256:${"b".repeat(64)}` : spec.geometryHash;
    const renderCandidateId = `render-candidate-${spec.renderSpecId}`;

    return RenderCandidateSchema.parse({
      renderCandidateId,
      renderJobId: renderJob.renderJobId,
      renderSpecId: spec.renderSpecId,
      schemeId: spec.schemeId,
      roomId: spec.roomId,
      cameraId: spec.cameraId,
      geometryHash: candidateGeometryHash,
      provider: {
        providerId: "mock_render_provider",
        providerKind: "mock",
        modelId: "mock",
        adapterVersion: "0.1.0"
      },
      output: missingAsset
        ? {}
        : {
            imageUrl: `mock://render/${renderJob.renderJobId}/${spec.renderSpecId}.png`,
            thumbnailUrl: `mock://render/${renderJob.renderJobId}/${spec.renderSpecId}-thumb.png`,
            artifactHash: `mock-artifact-${spec.renderSpecId}`,
            width: 1024,
            height: 768,
            mimeType: "image/png"
          },
      status: "verification_pending",
      galleryEligibility: missingAsset
        ? "blocked_missing_asset"
        : geometryMismatch
          ? "blocked_geometry_mismatch"
          : "blocked_pending_verification",
      trace: {
        traceId: `render-candidate-trace-${renderCandidateId}`,
        sourceModule: "render_candidate_builder",
        networkCalls: false,
        providerCalls: [
          {
            providerId: "mock_render_provider",
            providerKind: "mock",
            startedAt: createdAt,
            completedAt: createdAt,
            status: "success"
          }
        ],
        inputHashes: {
          geometryHash: candidateGeometryHash,
          renderSpecHash: spec.renderSpecId,
          ...(missingAsset ? {} : { candidateOutputHash: `mock-artifact-${spec.renderSpecId}` })
        },
        warnings: missingAsset ? ["mock candidate is missing an output asset"] : []
      },
      createdAt
    });
  }));
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const key of Reflect.ownKeys(value)) {
    deepFreeze((value as Record<PropertyKey, unknown>)[key]);
  }
  return Object.freeze(value);
}
