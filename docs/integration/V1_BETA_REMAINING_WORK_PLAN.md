# V1 Beta Remaining Work Plan

## Status Baseline

This document records the Batch 15 ownership reconciliation baseline for
homeAI V1 Beta.

- Base stack branch: `codex/batch14-render-trace-docs`
- This branch is stacked on `codex/batch14-render-trace-docs`.
- Do not open this branch against `main` until Batch 14C is merged.
- If this branch is opened before Batch 14C is merged, its PR base must be
  `codex/batch14-render-trace-docs`.
- Batch 14C commit: `90b894484aa272f2a88198ad871179666fb7a256`
- Batch 14C scope: canonical `RenderTrace.sourceModule` includes
  `render_verifier_l1`; ADS freeze docs mark `CreativeRenderSpec` as active,
  not deferred.
- Claude Track B ADS recovery candidate: PR #10,
  `ads/rebased-batch03-06-verifier-debug-bakeoff-gated-provider`.
- PR #10 status at Batch 15 planning time: open and unmerged.
- Old ADS PR #2: closed as superseded.

## Ownership Split

Codex Track A owns producer-side and user-facing V1 Beta surfaces:

- Space Truth contracts and confirmed geometry traceability.
- SceneContract producer handoff.
- Design Kernel and SchemeLiteContract.
- CreativeRenderSpec producer/compiler and ADS input validation boundary.
- Scheme Page shell and deterministic render-status fixtures.
- SKU import, VerifiedSku admission, and Soft Decor GPS Lite matching.
- Lead/event tracking and debug surfaces.
- Beta readiness harness and release-gate tests.

Claude Track B owns ADS runtime surfaces:

- ADS runtime package and runtime orchestration.
- Render verifier runtime implementation.
- Render debug page and render snapshot API.
- Render human review API and human review queue.
- Provider registry, bakeoff harness, DisabledRealProviderAdapter, and real
  provider gate.

## Allowed Codex Future Areas

Future Codex batches may change these areas when the batch scope requires it:

- `docs/**`
- `tests/**`
- `packages/contracts/**`
- `packages/creative-render-spec/**`
- `packages/scheme-page/**`
- `packages/render-pipeline/**` producer/mock view-model paths only
- `packages/soft-decor-gps/**`
- `packages/analytics/**`
- user-facing Scheme Page or Beta flow pages outside Track B runtime routes
- dev-only SKU, lead-event, or beta-readiness debug pages
- deterministic local fixtures

Any package-level addition must remain contract-first, deterministic, and
local-fixture based unless a later reviewed task explicitly changes that
boundary.

## Forbidden Claude Track B Areas

Codex remaining-work branches must not modify:

- `packages/ads-runtime/**`
- `packages/render-verifier/**`
- `apps/web/app/dev/render-debug/**`
- `apps/web/app/api/render-snapshot/**`
- `apps/web/app/api/render-human-review/**`
- provider registry code
- bakeoff harness code
- human review queue code
- DisabledRealProviderAdapter or real provider gate code

Codex must not create replacement versions of these systems in another
package or route.

## Stop Gates

Stop and report instead of broadening scope if any condition appears:

- PR #10 is still unmerged and the requested work requires Track B runtime APIs.
- A change requires modifying ADS runtime or render verifier packages.
- A change touches P1, geometry, scene, or canonical Space Truth write paths
  without being an explicit Space Truth task.
- A render, SKU, Design Kernel, or user-flow path would mutate confirmed
  geometry or change `geometryHash`.
- Real provider calls, provider SDKs, secrets, external scraping, or live
  merchant APIs are required.
- SKU import cannot proceed from local curated fixtures.
- The work requires PDF export, construction workflow, contractor
  collaboration, or construction-ready material lists.
- Full gates cannot pass after one minimal scoped fix.

## Required Batch Gates

Each remaining Codex batch must run:

- `corepack pnpm typecheck`
- `corepack pnpm test`
- `corepack pnpm exec vitest run tests/scope`
- `git diff --check`

Each batch report must also include:

- Space Truth red-zone diff result.
- ADS runtime forbidden-path diff result.
- Network/provider/secrets scan result.
- Hidden Unicode scan result.

## PR #10 Boundary

Before PR #10 lands, Codex may only use deterministic fixtures and canonical
contracts to model ADS-facing status. Codex must not call
`/api/render-snapshot`, `/api/render-human-review`, or any Track B runtime route
as a live source of truth.

After PR #10 lands, a separate reviewed batch may consume the existing Track B
runtime API output at the app boundary without rewriting Track B internals.
