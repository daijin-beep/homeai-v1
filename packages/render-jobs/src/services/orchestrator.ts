import {
  validateCreativeRenderSpecForADS,
  type AdsRenderInputValidationResult,
  type AdsSpecValidationIssue,
  type CreativeRenderSpecConsumer
} from "@homeai/ads-render";
import {
  MockImageAdapterError,
  ProviderTraceSchema,
  RenderProviderPolicyError,
  assertProviderAllowedForJob,
  type ImageGenerationProvider,
  type ImageGenerationResult,
  type RenderProviderPolicy
} from "@homeai/image-adapter";

import { RenderCandidateSchema, type RenderCandidate } from "../contracts/render-candidate.js";
import { RenderJobSchema, type RenderJob, type RenderJobError } from "../contracts/render-job.js";
import {
  IllegalRenderJobTransitionError,
  RenderCandidateValidationError,
  RenderJobNotFoundError
} from "../errors/job-errors.js";
import type { AdsRepositorySet } from "../repositories/interfaces.js";
import { assertTransition, isTerminal } from "../state/state-machine.js";

export interface OrchestratorClock {
  now(): string;
}

export interface OrchestratorIdGenerator {
  newId(prefix: string): string;
}

/**
 * SpecStore is a small caller-owned cache keyed by renderJobId. Batch 02 lives
 * on fixtures, so the orchestrator does not own a spec repository; the caller
 * (runtime or test) decides where specs live. The orchestrator only reads.
 */
export interface SpecStore {
  set(renderJobId: string, spec: CreativeRenderSpecConsumer): void;
  get(renderJobId: string): CreativeRenderSpecConsumer | undefined;
  delete(renderJobId: string): void;
}

export function createInMemorySpecStore(): SpecStore {
  const map = new Map<string, CreativeRenderSpecConsumer>();
  return {
    set: (id, spec) => {
      map.set(id, spec);
    },
    get: (id) => map.get(id),
    delete: (id) => {
      map.delete(id);
    }
  };
}

export interface OrchestratorDeps {
  adapter: ImageGenerationProvider;
  policy: RenderProviderPolicy;
  repos: AdsRepositorySet;
  specStore: SpecStore;
  clock: OrchestratorClock;
  ids: OrchestratorIdGenerator;
}

export type CreateRenderJobOutcome =
  | { status: "ok"; job: RenderJob }
  | { status: "spec_invalid"; issues: AdsSpecValidationIssue[] }
  | { status: "policy_denied"; reason: string };

export type StartRenderJobOutcome =
  | { status: "ok"; job: RenderJob; candidate: RenderCandidate }
  | { status: "failed"; job: RenderJob; reason: string };

export type RetryOutcome =
  | { status: "ok"; nextJob: RenderJob }
  | { status: "exhausted"; reason: string }
  | { status: "not_retryable"; reason: string };

export async function createRenderJob(specInput: unknown, deps: OrchestratorDeps): Promise<CreateRenderJobOutcome> {
  const validation: AdsRenderInputValidationResult = validateCreativeRenderSpecForADS(specInput);
  if (validation.status === "fail") {
    return { status: "spec_invalid", issues: validation.issues };
  }
  try {
    assertProviderAllowedForJob(deps.policy, { forRealProvider: false });
  } catch (e) {
    if (e instanceof RenderProviderPolicyError) {
      return { status: "policy_denied", reason: e.message };
    }
    throw e;
  }
  const spec = validation.spec;
  const job = RenderJobSchema.parse({
    renderJobId: deps.ids.newId("job"),
    renderSpecId: spec.renderSpecId,
    schemeId: spec.schemeId,
    roomId: spec.roomId,
    cameraId: spec.cameraId,
    geometryHash: spec.geometryHash,
    status: "queued",
    providerPolicyId: deps.policy.policyId,
    attempt: 1,
    maxAttempts: deps.policy.maxAttemptsPerJob,
    createdAt: deps.clock.now(),
    updatedAt: deps.clock.now()
  });
  deps.repos.jobs.create(job);
  deps.specStore.set(job.renderJobId, spec);
  return { status: "ok", job };
}

export async function startRenderJob(renderJobId: string, deps: OrchestratorDeps): Promise<StartRenderJobOutcome> {
  const existing = deps.repos.jobs.get(renderJobId);
  if (existing === undefined) {
    throw new RenderJobNotFoundError(renderJobId);
  }
  if (isTerminal(existing.status)) {
    throw new IllegalRenderJobTransitionError(existing.status, "running");
  }
  const spec = deps.specStore.get(renderJobId);
  if (spec === undefined) {
    const error: RenderJobError = {
      code: "spec_invalid",
      message: "Spec for job is not in spec store; create the job through createRenderJob first",
      stage: existing.status,
      occurredAt: deps.clock.now()
    };
    const failed = transitionToFailed(existing, deps, error);
    return { status: "failed", job: failed, reason: error.code };
  }

  // OI-004 passive hash check: ensure the spec we're about to render matches the
  // job's recorded geometryHash. Drift means upstream geometry changed under us.
  if (spec.geometryHash !== existing.geometryHash) {
    const error: RenderJobError = {
      code: "spec_invalid",
      message: "geometryHash drifted between job creation and start",
      stage: existing.status,
      occurredAt: deps.clock.now()
    };
    const failed = transitionToFailed(existing, deps, error);
    return { status: "failed", job: failed, reason: "geometry_hash_drift" };
  }

  // queued → running
  assertTransition(existing.status, "running");
  let current = deps.repos.jobs.update({
    ...existing,
    status: "running",
    startedAt: existing.startedAt ?? deps.clock.now(),
    updatedAt: deps.clock.now()
  });
  // running → provider_pending
  assertTransition(current.status, "provider_pending");
  current = deps.repos.jobs.update({
    ...current,
    status: "provider_pending",
    updatedAt: deps.clock.now()
  });

  let result: ImageGenerationResult;
  try {
    result = await deps.adapter.generate({
      spec,
      policy: deps.policy,
      jobId: current.renderJobId,
      attempt: current.attempt
    });
  } catch (e) {
    const error = adapterErrorToJobError(e, deps.clock.now());
    const failed = transitionToFailed(current, deps, error);
    return { status: "failed", job: failed, reason: error.code };
  }
  // Provider returned (success or schema-invalid result) — record providerCompletedAt
  // before validating, so the timestamp is preserved even when we transition to failed.
  const providerCompletedAt = deps.clock.now();

  const traceParsed = ProviderTraceSchema.safeParse(result.providerTrace);
  if (!traceParsed.success || result.imageUrl.length === 0) {
    const error: RenderJobError = {
      code: "malformed",
      message: traceParsed.success
        ? "Provider returned empty imageUrl"
        : "Provider returned trace that failed schema validation",
      stage: "provider_pending",
      occurredAt: deps.clock.now()
    };
    const failed = transitionToFailed({ ...current, providerCompletedAt }, deps, error);
    return { status: "failed", job: failed, reason: error.code };
  }

  const candidateInput: RenderCandidate = {
    candidateId: deps.ids.newId("cand"),
    renderJobId: current.renderJobId,
    renderSpecId: current.renderSpecId,
    schemeId: current.schemeId,
    roomId: current.roomId,
    cameraId: current.cameraId,
    geometryHash: current.geometryHash,
    status: "created",
    imageUrl: result.imageUrl,
    providerTrace: result.providerTrace,
    createdAt: deps.clock.now(),
    ...(result.thumbnailUrl === undefined ? {} : { thumbnailUrl: result.thumbnailUrl })
  };
  let candidate: RenderCandidate;
  try {
    candidate = RenderCandidateSchema.parse(candidateInput);
  } catch (e) {
    const error: RenderJobError = {
      code: "malformed",
      message: e instanceof Error ? e.message : "Candidate failed schema validation",
      stage: "candidate_generated",
      occurredAt: deps.clock.now()
    };
    const failed = transitionToFailed({ ...current, providerCompletedAt }, deps, error);
    return { status: "failed", job: failed, reason: error.code };
  }

  try {
    deps.repos.candidates.create(candidate);
    deps.repos.providerTraces.create(result.providerTrace, {
      renderJobId: current.renderJobId,
      candidateId: candidate.candidateId
    });
  } catch (e) {
    const error: RenderJobError = {
      code: "storage_failed",
      message: e instanceof Error ? e.message : "Repository write failed",
      stage: "candidate_generated",
      occurredAt: deps.clock.now()
    };
    const failed = transitionToFailed({ ...current, providerCompletedAt }, deps, error);
    return { status: "failed", job: failed, reason: error.code };
  }

  // provider_pending → candidate_generated. Record providerCompletedAt +
  // candidateGeneratedAt. Do NOT set completedAt here — verification_pending
  // is not terminal, and completedAt is reserved for verified/failed/blocked/
  // cancelled per the state machine.
  const candidateGeneratedAt = deps.clock.now();
  assertTransition(current.status, "candidate_generated");
  current = deps.repos.jobs.update({
    ...current,
    status: "candidate_generated",
    providerCompletedAt,
    candidateGeneratedAt,
    updatedAt: deps.clock.now()
  });
  assertTransition(current.status, "verification_pending");
  current = deps.repos.jobs.update({
    ...current,
    status: "verification_pending",
    updatedAt: deps.clock.now()
  });

  return { status: "ok", job: current, candidate };
}

export function createRetryPlan(renderJobId: string, deps: OrchestratorDeps): RetryOutcome {
  const job = deps.repos.jobs.get(renderJobId);
  if (job === undefined) {
    throw new RenderJobNotFoundError(renderJobId);
  }
  if (job.status !== "failed") {
    return {
      status: "not_retryable",
      reason: `Job ${renderJobId} is in status ${job.status}; only failed jobs can be retried`
    };
  }
  if (job.attempt >= job.maxAttempts) {
    return {
      status: "exhausted",
      reason: `Job ${renderJobId} reached maxAttempts (${job.maxAttempts})`
    };
  }
  // exactOptionalPropertyTypes means we must build the object without optional keys when reset.
  const next: RenderJob = {
    renderJobId: job.renderJobId,
    renderSpecId: job.renderSpecId,
    schemeId: job.schemeId,
    roomId: job.roomId,
    cameraId: job.cameraId,
    geometryHash: job.geometryHash,
    status: "queued",
    providerPolicyId: job.providerPolicyId,
    attempt: job.attempt + 1,
    maxAttempts: job.maxAttempts,
    createdAt: job.createdAt,
    updatedAt: deps.clock.now()
  };
  const stored = deps.repos.jobs.update(RenderJobSchema.parse(next));
  return { status: "ok", nextJob: stored };
}

function transitionToFailed(current: RenderJob, deps: OrchestratorDeps, error: RenderJobError): RenderJob {
  if (!canTransitionToFailed(current.status)) {
    throw new IllegalRenderJobTransitionError(current.status, "failed");
  }
  return deps.repos.jobs.update({
    ...current,
    status: "failed",
    completedAt: deps.clock.now(),
    updatedAt: deps.clock.now(),
    error
  });
}

function canTransitionToFailed(from: RenderJob["status"]): boolean {
  return ["queued", "running", "provider_pending", "verification_pending"].includes(from);
}

function adapterErrorToJobError(error: unknown, occurredAt: string): RenderJobError {
  if (error instanceof MockImageAdapterError) {
    if (error.code === "timeout") {
      return { code: "timeout", message: error.message, stage: "provider_pending", occurredAt };
    }
    if (error.code === "storage_failed") {
      return { code: "storage_failed", message: error.message, stage: "provider_pending", occurredAt };
    }
  }
  if (error instanceof RenderCandidateValidationError) {
    return {
      code: "malformed",
      message: error.message,
      stage: "candidate_generated",
      occurredAt
    };
  }
  return {
    code: "unknown",
    message: error instanceof Error ? error.message : String(error),
    stage: "provider_pending",
    occurredAt
  };
}
