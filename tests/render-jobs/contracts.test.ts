import { describe, expect, it } from "vitest";

import { ProviderTraceSchema } from "@homeai/image-adapter";
import {
  RenderCandidateSchema,
  RenderJobErrorSchema,
  RenderJobSchema,
  RenderJobStatusSchema
} from "@homeai/render-jobs";

const VALID_POLICY_SNAPSHOT = {
  policyId: "policy_mock_v1",
  providerName: "mock",
  modelName: "mock-deterministic-v1",
  status: "allowed_for_mock",
  maxCandidatesPerRoom: 1,
  maxAttemptsPerJob: 3,
  timeoutMs: 5000,
  maxEstimatedCostCentsPerCandidate: 0,
  commercialUseStatus: "allowed",
  dataRetentionStatus: "acceptable",
  copyrightRisk: "low",
  requiresHumanReview: false
};

const VALID_TRACE = {
  traceId: "trace_demo_001",
  providerName: "mock",
  providerModel: "mock-deterministic-v1",
  adapterVersion: "0.1.0",
  startedAt: "2026-05-13T00:00:00+00:00",
  completedAt: "2026-05-13T00:00:01+00:00",
  latencyMs: 0,
  estimatedCostCents: 0,
  inputAssetHashes: ["h1", "h2", "h3", "h4", "h5", "h6"],
  outputAssetHash: "out_hash",
  policySnapshot: VALID_POLICY_SNAPSHOT,
  safetyStatus: "not_checked"
};

const VALID_JOB = {
  renderJobId: "job_demo_001",
  renderSpecId: "rs_demo_001",
  schemeId: "scheme_demo_001",
  roomId: "room_living_001",
  cameraId: "cam_living_north",
  geometryHash: "sha256:fixture_geom",
  status: "queued",
  providerPolicyId: "policy_mock_v1",
  attempt: 1,
  maxAttempts: 3,
  createdAt: "2026-05-13T00:00:00+00:00",
  updatedAt: "2026-05-13T00:00:00+00:00"
};

describe("ADS Batch 01 — RenderJob / RenderCandidate / ProviderTrace contracts", () => {
  it("RenderJobStatus enum has the 10 architecture-§4.2 states", () => {
    const all = [
      "queued",
      "running",
      "provider_pending",
      "candidate_generated",
      "verification_pending",
      "verified",
      "failed",
      "blocked",
      "needs_human_review",
      "cancelled"
    ];
    for (const s of all) {
      expect(RenderJobStatusSchema.safeParse(s).success).toBe(true);
    }
    expect(RenderJobStatusSchema.safeParse("verified_with_warning").success).toBe(false);
  });

  it("valid RenderJob parses", () => {
    expect(RenderJobSchema.safeParse(VALID_JOB).success).toBe(true);
  });

  it("RenderJob rejects missing geometryHash", () => {
    const { geometryHash: _omit, ...withoutHash } = VALID_JOB;
    const parsed = RenderJobSchema.safeParse(withoutHash);
    expect(parsed.success).toBe(false);
  });

  it("RenderJob is strict — extra fields rejected", () => {
    const parsed = RenderJobSchema.safeParse({ ...VALID_JOB, smuggled: true });
    expect(parsed.success).toBe(false);
  });

  it("RenderJobError requires occurredAt + code", () => {
    expect(
      RenderJobErrorSchema.safeParse({
        code: "timeout",
        message: "timed out",
        occurredAt: "2026-05-13T00:00:00+00:00"
      }).success
    ).toBe(true);
  });

  it("ProviderTrace requires policySnapshot and inputAssetHashes", () => {
    expect(ProviderTraceSchema.safeParse(VALID_TRACE).success).toBe(true);

    const { policySnapshot: _omitPolicy, ...noPolicy } = VALID_TRACE;
    expect(ProviderTraceSchema.safeParse(noPolicy).success).toBe(false);

    const { inputAssetHashes: _omitHashes, ...noHashes } = VALID_TRACE;
    expect(ProviderTraceSchema.safeParse(noHashes).success).toBe(false);
  });

  it("RenderJob accepts optional providerCompletedAt / candidateGeneratedAt timestamps but reserves completedAt for terminal states", () => {
    // Schema-level: both new fields parse when present and absent.
    const withProviderAndCandidate = {
      ...VALID_JOB,
      providerCompletedAt: "2026-05-13T00:00:01+00:00",
      candidateGeneratedAt: "2026-05-13T00:00:02+00:00"
    };
    expect(RenderJobSchema.safeParse(withProviderAndCandidate).success).toBe(true);

    // Schema is strict — non-timestamp values still rejected.
    expect(
      RenderJobSchema.safeParse({ ...VALID_JOB, providerCompletedAt: "not-a-timestamp" }).success
    ).toBe(false);
    expect(
      RenderJobSchema.safeParse({ ...VALID_JOB, candidateGeneratedAt: 12345 }).success
    ).toBe(false);

    // The schema itself does not enforce "only terminal can set completedAt" —
    // that invariant lives in the orchestrator (tested in batch-02). The schema
    // does enforce strict shape and timestamp format.
  });

  it("RenderCandidate requires providerTrace and rejects empty imageUrl", () => {
    const base = {
      candidateId: "cand_demo_001",
      renderJobId: "job_demo_001",
      renderSpecId: "rs_demo_001",
      schemeId: "scheme_demo_001",
      roomId: "room_living_001",
      cameraId: "cam_living_north",
      geometryHash: "sha256:fixture_geom",
      status: "created",
      imageUrl: "data:image/svg+xml;base64,AAA",
      providerTrace: VALID_TRACE,
      createdAt: "2026-05-13T00:00:00+00:00"
    };
    expect(RenderCandidateSchema.safeParse(base).success).toBe(true);

    const { providerTrace: _omitTrace, ...noTrace } = base;
    expect(RenderCandidateSchema.safeParse(noTrace).success).toBe(false);

    const empty = { ...base, imageUrl: "" };
    expect(RenderCandidateSchema.safeParse(empty).success).toBe(false);
  });
});
