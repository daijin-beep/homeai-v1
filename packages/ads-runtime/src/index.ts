// @homeai/ads-runtime — Track B-owned ADS runtime surface.
//
// Per D-036, this package contains:
//   - Image adapter interface + mock/stub adapters
//   - Package-local provider policy (RenderProviderPolicy is runtime
//     configuration, NOT a cross-module canonical contract)
//   - Repositories + factories typed against canonical RenderJob /
//     RenderCandidate / RenderVerificationReport
//   - Human review queue
//   - Bakeoff harness
//   - Gated real provider scaffold
//
// This package never redefines RenderJob, RenderCandidate,
// RenderVerificationReport, RenderTrace, GalleryEligibilityDecision,
// or CreativeRenderSpec. All those come from @homeai/contracts.
//
// Batch 04 surface — Human Review Queue + runtime snapshot.
export {
  HumanReviewDecisionRecordSchema,
  HumanReviewDecisionVerbSchema,
  HumanReviewItemSchema,
  HumanReviewItemStatusSchema,
  type HumanReviewDecisionRecord,
  type HumanReviewDecisionVerb,
  type HumanReviewItem,
  type HumanReviewItemStatus
} from "./human-review/contract.js";

export {
  InMemoryHumanReviewRepository,
  createInMemoryHumanReviewRepository,
  type HumanReviewQueueFilter,
  type HumanReviewRepository
} from "./human-review/repository.js";

export {
  enqueueIfReviewRequired,
  submitHumanReviewDecision,
  type EnqueueIfNeededInput,
  type SubmitDecisionInput
} from "./human-review/service.js";

export {
  buildRuntimeSnapshot,
  type RuntimeSnapshot
} from "./services/runtime-snapshot.js";
