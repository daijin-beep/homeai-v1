# Open Interface Decisions

## Status

Output of VAL-ADS-00 Interface Decision Gates.

This document records the current status of the twelve cross-track open
interface issues defined in
`VAL_ADS_00_Interface_Decision_Gates.md`. It locks scope before ADS Batch 01
implementation work proceeds.

This document does not implement production code. It records what is decided,
what is pending, and what is blocked, based on the current state of
`main` and the canonical contracts under `packages/contracts/src`.

Sources cross-checked:

- `AGENTS.md`
- `docs/architecture/SYSTEM_ARCHITECTURE.md`
- `docs/architecture/DATA_CONTRACTS.md`
- `docs/architecture/homeAI_V1_Beta_architecture_workplan.md`
- `docs/render-pipeline/CREATIVE_RENDER_SPEC_FREEZE.md`
- `docs/render-pipeline/CREATIVE_RENDER_SPEC_COMPILER_HARDENING.md`
- `docs/ads-integration/ADS_CONSUMER_CONTRACT.md`
- `docs/ads-integration/ADS_RECOVERY_PR_REVIEW_GATE.md`
- `docs/ads-integration/CREATIVE_RENDER_SPEC_ADS_DISPATCH_PAYLOAD.md`
- `docs/integration/V1_BETA_REMAINING_WORK_PLAN.md`
- `packages/contracts/src/`
- `git log main` through Batch 17a

## Scope Guardrails

Claude Code may consume `CreativeRenderSpec` but must not compile it from
`SceneContract`.

Claude Code may create a render gallery admission record but must not own the
full Scheme Page.

Claude Code may evaluate provider candidates but Kim and GPT final decision is
required for cost, license, and provider choice.

## Decision Matrix

| issueId | title | owner | status | requiredBeforeBatch | currentDecision | blockingRisk |
|---|---|---|---|---|---|---|
| ADS-OI-001 | CreativeRenderSpec v0.1 freeze fields | Codex Track A | decided | ADS-01 | Frozen by Codex Batch 12 and hardened by Batch 13. Active fields: `renderSpecId`, `schemeId`, `homeId`, `floorplanRevisionId`, `sceneContractId`, `roomId`, `cameraId`, `geometryHash`, `layoutIntentHash?`. Input asset refs nested at `inputs.{controlRender, depthMap, semanticMask, lineMap, lockedGeometryMask, anchorLayoutMask}.uri`. | None. ADS must consume as readonly. |
| ADS-OI-002 | Scheme Page vs Room Gallery ownership | shared | decided | ADS-04, ADS-07 | Codex owns Scheme Page shell and deterministic render-status fixtures per `V1_BETA_REMAINING_WORK_PLAN.md`. Claude Track B owns ADS runtime gallery admission, render snapshot API, and human review queue. | None. ADS must not own full Scheme Page. |
| ADS-OI-003 | Provider selection decision rights | Kim and GPT | pending | ADS-06 | Provider winner choice is reserved for Kim and GPT after VAL-ADS-03 and the Batch 05 bakeoff produce evidence. Claude Track B may evaluate candidates but must not pick the winner. | Blocks ADS-06 real provider spike. |
| ADS-OI-004 | geometryHash changed event / invalidation mechanism | Codex Track A | pending | ADS-02, ADS-03 | `CreativeRenderSpec` freeze requires `geometryHash` match across spec, inputs, and ADS render context. A formal event or invalidation channel beyond field-level hash-match is not defined on `main`. Claude Track B must reject on mismatch via `validateCreativeRenderSpecForADS()` per `ADS_CONSUMER_CONTRACT.md`. | Medium. ADS can fail-closed today, but cache invalidation strategy for in-flight renders is undefined. |
| ADS-OI-005 | Bakeoff vs Real Provider phasing | shared | decided | ADS-06 | Decision Log D-030 plus the ADS Batch plan locks the order: ADS-01 to ADS-05 on mock and stub, then VAL-ADS-03, then ADS-06 gated spike. Real provider is blocked until VAL-ADS-03 passes and Kim approves `allowed_for_spike` policy. | None for phasing. The real provider itself remains pending. |
| ADS-OI-006 | RenderProviderPolicy cost / timeout / provider allowlist | shared | blocked | ADS-06 | VAL-ADS-03 has not been executed. Policy schema, `assertProviderAllowedForJob()`, and three fixtures are still to be produced. | Hard block on ADS-06. |
| ADS-OI-007 | Provider licensing / copyright gate | Kim and legal | blocked | ADS-06 | VAL-ADS-03 covers license and commercial-use status validation. Until the policy schema and license fields are signed, real provider remains blocked. | Hard block on ADS-06. |
| ADS-OI-008 | RenderVerifier L1 thresholds | Claude Track B | blocked | ADS-03 | VAL-ADS-02 feasibility matrix has not been executed. Threshold schema and metadata checks are not yet defined. `RenderVerificationReport`, `DeterministicRenderCheck`, and `RenderTrace.sourceModule = render_verifier_l1` exist on `main`, but specific L1 thresholds are not pinned. | Hard block on ADS-03. |
| ADS-OI-009 | Human review queue rules | Claude Track B | blocked | ADS-04 | VAL-ADS-04 has not been executed. `HumanReviewRecommendation` exists in `@homeai/contracts` but admission truth table and event list are pending. | Hard block on ADS-04 and ADS-07. |
| ADS-OI-010 | RenderGalleryItem contract | Codex Track A | decided | ADS-07 | No `RenderGalleryItem` is planned. Canonical surface is `RenderGalleryEligibility` plus `SchemeRenderGallery*` already on `main`. ADS must not introduce a parallel `RenderGalleryItem` type. | None. Future ADS work consumes `RenderGalleryEligibility`. |
| ADS-OI-011 | ProviderTrace required fields | Codex Track A | decided | ADS-02, ADS-03, ADS-06 | Canonical trace types are `CreativeRenderSpecProviderTrace` and `DesignKernelProviderTrace` in `@homeai/contracts`. Batch 14C extends `RenderTrace.sourceModule` with `render_verifier_l1`. ADS must not introduce package-local source module strings or rename existing trace types. | None. ADS recovery PR #10 may still emit `render_verifier_mock` as temporary debt per the recovery gate. |
| ADS-OI-012 | Gallery admission status semantics | shared | blocked | ADS-04, ADS-07 | VAL-ADS-04 owns the admission truth table. `AGENTS.md` rule 8 mandates fail-render gallery block. Verifier statuses (`verified`, `warning`, `rejected`, `manual_review_needed`) exist on `main` via `RenderVerificationReport`, but the full mapping from verifier status to gallery admission, including warning routing, is pending. | Hard block on ADS-04 and ADS-07. |

## Gates Still Blocking Development

- VAL-ADS-02 RenderVerifier L1 Feasibility has not been executed. Blocks ADS-03.
- VAL-ADS-03 RenderProviderPolicy / License / Cost has not been executed.
  Blocks ADS-06.
- VAL-ADS-04 Gallery Admission and Human Review Policy has not been executed.
  Blocks ADS-04 and ADS-07.
- ADS Recovery PR #10
  `ads/rebased-batch03-06-verifier-debug-bakeoff-gated-provider`
  is still open and unmerged per
  `docs/integration/V1_BETA_REMAINING_WORK_PLAN.md`.
- Kim and GPT have not signed the provider selection decision rights for
  ADS-OI-003.
- A formal `geometryHash` invalidation event for in-flight renders is not
  defined for ADS-OI-004 beyond field-level rejection.
- Provider license, commercial-use status, and cost ceiling are not signed for
  ADS-OI-006 and ADS-OI-007.

## What Is Explicitly Allowed Now

- Mock provider adapter work for ADS-01, ADS-02, and ADS-05 mock and stub
  paths.
- Reading `CreativeRenderSpec` as a readonly object via
  `validateCreativeRenderSpecForADS()` and rejecting on the conditions in
  `ADS_CONSUMER_CONTRACT.md`.
- ADS runtime work inside Claude Track B owned packages and routes per
  `V1_BETA_REMAINING_WORK_PLAN.md`.
- Producer-side Codex batches in allowed Codex future areas.

## What Is Explicitly Blocked Now

- Real provider adapter calls.
- Real network or external API calls in ADS runtime code.
- Mutating `CreativeRenderSpec`, `SceneContract`, or any canonical geometry.
- Admitting failed renders to gallery.
- Introducing a `RenderGalleryItem` schema parallel to
  `RenderGalleryEligibility`.
- Renaming or duplicating `CreativeRenderSpecProviderTrace`,
  `DesignKernelProviderTrace`, or `RenderTrace.sourceModule` values.

## Next Steps

1. Track B executes VAL-ADS-02 to produce
   `docs/ads/render-verifier-l1-feasibility.md`.
2. Track B executes VAL-ADS-04 to produce the admission truth table and event
   list.
3. Track B executes VAL-ADS-03 to produce the provider policy schema,
   `assertProviderAllowedForJob()`, and fixtures.
4. Kim and GPT sign ADS-OI-003 and ADS-OI-007 before ADS-06.
5. ADS Recovery PR #10 lands per the recovery review gate.
6. After the four items above, ADS Batch 01 may begin.

## Path Deviation Note

VAL-ADS-00 specifies the gate fixture path as
`packages/ads-render/fixtures/ads-interface-gates.json`.

`packages/ads-render` does not exist on `main` yet. ADS Batch 01 is the batch
that creates the four-package skeleton. To avoid creating a partial package
skeleton outside ADS Batch 01 scope, the gate fixture is placed at
`docs/ads/ads-interface-gates.json` for VAL-ADS-00. ADS Batch 01 should move
the fixture to the canonical path when it creates `packages/ads-render`.

## Encoding Guard

This document must remain readable in GitHub raw view with ordinary physical
line breaks.

- Store the file as UTF-8 text without a byte order mark.
- Use ordinary LF newline bytes only.
- Do not include carriage return bytes.
- Do not serialize this document as escaped newline text.
- Do not collapse this document into one physical line.
- Do not include zero-width, bidi, line-separator, paragraph-separator, or
  other format control characters.
- Keep headings, bullets, and code fences on separate physical lines.

## Exact Raw Review Guard

Reviewers must be able to fetch this exact file from a commit raw URL and see
multiline Markdown.

- The first line must be `# Open Interface Decisions`.
- The second physical line must be blank.
- The third physical line must be `## Status`.
- The raw file must have more than fifty physical LF bytes.
- The raw file must end with an LF byte.
- The raw file must not contain non-ASCII bytes.
