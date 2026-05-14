# ADS Recovery Audit — Batch 03-06 Rebased on Canonical `main`

## 0. Snapshot

- **Date:** 2026-05-14
- **`origin/main` head:** `ac87319e345d9032fff06911562c8d6ff1392127`
- **Recovery branch:** `ads/rebased-batch03-06-verifier-debug-bakeoff-gated-provider`
- **Decision applied:** D-036 — `packages/contracts` is canonical for shared ADS schemas; Track B owns runtime, not contracts.

## 1. Root cause of recovery work

The previous stacked PR workflow merged in the wrong direction:

| Old PR | Title | Closed as merged into | Real outcome |
|---|---|---|---|
| PR #5 | ADS Batch 02 RenderJob orchestrator | `ads/batch-01-render-contract-foundation` | ADS code cascaded onto its parent branch only |
| PR #4 | ADS Batch 01 Render contract foundation | `ads/val-01-creative-render-spec-consumer` | same |
| PR #3 | VAL-ADS-01 CreativeRenderSpec consumer validator | `ads/val-00-interface-gates` | same |
| PR #2 | VAL-ADS-00 Interface decision gates | `main` (still open) | conflicts with `main`'s Codex Batch 07-10 work |

While the old stack sat unmerged, Track A (Codex) shipped Batches 07-10 on `main` and introduced canonical contracts that the old Track B work duplicated:

- `packages/contracts/src/creative-render-spec.ts` (Codex Batch 09)
- `packages/contracts/src/render-job.ts` (Codex Batch 10)
- `packages/contracts/src/render-candidate.ts` (Codex Batch 10)
- `packages/contracts/src/render-verification-report.ts` (Codex Batch 10)
- `packages/contracts/src/render-gallery-eligibility.ts` (Codex Batch 10)
- `packages/render-pipeline/` builders (Codex Batch 10) — `buildRenderJobFromCreativeRenderSpecs`, `buildMockRenderCandidates`, `buildMockRenderVerificationReports`, `evaluateGalleryEligibility`

D-036 declares `packages/contracts` canonical. The old branches' competing schemas in `packages/render-jobs/src/contracts/`, `packages/render-verifier/src/contracts/`, `packages/ads-render/src/contracts/` would violate D-036 if merged.

## 2. PR / branch disposition

| Item | Status | Action |
|---|---|---|
| PR #2 (val-00 → main) | open, `dirty` (Codex/ADS file conflicts in `apps/web/package.json`, `vitest.config.ts`, `pnpm-lock.yaml`) | **Do not merge.** Close as superseded by this recovery branch after the recovery branch passes review. |
| PR #3, #4, #5 | closed/`merged` (cascaded onto stack — never reached `main`) | Leave closed; no `main` impact. |
| Old branches (`ads/val-00`, `ads/val-01`, `ads/batch-01`, `ads/batch-02`) | local + remote, last commits `1723ca1` / `5bd1239` / `2bb3251` / `08fc820` cascaded to `792236e` / `fbd43fb` / `7807dca` on remote | **Keep for audit / cherry-pick reference.** Do not force-push, do not delete until recovery branch lands. |

## 3. Canonical contract inventory (on `main`)

✓ Present in `packages/contracts/src/`:

| File | Bytes | Exports relevant to ADS |
|---|---|---|
| `creative-render-spec.ts` | 11483 | `CreativeRenderSpecSchema`, `CreativeRenderSpec`, `CreativeRenderSpecBatchSchema`, `CreativeRenderStyleDirective` (required), `CreativeRenderBudgetDirective` (required), `CreativeRenderSpecInputs`, `CreativeRenderHardConstraints`, `CreativeRenderSpecTrace`, etc. |
| `render-job.ts` | 5478 | `RenderJobSchema`, `RenderJobStatusSchema` (`queued/running/completed/partial_failed/failed/cancelled`), `RenderRoomJobSchema`, `RenderJobCoverageSummarySchema`, `RenderTraceSchema`, `RenderJobIssueSchema`, `RenderLifecycleStatusSchema` |
| `render-candidate.ts` | 2005 | `RenderCandidateSchema`, `RenderCandidateStatusSchema` (`generated/verification_pending/verified_pass/verified_warning/verified_fail/human_review_required/rejected`) |
| `render-verification-report.ts` | 4026 | `RenderVerificationReportSchema`, `DeterministicRenderCheckSchema`, `DeterministicRenderCheckTypeSchema` (10 enum types), `VlmRenderChecklistResultSchema`, `RetryRecommendationSchema`, `HumanReviewRecommendationSchema` |
| `render-gallery-eligibility.ts` | 720 | `GalleryEligibilityDecisionSchema`, `GalleryEligibilityStatusSchema` (`eligible/blocked_pending_verification/blocked_failed_verification/blocked_geometry_mismatch/blocked_missing_asset/human_review_required`) |

✓ Present in `packages/render-pipeline/` (Codex's builders — usable by Track B):

| File | Purpose |
|---|---|
| `src/render-job-builder.ts` | `buildRenderJobFromCreativeRenderSpecs(input)` — assembles `RenderJob` from `SchemeLite` + `SceneContract` + `CreativeRenderSpec[]` + optional candidates / reports / eligibility |
| `src/render-candidate-builder.ts` | `buildMockRenderCandidates({renderJob, creativeRenderSpecs, mode, createdAt})` — produces deterministic mock `RenderCandidate[]` with 3 modes |
| `src/render-verification-mock.ts` | `buildMockRenderVerificationReports({...scenario})` — produces pre-canned `RenderVerificationReport[]` for 6 fixture scenarios (NOT a real verifier — it scripts pass/fail per scenario index) |
| `src/render-gallery-eligibility.ts` | `evaluateGalleryEligibility({candidate, verificationReport})` — real evaluator producing `GalleryEligibilityDecision` |

## 4. Salvage decisions (old branch → new branch)

Reviewing the four old ADS branches commit-by-commit. **Nothing is brought across as a file copy.** Code is re-implemented against canonical contracts.

### 4.1 Drop (duplicates canonical or obsolete)

| Old file | Reason |
|---|---|
| `packages/ads-render/src/contracts/creative-render-spec-consumer.ts` | Canonical `CreativeRenderSpecSchema` exists; consumer just imports it. |
| `packages/ads-render/src/contracts/gallery-admission.ts` | Canonical `GalleryEligibilityDecisionSchema` + `GalleryEligibilityStatusSchema` exist. |
| `packages/ads-render/src/contracts/ads-interface-gates.ts` | Audit fixture only; can be re-introduced under `docs/` if needed but not as a competing schema package surface. |
| `packages/ads-render/src/validation/validate-creative-render-spec-for-ads.ts` | `CreativeRenderSpecSchema.safeParse` is the validator. |
| `packages/render-verifier/src/contracts/render-verification-report.ts` | Canonical exists. |
| `packages/render-verifier/src/contracts/deterministic-check.ts` | Canonical `DeterministicRenderCheckSchema` + `DeterministicRenderCheckTypeSchema` exist. |
| `packages/render-jobs/src/contracts/render-job.ts` | Canonical exists. **Old shape (per-candidate single-room) does not match canonical `RenderJob.roomJobs[]` batch shape.** |
| `packages/render-jobs/src/contracts/render-candidate.ts` | Canonical exists. |
| `packages/render-jobs/src/state/state-machine.ts` | Canonical `RenderJobStatusSchema` enum is different (no `provider_pending/candidate_generated/verification_pending/needs_human_review/blocked`); lifecycle is now batch-level, not per-candidate. Old state machine is wrong abstraction. |
| `packages/render-jobs/src/services/orchestrator.ts` | Wrong abstraction (per-candidate orchestrator); `packages/render-pipeline` already has builders. Replace with a thin runtime orchestrator that wires builders + Track B verifier + Track B adapter. |
| `packages/image-adapter/src/contracts/provider-trace.ts` | Canonical `RenderTraceSchema` replaces it (different shape: `sourceModule` enum + `providerCalls[]` array). |
| `apps/web/app/api/render-jobs/[renderJobId]/route.ts` (and `/start`, `/retry`) | Old per-job HTTP API tied to old contract shape. Replace with new runtime API surface. |

### 4.2 Salvage as concept (re-implemented, not copied)

| Old concept | New location | Notes |
|---|---|---|
| MockImageAdapter idea | `packages/ads-runtime/src/adapters/mock-image-adapter.ts` | Produce canonical `RenderCandidate` (single one). No package-local trace schema. |
| `MockImageAdapterMode = "normal" \| "timeout" \| "malformed" \| "storage_fail"` | same path | Useful for ADS Batch 05 bakeoff scoring. |
| `RenderProviderPolicy` (package-local config) | `packages/ads-runtime/src/policy/render-provider-policy.ts` | **Package-local only** — runtime config, not cross-module contract. Allowed per D-036 §6.2. |
| `assertProviderAllowedForJob` policy gate | `packages/ads-runtime/src/policy/assert-provider-allowed.ts` | Same idea, references package-local policy schema. |
| `createInMemoryAdsRepositories` factory + InMemory repos | `packages/ads-runtime/src/repositories/in-memory.ts` | Repository types are typed against canonical `RenderJob` / `RenderCandidate` / `RenderVerificationReport` / `GalleryEligibilityDecision`. |
| `/dev/render-debug` page | `apps/web/app/dev/render-debug/page.tsx` | Path differs from Codex's `/dev/render-job-debug` (which is for the contract-only compiler preview). Track B page wires the runtime flow. |
| Human Review Queue contracts | `packages/ads-runtime/src/human-review/*` | Adds `HumanReviewItem` + `HumanReviewDecision` package-local types; bridges canonical `RenderCandidateStatusSchema.human_review_required` with operator action. |
| Bakeoff harness | `packages/ads-runtime/src/bakeoff/*` | New: provider registry + scorecard. Mock/stub only. |
| Real provider scaffold (gated) | `packages/ads-runtime/src/adapters/real-provider-disabled.ts` | Disabled-by-default scaffold; throws if invoked without explicit gate-passed flag. |

### 4.3 Drop entirely (do not re-implement)

- Old `packages/ads-render/` package — its purpose (consumer validation + interface gates) is replaced by direct canonical schema usage; ADS-OI snapshot can live in this audit doc + `docs/ads/`.
- Old `packages/render-jobs/` package name — replaced by `@homeai/ads-runtime`.
- Old `packages/image-adapter/` package name — folded into `@homeai/ads-runtime`.
- Old per-fixture `CreativeRenderSpec` consumer fixtures — Codex's `packages/render-pipeline/src/fixtures.ts` + `packages/creative-render-spec/src/fixtures.ts` already provide canonical fixture data.

## 5. Final import strategy

```ts
// All ADS code (verifier, runtime, dev page, bakeoff) imports cross-module shapes
// from @homeai/contracts. No competing canonical schemas in Track B packages.

import {
  CreativeRenderSpecSchema,
  type CreativeRenderSpec,
  RenderJobSchema,
  type RenderJob,
  RenderCandidateSchema,
  type RenderCandidate,
  RenderVerificationReportSchema,
  type RenderVerificationReport,
  DeterministicRenderCheckSchema,
  type DeterministicRenderCheck,
  type DeterministicRenderCheckType,
  GalleryEligibilityDecisionSchema,
  type GalleryEligibilityDecision,
  RenderTraceSchema,
  type RenderTrace
} from "@homeai/contracts";

// Codex builders are used directly. Track B does not re-implement these.
import {
  buildRenderJobFromCreativeRenderSpecs,
  buildMockRenderCandidates,  // for fixture scenarios; not the real ADS adapter
  evaluateGalleryEligibility   // canonical gate
} from "@homeai/render-pipeline";

// Track B value-add:
import { MockImageAdapter, type ImageGenerationProvider } from "@homeai/ads-runtime";
import { verifyRenderCandidate } from "@homeai/render-verifier";
```

## 6. Package layout (new)

```
packages/render-verifier/        # Real deterministic L1 verifier (Track B-owned service)
  package.json
  tsconfig.json
  src/
    index.ts
    services/verify-render-candidate.ts
    checks/{geometry-hash, room-camera, output-asset, anchor-zones, ...}.ts
    errors/index.ts

packages/ads-runtime/            # ADS runtime — adapters, repos, bakeoff, human review
  package.json
  tsconfig.json
  src/
    index.ts
    adapters/{image-generation-provider, mock-image-adapter, real-provider-disabled, stub-providers}.ts
    policy/{render-provider-policy, assert-provider-allowed, real-provider-spike-gate}.ts
    repositories/{interfaces, in-memory, factory}.ts
    services/{orchestrator, human-review-service}.ts
    human-review/{contract, repository}.ts
    bakeoff/{runner, scorecard, fixtures}.ts
    errors/index.ts
```

## 7. Hard-stop check (task card §2)

| Hard-stop condition | Status |
|---|---|
| Cannot create clean branch from `origin/main` | ✓ created at `ac87319` |
| `main` has conflicting/unclear render contract semantics requiring deletion of major Codex code | ✓ semantics clear; Codex builders are reusable |
| Required `packages/contracts` field missing | ✓ canonical schemas satisfy ADS runtime needs |
| Typecheck cannot run | ✓ `corepack pnpm typecheck` passes on `main` |
| Full vitest cannot run | ✓ 268 tests pass on `main` baseline |
| Scope scan cannot prove no Space Truth mutation | ✓ to be added in commit 7 |
| Real provider requires unapproved credentials/cost/license | n/a — Batch 06 produces disabled scaffold + blocked report (Kim's Cost & Compliance Settings + ADS-OI-006/007 remain pending) |

**No hard stop triggered. Proceeding with commits 2-7.**

## 8. Final response (filled at end of recovery branch)

See task card §14 for required output template; will be filled in the response message when all 7 commits are pushed.
