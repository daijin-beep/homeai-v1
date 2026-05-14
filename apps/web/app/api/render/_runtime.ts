import { randomUUID } from "node:crypto";

import {
  listCreativeRenderSpecFixtures,
  loadCreativeRenderSpecFixture,
  type CreativeRenderSpecFixtureName
} from "@homeai/ads-render";
import {
  MockImageAdapter,
  loadRenderProviderPolicyFixture,
  type MockImageAdapterMode,
  type RenderProviderPolicy
} from "@homeai/image-adapter";
import {
  createInMemoryAdsRepositories,
  createInMemorySpecStore,
  createRenderJob,
  createRetryPlan,
  startRenderJob,
  type AdsRepositorySet,
  type CreateRenderJobOutcome,
  type OrchestratorDeps,
  type RetryOutcome,
  type SpecStore,
  type StartRenderJobOutcome
} from "@homeai/render-jobs";

const repos: AdsRepositorySet = createInMemoryAdsRepositories();
const specStore: SpecStore = createInMemorySpecStore();
const mockModeStore = new Map<string, MockImageAdapterMode>();
const policy: RenderProviderPolicy = loadRenderProviderPolicyFixture("mock-allowed");

const clock = { now: (): string => new Date().toISOString() };
const ids = {
  newId: (prefix: string): string => `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 16)}`
};
const adapters: Record<MockImageAdapterMode, MockImageAdapter> = {
  normal: new MockImageAdapter({ mode: "normal", clock }),
  timeout: new MockImageAdapter({ mode: "timeout", clock }),
  malformed: new MockImageAdapter({ mode: "malformed", clock }),
  storage_fail: new MockImageAdapter({ mode: "storage_fail", clock })
};

const MOCK_MODES: ReadonlyArray<MockImageAdapterMode> = ["normal", "timeout", "malformed", "storage_fail"];

function depsFor(mode: MockImageAdapterMode): OrchestratorDeps {
  return { adapter: adapters[mode], policy, repos, specStore, clock, ids };
}

export interface CreateRenderJobInput {
  fixtureName?: CreativeRenderSpecFixtureName;
  spec?: unknown;
  mockMode?: MockImageAdapterMode;
}

export type RunCreateAndStartOutcome =
  | { status: "ok"; phase: "create_only"; job: import("@homeai/render-jobs").RenderJob }
  | StartRenderJobOutcome
  | { status: "spec_invalid"; issues: import("@homeai/ads-render").AdsSpecValidationIssue[] }
  | { status: "policy_denied"; reason: string };

export async function runCreateAndStart(
  specInput: unknown,
  mode: MockImageAdapterMode = "normal"
): Promise<RunCreateAndStartOutcome> {
  const createOutcome = await createRenderJob(specInput, depsFor(mode));
  if (createOutcome.status !== "ok") {
    return createOutcome;
  }
  mockModeStore.set(createOutcome.job.renderJobId, mode);
  return startRenderJob(createOutcome.job.renderJobId, depsFor(mode));
}

export async function handleCreateRenderJobRequest(request: Request): Promise<Response> {
  let body: CreateRenderJobInput;
  try {
    body = (await readJson(request)) as CreateRenderJobInput;
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Invalid JSON body" }, { status: 400 });
  }
  const specInput =
    body.spec ?? (body.fixtureName !== undefined ? loadCreativeRenderSpecFixture(body.fixtureName) : undefined);
  if (specInput === undefined) {
    return Response.json({ error: "Body must include either `spec` or `fixtureName`" }, { status: 400 });
  }
  const mode = normalizeMode(body.mockMode);
  const outcome: CreateRenderJobOutcome = await createRenderJob(specInput, depsFor(mode));
  if (outcome.status === "spec_invalid") {
    return Response.json(outcome, { status: 422 });
  }
  if (outcome.status === "policy_denied") {
    return Response.json(outcome, { status: 403 });
  }
  mockModeStore.set(outcome.job.renderJobId, mode);
  return Response.json(outcome);
}

export async function handleStartRenderJobRequest(renderJobId: string): Promise<Response> {
  const job = repos.jobs.get(renderJobId);
  if (job === undefined) {
    return Response.json({ error: `RenderJob ${renderJobId} not found` }, { status: 404 });
  }
  const mode = mockModeStore.get(renderJobId) ?? "normal";
  try {
    const outcome = await startRenderJob(renderJobId, depsFor(mode));
    if (outcome.status === "failed") {
      return Response.json(outcome, { status: 502 });
    }
    return Response.json(outcome);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unknown orchestrator error" },
      { status: 500 }
    );
  }
}

export async function handleRetryRenderJobRequest(renderJobId: string): Promise<Response> {
  const job = repos.jobs.get(renderJobId);
  if (job === undefined) {
    return Response.json({ error: `RenderJob ${renderJobId} not found` }, { status: 404 });
  }
  const mode = mockModeStore.get(renderJobId) ?? "normal";
  let plan: RetryOutcome;
  try {
    plan = createRetryPlan(renderJobId, depsFor(mode));
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unknown retry error" },
      { status: 500 }
    );
  }
  if (plan.status === "ok") {
    const startOutcome = await startRenderJob(plan.nextJob.renderJobId, depsFor(mode));
    return Response.json({ retry: plan, start: startOutcome });
  }
  if (plan.status === "exhausted") {
    return Response.json(plan, { status: 409 });
  }
  return Response.json(plan, { status: 409 });
}

export function handleGetRenderJobRequest(renderJobId: string): Response {
  const job = repos.jobs.get(renderJobId);
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
  const candidates = repos.candidates.list(filter);
  return Response.json({ candidates });
}

export function handleGetCandidateRequest(candidateId: string): Response {
  const candidate = repos.candidates.get(candidateId);
  if (candidate === undefined) {
    return Response.json({ error: `RenderCandidate ${candidateId} not found` }, { status: 404 });
  }
  return Response.json({ candidate });
}

export function handleGetVerificationRequest(candidateId: string): Response {
  const report = repos.verifications.getLatestByCandidate(candidateId);
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

export function listMockModes(): ReadonlyArray<MockImageAdapterMode> {
  return MOCK_MODES;
}

export function getRepositorySnapshotForDebug(): {
  jobs: number;
  candidates: number;
  traces: number;
} {
  return {
    jobs: repos.jobs.list().length,
    candidates: repos.candidates.list().length,
    traces: repos.providerTraces.list().length
  };
}

function normalizeMode(raw: MockImageAdapterMode | string | undefined): MockImageAdapterMode {
  if (raw === undefined) return "normal";
  return (MOCK_MODES as ReadonlyArray<string>).includes(raw) ? (raw as MockImageAdapterMode) : "normal";
}

async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.trim().length === 0) return {};
  return JSON.parse(text);
}
