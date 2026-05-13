import { describe, expect, it } from "vitest";

import { createInMemoryAdsRepositories, RenderJobNotFoundError } from "@homeai/render-jobs";

const POLICY_SNAPSHOT = {
  policyId: "policy_mock_v1",
  providerName: "mock",
  modelName: "mock-deterministic-v1",
  status: "allowed_for_mock" as const,
  maxCandidatesPerRoom: 1,
  maxAttemptsPerJob: 3,
  timeoutMs: 5000,
  maxEstimatedCostCentsPerCandidate: 0,
  commercialUseStatus: "allowed" as const,
  dataRetentionStatus: "acceptable" as const,
  copyrightRisk: "low" as const,
  requiresHumanReview: false
};

const TRACE = {
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
  policySnapshot: POLICY_SNAPSHOT,
  safetyStatus: "not_checked" as const
};

const JOB = {
  renderJobId: "job_demo_001",
  renderSpecId: "rs_demo_001",
  schemeId: "scheme_demo_001",
  roomId: "room_living_001",
  cameraId: "cam_living_north",
  geometryHash: "sha256:fixture_geom",
  status: "queued" as const,
  providerPolicyId: "policy_mock_v1",
  attempt: 1,
  maxAttempts: 3,
  createdAt: "2026-05-13T00:00:00+00:00",
  updatedAt: "2026-05-13T00:00:00+00:00"
};

const CANDIDATE = {
  candidateId: "cand_demo_001",
  renderJobId: "job_demo_001",
  renderSpecId: "rs_demo_001",
  schemeId: "scheme_demo_001",
  roomId: "room_living_001",
  cameraId: "cam_living_north",
  geometryHash: "sha256:fixture_geom",
  status: "created" as const,
  imageUrl: "data:image/svg+xml;base64,AAA",
  providerTrace: TRACE,
  createdAt: "2026-05-13T00:00:00+00:00"
};

describe("ADS Batch 01 — in-memory ADS repositories", () => {
  it("factory creates all four repos with empty state", () => {
    const repos = createInMemoryAdsRepositories();
    expect(repos.jobs.list().length).toBe(0);
    expect(repos.candidates.list().length).toBe(0);
    expect(repos.providerTraces.list().length).toBe(0);
  });

  it("RenderJob repository validates on write and supports filter", () => {
    const repos = createInMemoryAdsRepositories();
    const stored = repos.jobs.create(JOB);
    expect(stored.renderJobId).toEqual("job_demo_001");

    const fetched = repos.jobs.get("job_demo_001");
    expect(fetched).toBeDefined();
    expect(fetched?.status).toBe("queued");

    const updated = repos.jobs.update({ ...stored, status: "running" });
    expect(updated.status).toBe("running");

    const queued = repos.jobs.list({ status: "queued" });
    expect(queued.length).toBe(0);
    const running = repos.jobs.list({ status: "running" });
    expect(running.length).toBe(1);
  });

  it("RenderJob update throws when target id is unknown", () => {
    const repos = createInMemoryAdsRepositories();
    expect(() => repos.jobs.update({ ...JOB, renderJobId: "job_ghost" })).toThrow(RenderJobNotFoundError);
  });

  it("RenderCandidate repository rejects schema-invalid candidate", () => {
    const repos = createInMemoryAdsRepositories();
    expect(() => repos.candidates.create({ ...CANDIDATE, imageUrl: "" })).toThrow();
  });

  it("Candidate list filters by renderJobId / renderSpecId / roomId", () => {
    const repos = createInMemoryAdsRepositories();
    repos.candidates.create(CANDIDATE);
    repos.candidates.create({ ...CANDIDATE, candidateId: "cand_demo_002", renderJobId: "job_other" });

    expect(repos.candidates.list({ renderJobId: "job_demo_001" }).length).toBe(1);
    expect(repos.candidates.list({ renderJobId: "job_other" }).length).toBe(1);
    expect(repos.candidates.list({ renderSpecId: "rs_demo_001" }).length).toBe(2);
    expect(repos.candidates.list({ roomId: "room_living_001" }).length).toBe(2);
    expect(repos.candidates.list({ roomId: "room_kitchen_999" }).length).toBe(0);
  });

  it("ProviderTrace repository links traces to job and candidate", () => {
    const repos = createInMemoryAdsRepositories();
    repos.providerTraces.create(TRACE, { renderJobId: "job_demo_001", candidateId: "cand_demo_001" });

    expect(repos.providerTraces.list({ renderJobId: "job_demo_001" }).length).toBe(1);
    expect(repos.providerTraces.list({ candidateId: "cand_demo_001" }).length).toBe(1);
    expect(repos.providerTraces.get("trace_demo_001")).toBeDefined();
  });

  it("Repository writes deep-clone input so caller mutations do not leak", () => {
    const repos = createInMemoryAdsRepositories();
    const mutable = { ...JOB };
    repos.jobs.create(mutable);
    mutable.status = "verified";
    const stored = repos.jobs.get(JOB.renderJobId);
    expect(stored?.status).toBe("queued");
  });
});
