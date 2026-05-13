import { randomUUID } from "node:crypto";

import {
  listCreativeRenderSpecFixtures,
  loadCreativeRenderSpecFixture,
  validateCreativeRenderSpecForADS,
  type AdsRenderInputValidationResult,
  type AdsSpecValidationIssue,
  type CreativeRenderSpecFixtureName
} from "@homeai/ads-render";
import {
  MockImageAdapter,
  ProviderTraceSchema,
  loadRenderProviderPolicyFixture,
  type RenderProviderPolicy
} from "@homeai/image-adapter";
import {
  RenderCandidateSchema,
  RenderJobSchema,
  createInMemoryAdsRepositories,
  type AdsRepositorySet,
  type RenderCandidate,
  type RenderJob,
  type RenderJobError
} from "@homeai/render-jobs";

const repositories: AdsRepositorySet = createInMemoryAdsRepositories();
const mockAdapter = new MockImageAdapter();
const mockPolicy: RenderProviderPolicy = loadRenderProviderPolicyFixture("mock-allowed");

const now = (): string => new Date().toISOString();
const newId = (prefix: string): string => `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;

export interface CreateRenderJobInput {
  fixtureName?: CreativeRenderSpecFixtureName;
  spec?: unknown;
}

export type CreateRenderJobOutcome =
  | { status: "ok"; job: RenderJob; candidate: RenderCandidate }
  | { status: "spec_invalid"; issues: AdsSpecValidationIssue[] }
  | { status: "provider_failed"; job: RenderJob; reason: string };

export async function runCreateRenderJob(specInput: unknown): Promise<CreateRenderJobOutcome> {
  const validation: AdsRenderInputValidationResult = validateCreativeRenderSpecForADS(specInput);
  if (validation.status === "fail") {
    return { status: "spec_invalid", issues: validation.issues };
  }
  const { spec } = validation;

  const queued: RenderJob = RenderJobSchema.parse({
    renderJobId: newId("job"),
    renderSpecId: spec.renderSpecId,
    schemeId: spec.schemeId,
    roomId: spec.roomId,
    cameraId: spec.cameraId,
    geometryHash: spec.geometryHash,
    status: "queued",
    providerPolicyId: mockPolicy.policyId,
    attempt: 1,
    maxAttempts: mockPolicy.maxAttemptsPerJob,
    createdAt: now(),
    updatedAt: now()
  });
  repositories.jobs.create(queued);

  const running = repositories.jobs.update({
    ...queued,
    status: "running",
    startedAt: now(),
    updatedAt: now()
  });
  let current = repositories.jobs.update({
    ...running,
    status: "provider_pending",
    updatedAt: now()
  });

  try {
    const result = await mockAdapter.generate({
      spec,
      policy: mockPolicy,
      jobId: current.renderJobId,
      attempt: 1
    });
    const traceParsed = ProviderTraceSchema.safeParse(result.providerTrace);
    if (!traceParsed.success || result.imageUrl.length === 0) {
      const error: RenderJobError = {
        code: "malformed",
        message: traceParsed.success
          ? "Mock provider returned empty imageUrl"
          : "Mock provider returned trace that failed schema validation",
        stage: "provider_pending",
        occurredAt: now()
      };
      current = repositories.jobs.update({
        ...current,
        status: "failed",
        completedAt: now(),
        updatedAt: now(),
        error
      });
      return { status: "provider_failed", job: current, reason: error.message };
    }

    const candidateInput: RenderCandidate = {
      candidateId: newId("cand"),
      renderJobId: current.renderJobId,
      renderSpecId: spec.renderSpecId,
      schemeId: spec.schemeId,
      roomId: spec.roomId,
      cameraId: spec.cameraId,
      geometryHash: spec.geometryHash,
      status: "created",
      imageUrl: result.imageUrl,
      providerTrace: result.providerTrace,
      createdAt: now(),
      ...(result.thumbnailUrl === undefined ? {} : { thumbnailUrl: result.thumbnailUrl })
    };
    const candidate = RenderCandidateSchema.parse(candidateInput);
    repositories.candidates.create(candidate);
    repositories.providerTraces.create(result.providerTrace, {
      renderJobId: current.renderJobId,
      candidateId: candidate.candidateId
    });

    current = repositories.jobs.update({
      ...current,
      status: "candidate_generated",
      completedAt: now(),
      updatedAt: now()
    });

    return { status: "ok", job: current, candidate };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    current = repositories.jobs.update({
      ...current,
      status: "failed",
      completedAt: now(),
      updatedAt: now(),
      error: {
        code: "unknown",
        message,
        stage: "provider_pending",
        occurredAt: now()
      }
    });
    return { status: "provider_failed", job: current, reason: message };
  }
}

export async function handleCreateRenderJobRequest(request: Request): Promise<Response> {
  let body: CreateRenderJobInput;
  try {
    body = (await readJson(request)) as CreateRenderJobInput;
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Invalid JSON body" },
      { status: 400 }
    );
  }
  const specInput =
    body.spec ?? (body.fixtureName !== undefined ? loadCreativeRenderSpecFixture(body.fixtureName) : undefined);
  if (specInput === undefined) {
    return Response.json(
      { error: "Body must include either `spec` or `fixtureName`" },
      { status: 400 }
    );
  }
  const outcome = await runCreateRenderJob(specInput);
  if (outcome.status === "spec_invalid") {
    return Response.json(outcome, { status: 422 });
  }
  if (outcome.status === "provider_failed") {
    return Response.json(outcome, { status: 502 });
  }
  return Response.json(outcome);
}

export function handleGetRenderJobRequest(renderJobId: string): Response {
  const job = repositories.jobs.get(renderJobId);
  if (job === undefined) {
    return Response.json({ error: `RenderJob ${renderJobId} not found` }, { status: 404 });
  }
  return Response.json({ job });
}

export function handleListCandidatesRequest(url: URL): Response {
  const filter: { renderJobId?: string; renderSpecId?: string; roomId?: string } = {};
  const renderJobId = url.searchParams.get("renderJobId");
  const renderSpecId = url.searchParams.get("renderSpecId");
  const roomId = url.searchParams.get("roomId");
  if (renderJobId !== null) filter.renderJobId = renderJobId;
  if (renderSpecId !== null) filter.renderSpecId = renderSpecId;
  if (roomId !== null) filter.roomId = roomId;
  const candidates = repositories.candidates.list(filter);
  return Response.json({ candidates });
}

export function handleGetVerificationRequest(candidateId: string): Response {
  const report = repositories.verifications.getLatestByCandidate(candidateId);
  if (report === undefined) {
    return Response.json(
      {
        status: "pending",
        message: "RenderVerifier L1 lands in ADS Batch 03; no report yet.",
        candidateId
      },
      { status: 200 }
    );
  }
  return Response.json({ report });
}

export function listSpecFixturesForDebug(): readonly CreativeRenderSpecFixtureName[] {
  return listCreativeRenderSpecFixtures();
}

export function getRepositorySnapshotForDebug(): {
  jobs: number;
  candidates: number;
  traces: number;
} {
  return {
    jobs: repositories.jobs.list().length,
    candidates: repositories.candidates.list().length,
    traces: repositories.providerTraces.list().length
  };
}

async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.trim().length === 0) return {};
  return JSON.parse(text);
}
