export {
  RenderJobErrorCodeSchema,
  RenderJobErrorSchema,
  RenderJobSchema,
  RenderJobStatusSchema,
  type RenderJob,
  type RenderJobError,
  type RenderJobErrorCode,
  type RenderJobStatus
} from "./contracts/render-job.js";

export {
  RenderCandidateSchema,
  RenderCandidateStatusSchema,
  type RenderCandidate,
  type RenderCandidateStatus
} from "./contracts/render-candidate.js";

export {
  IllegalRenderJobTransitionError,
  RenderCandidateValidationError,
  RenderJobNotFoundError,
  RenderJobValidationError
} from "./errors/job-errors.js";

export type {
  AdsRepositorySet,
  ProviderTraceListFilter,
  ProviderTraceRepository,
  RenderCandidateListFilter,
  RenderCandidateRepository,
  RenderJobListFilter,
  RenderJobRepository,
  RenderVerificationRepository
} from "./repositories/interfaces.js";

export {
  InMemoryProviderTraceRepository,
  InMemoryRenderCandidateRepository,
  InMemoryRenderJobRepository,
  InMemoryRenderVerificationRepository
} from "./repositories/in-memory.js";

export { createInMemoryAdsRepositories } from "./repositories/factory.js";

export {
  ALLOWED_TRANSITIONS,
  assertTransition,
  canTransition,
  isTerminal
} from "./state/state-machine.js";

export {
  createInMemorySpecStore,
  createRenderJob,
  createRetryPlan,
  startRenderJob,
  type CreateRenderJobOutcome,
  type OrchestratorClock,
  type OrchestratorDeps,
  type OrchestratorIdGenerator,
  type RetryOutcome,
  type SpecStore,
  type StartRenderJobOutcome
} from "./services/orchestrator.js";
