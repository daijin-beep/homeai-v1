# ADS Canonical Import Strategy (D-036)

## Rule

Cross-module shared ADS render schemas live in `packages/contracts/src/`
and are imported by every consumer through `@homeai/contracts`.

Track B packages (`@homeai/render-verifier`, `@homeai/ads-runtime`) and the
web app (`@homeai/web` under `apps/web/`) **import** these canonical types.
They do not redefine them.

## Allowed canonical re-exports

```ts
import {
  CreativeRenderSpecSchema,
  CreativeRenderSpec,
  RenderJobSchema,
  RenderJob,
  RenderJobStatusSchema,
  RenderRoomJobSchema,
  RenderTraceSchema,
  RenderTrace,
  RenderCandidateSchema,
  RenderCandidate,
  RenderCandidateStatusSchema,
  RenderVerificationReportSchema,
  RenderVerificationReport,
  RenderVerificationStatusSchema,
  DeterministicRenderCheckSchema,
  DeterministicRenderCheck,
  DeterministicRenderCheckTypeSchema,
  VlmRenderChecklistResultSchema,
  RetryRecommendationSchema,
  HumanReviewRecommendationSchema,
  GalleryEligibilityDecisionSchema,
  GalleryEligibilityDecision,
  GalleryEligibilityStatusSchema
} from "@homeai/contracts";
```

## Allowed package-local schemas (private implementation details)

These are NOT cross-module contracts. They never appear in another
package's public API or in an HTTP API request/response body of a
non-Track-B route.

| Schema | Package | Reason |
|---|---|---|
| `RenderProviderPolicySchema` | `@homeai/ads-runtime` | Runtime configuration for which mock/stub adapters are allowed, max attempts, timeout. Not consumed by Track A. |
| `MockImageAdapterMode` | `@homeai/ads-runtime` | Internal mode selector for the mock adapter. |
| `HumanReviewItemSchema` / `HumanReviewDecisionSchema` (Track B variant) | `@homeai/ads-runtime` | Operator workflow records; not the canonical `HumanReviewRecommendationSchema` (which is the verifier's recommendation field). |
| `BakeoffScorecardSchema`, `BakeoffRunSchema` | `@homeai/ads-runtime` | Benchmark report shapes for the bakeoff harness; internal to Track B testing. |
| Verifier check options / threshold configs | `@homeai/render-verifier` | Tunable internal thresholds; not exposed to other packages. |

## Forbidden patterns

The scope scan `tests/scope/ads-no-duplicate-canonical-contracts.test.ts`
enforces these:

- No file under `packages/render-verifier/` or `packages/ads-runtime/`
  may declare a top-level `export const <CanonicalSchema>Schema = z.object(...)`
  where `<CanonicalSchema>` is in the canonical name list.
- No file may declare a top-level `export type <CanonicalType> = ...` for
  a name in the canonical type list.
- `RenderJob`, `RenderCandidate`, `RenderVerificationReport`,
  `RenderTrace`, `DeterministicRenderCheck`, `GalleryEligibilityDecision`,
  `CreativeRenderSpec` are all canonical.

## When canonical schemas need a field ADS does not have

Per task card §6.3, edits to `packages/contracts/src/render-*.ts` are
allowed if and only if:

- The field is ADS render-specific (not Space Truth, not Design Kernel,
  not Layout Intent, not Anchor).
- The change is additive (new optional field).
- Tests cover the new field.

If a fundamental shape change is needed (renaming, breaking change),
open an Interface Issue and route through GPT Pro + Kim before editing.

## Track A trust boundary

Track A owns the producer side of `CreativeRenderSpec` (the compiler
in `@homeai/creative-render-spec`). Track B consumes it. Track A's
canonical schemas in `packages/contracts/src/render-*.ts` are the
**joint** contract surface for ADS; Track B may edit ADS render
contracts under that path **only** within the ADS-render scope listed
in task card §6.3.

Track B may never touch:

```
packages/contracts/src/p1-*
packages/contracts/src/scene*
packages/contracts/src/design-kernel*
packages/contracts/src/layout-intent*
packages/contracts/src/anchor*
packages/contracts/src/floorplan*
```
