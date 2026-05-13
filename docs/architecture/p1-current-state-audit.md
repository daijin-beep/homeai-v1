# P1 Current State Audit

Date: 2026-05-13

Scope: repository audit before P1 Space Truth correction-stage implementation. This document records the current state only. It does not change production code, schemas, UI, routes, parser logic, or render logic.

## 1. Current module map

| Area | Current files | Current state | P1 relevance |
|---|---|---|---|
| Repository rules | `AGENTS.md`, `task.md`, `.agents/skills/*/SKILL.md` | Contains Space Truth-first rules, P1 rules, and review skills. | Must remain the guardrail for P1 scope and reject conditions. |
| Web app shell | `apps/web/app/layout.tsx`, `apps/web/app/page.tsx` | Minimal Next.js root layout and placeholder home page. | No P1 UI exists yet. |
| Shared contracts | `packages/contracts/src/*.ts` | Main implemented surface. Zod schemas cover floorplans, scene contract, camera plan, render, soft decor GPS, errors, thresholds, projects, files, parse jobs, design brief, and leads. | P1 should extend from here rather than duplicating contracts elsewhere. |
| Floorplan parser package | `packages/floorplan-parser/src/index.ts` | Placeholder export only. | No parser or draft normalization logic exists. |
| Geometry package | `packages/geometry/src/index.ts` | Placeholder export only. | No geometryHash, segment, topology, or canonicalization utilities exist. |
| Scene package | `packages/scene/src/index.ts` | Placeholder export only. | No SceneContract builder or white model/control scene builder exists. |
| Render pipeline package | `packages/render-pipeline/src/index.ts` | Placeholder export only. | No render spec compiler, provider orchestration, or verifier implementation exists. |
| Soft decor GPS package | `packages/soft-decor-gps/src/index.ts` | Placeholder export only. | Anchor-related schemas exist in contracts, but no affordance or anchor planner implementation exists. |
| Providers package | `packages/providers/src/index.ts` | Placeholder export only. | No mock provider implementation exists. |
| Tests | `tests/contracts/contracts.test.ts`, `tests/fixtures/floorplans/**` | Contract and fixture validation tests only. | Provides baseline coverage for M0 schemas, but not P1 behavior. |
| Architecture docs | `docs/architecture/*.md`, `docs/contracts/*.md`, `docs/tasks/TASK-M0-001-foundation-contracts.md` | Documents desired architecture and M0 contract baseline. | Useful design context, but docs include future modules that are not implemented yet. |

## 2. Existing files related to floorplan / scene / camera / affordance / anchor

### Floorplan and Space Truth

- `packages/contracts/src/floorplan.ts`
  - Defines `DraftFloorplanSchema`, `CanonicalFloorplanSchema`, room, wall, opening, scale, and verifier schemas.
  - Existing draft floorplans can use provider-estimated scale.
  - Existing canonical floorplans require `unit: "mm"`, `scale.source: "user_confirmed"`, and `confirmedByUser: true`.
  - `CanonicalFloorplanRevision` does not exist yet.
  - `geometryHash` is not currently part of `CanonicalFloorplanSchema`.
  - Opening geometry currently supports `door`, `window`, and `opening`; there is no bay-window projection metadata yet.
- `packages/contracts/src/parse-job.ts`
  - Defines parse provider and parse job state.
  - `draftFloorplanId` is optional, which matches AI/parser output being a draft.
- `packages/contracts/src/space-truth-thresholds.ts`
  - Defines minimum scores for scene, camera plan, render, and soft decor GPS.
- `packages/contracts/src/room-classification.ts`
  - Defines room type groups and room area thresholds.
  - Includes `balcony` as a known, renderable, and soft-decor target type.
  - Includes helper logic for closed polygon, self-intersection, area threshold, and unknown-room gating.
- `packages/contracts/src/errors.ts`
  - Defines Space Truth-related errors including `SCALE_UNKNOWN`, `LOW_CONFIDENCE_ROOM_BOUNDARY`, `TOPOLOGY_INVALID`, `OPENING_UNCONFIRMED`, and `SPACE_TRUTH_SCORE_TOO_LOW`.
- `tests/fixtures/floorplans/**`
  - Contains draft, canonical, raw provider, notes, and malformed provider fixtures.
  - Fixtures include `one-bedroom`, `two-bedroom`, `three-bedroom-balcony`, `low-confidence-boundaries`, and `malformed-provider-output`.

### SceneContract v0.2 / white model baseline

- `packages/contracts/src/scene-contract.ts`
  - Defines `SceneContractSchema`, `SceneRoomSchema`, `SceneWallSchema`, `SceneOpeningSchema`, immutable geometry constraints, and scene validation.
  - Uses `floorplanId` but not `canonicalRevisionId` or `geometryHash`.
  - `version` is a positive number, not a literal `0.2` contract discriminator.
  - Readonly behavior is represented as data constraints, not enforced by a builder/runtime module.
- `packages/scene/src/index.ts`
  - Placeholder only; no SceneContract builder, readonly wrapper, white model, control scene, or geometry-mutation checks exist.
- `docs/architecture/SYSTEM_ARCHITECTURE.md`
  - States that the Full-Space Scene Engine consumes Canonical Floorplan JSON and must not mutate canonical geometry.
- `docs/architecture/homeAI_V1_Beta_architecture_workplan.md`
  - Lists SceneContract, white model/control scene, affordance graph, anchor planner, and camera plan as intended downstream modules.

### Camera

- `packages/contracts/src/camera-plan.ts`
  - Defines `RoomCameraSchema` and `RoomCameraPlanSchema`.
  - Camera plans bind to `sceneContractId` and `roomId`.
  - No `canonicalRevisionId` or `geometryHash` fields exist yet.
- `tests/contracts/contracts.test.ts`
  - Contains a positive schema validation test for `RoomCameraPlanSchema`.
- No camera planner implementation exists.

### Affordance / anchor

- `packages/contracts/src/soft-decor-gps.ts`
  - Defines `PlacementAnchorSchema` with anchor types: `wall`, `window`, `room_center`, `corner`, `opening_adjacent`.
  - Defines `SoftDecorRecommendationSchema`, `RoomSoftDecorGuideSchema`, and `SoftDecorGPSPlanSchema`.
  - Soft decor plans bind to `sceneContractId`, but not to `canonicalRevisionId` or `geometryHash`.
- `packages/soft-decor-gps/src/index.ts`
  - Placeholder only; no RoomAffordanceGraph or AnchorPlan implementation exists.
- No explicit `RoomAffordanceGraph` or `AnchorPlan` schema exists yet.

### Render / downstream geometry-dependent artifacts

- `packages/contracts/src/render.ts`
  - Defines render constraints, render specs, batches, assets, and verification state.
  - Render specs and assets bind to `sceneContractId`, `roomId`, `cameraId`, and `renderSpecId`.
  - Existing render schemas do not carry `canonicalRevisionId`, `geometryHash`, or a `providerTrace` object.
  - `RenderImageAssetSchema` has `generation.providerTraceId`, but P1 rules require geometry-dependent artifacts to carry `canonicalRevisionId` and `geometryHash`.
- `packages/render-pipeline/src/index.ts`
  - Placeholder only.

### API routes, frontend routes, debug pages

- API routes: none found under `apps/web/app`.
- Frontend routes: only `apps/web/app/page.tsx` and `apps/web/app/layout.tsx`.
- Debug pages: none found.

## 3. Existing schemas and duplicated schema risk

Current source of truth:

- `packages/contracts/src/index.ts` exports all shared contract modules.
- `docs/architecture/DATA_CONTRACTS.md` explicitly says `packages/contracts` is the single source of truth.
- Tests import schemas from `@homeai/contracts`, with a Vitest alias pointing to `packages/contracts/src/index.ts`.

Schema gaps for P1:

- No `CanonicalFloorplanRevision` schema.
- No `geometryHash` field on canonical floorplans, scene contracts, camera plans, render specs/assets, or soft decor plans.
- No explicit P1 draft-edit session schema.
- No confirmation command/event schema.
- No bay-window projection metadata schema.
- No line-segment/polyline primitive schema beyond `Point2DSchema` and `PolygonSchema`.
- No `SceneContract v0.2` literal version/discriminator.
- No `RoomAffordanceGraph` or `AnchorPlan` schema.

Duplicated schema risk:

- Low current runtime duplication risk because only `packages/contracts` contains real Zod schemas.
- Medium future drift risk because architecture/task docs describe future contract shapes that are not implemented in `packages/contracts`.
- Medium test-fixture drift risk because `tests/contracts/contracts.test.ts` has inline example payloads for SceneContract, camera, render, and soft decor. These are test payloads, not duplicate schemas, but they may mask missing fixture coverage if P1 schemas evolve.
- High future UI/API drift risk if P1 UI or API route code defines local TypeScript types instead of importing Zod schemas from `@homeai/contracts`.

## 4. Existing tests

Current test file:

- `tests/contracts/contracts.test.ts`

Current coverage:

- Core entity schema validation: project, file asset, parse job, SceneContract, RoomCameraPlan, and design brief.
- Render, soft decor, and lead schemas.
- LeadEvent invalid event and PII rejection.
- Room classification and space truth constants.
- Error registry validation.
- Draft and canonical floorplan fixture validation.
- Canonical floorplan rejects `scale.source != "user_confirmed"`.
- Malformed provider output fails `DraftFloorplanSchema`.

Current fixture coverage:

- `tests/fixtures/floorplans/one-bedroom`
- `tests/fixtures/floorplans/two-bedroom`
- `tests/fixtures/floorplans/three-bedroom-balcony`
- `tests/fixtures/floorplans/low-confidence-boundaries`
- `tests/fixtures/floorplans/malformed-provider-output`

No existing tests were found under package-local `src` directories.

## 5. Missing tests

Missing P1-specific tests:

- AI parse output remains untrusted and cannot be persisted as canonical geometry.
- `CanonicalFloorplanRevision` cannot be created before explicit user confirmation.
- `geometryHash` is deterministic and computed immediately after confirmation.
- `geometryHash` changes when confirmed geometry changes and remains stable when non-geometry metadata changes.
- Confirmed geometry cannot be mutated outside the Space Truth correction stage.
- SceneContract v0.2 is readonly and cannot be used as mutable state.
- Downstream artifacts require `canonicalRevisionId` and `geometryHash`.
- Bay windows are modeled as window objects with projection metadata and do not mutate wall topology.
- Balconies are independent room-like spaces with `roomType = balcony`.
- Advanced geometry accepts line segments/polyline segments only.
- NURBS, Bezier, freeform 3D, and true-curve canonical geometry are rejected.
- P1 rejects or omits LLM/chat-editing commands.
- P1 rejects structural feasibility, load-bearing wall recognition, GB compliance, construction drawing export, DXF/DWG export, and PDF export features.

Missing module tests:

- Space Truth Gate behavior tests.
- Canonicalization/confirmation command tests.
- SceneContract builder tests.
- White model/control scene fixture tests.
- Camera planner tests.
- Room affordance graph tests.
- Anchor planner tests.
- API route input/output validation tests.
- Frontend route or debug-page tests for P1 once those routes exist.

## 6. Known architecture risks

1. `geometryHash` is currently referenced by rules/docs but has no implementation.
2. `CanonicalFloorplanRevision` is required for P1 but has no schema or storage model.
3. SceneContract currently references `floorplanId`, not `canonicalRevisionId` or `geometryHash`.
4. Render, camera, and soft decor schemas are geometry-dependent but do not carry `canonicalRevisionId` and `geometryHash`.
5. SceneContract readonly behavior is a contract flag, not enforced by runtime builders.
6. The geometry package is a placeholder, so topology validation and hash generation could be scattered if P1 starts without a clear geometry module boundary.
7. The floorplan parser package is a placeholder, so parser output normalization and untrusted-draft handling are not enforced outside schemas/fixtures.
8. P03/P04/P05 validation baselines are described in task context, but this repository does not yet contain implementation code for white model, camera planner, affordance graph, or anchor planner.
9. No API routes exist; P1 route boundaries and validation will need to be designed from scratch.
10. No debug pages exist; adding them later must stay separate from production UI and must not become a design-tool surface.
11. `WallKindSchema` includes `structural`, but P1 rules prohibit load-bearing wall recognition and structural feasibility claims. P1 code must treat any structural labels as imported metadata or legacy fixture state unless separately validated and allowed.
12. Existing opening schema does not distinguish bay windows from ordinary windows.

## 7. Proposed file locations for P1 implementation

These are proposed locations only; no implementation is included in this audit.

### Contracts

- `packages/contracts/src/p1-floorplan-adjustment.ts`
  - P1 edit-session, user-confirmation, and command/result schemas.
- `packages/contracts/src/canonical-revision.ts`
  - `CanonicalFloorplanRevisionSchema`, revision status, and hash-bearing revision metadata.
- `packages/contracts/src/geometry-primitives.ts`
  - Line segment and polyline segment schemas.
- `packages/contracts/src/bay-window.ts`
  - Bay-window projection metadata if this is not folded into `floorplan.ts`.
- `packages/contracts/src/affordance-anchor.ts`
  - `RoomAffordanceGraphSchema` and `AnchorPlanSchema` if they become first-class P1/P05 contracts.

### Runtime packages

- `packages/geometry/src/geometry-hash.ts`
  - Deterministic canonical geometry hashing.
- `packages/geometry/src/topology.ts`
  - Segment, polygon closure, self-intersection, wall/opening consistency utilities.
- `packages/floorplan-parser/src/draft-normalization.ts`
  - Parser output normalization into untrusted draft state.
- `packages/scene/src/scene-contract-builder.ts`
  - Readonly SceneContract v0.2 builder from confirmed canonical revision.
- `packages/scene/src/white-model-builder.ts`
  - P03 white model/control scene baseline from SceneContract.
- `packages/scene/src/affordance-graph.ts`
  - P05 room affordance graph builder.
- `packages/scene/src/anchor-planner.ts`
  - P05 deterministic anchor planner.
- `packages/render-pipeline/src/camera-plan.ts`
  - P04 camera plan engine if camera planning remains owned by render pipeline.

### App/API/debug surfaces

- `apps/web/app/api/p1/*/route.ts`
  - Future API routes for draft load, correction save, confirmation, and revision retrieval.
- `apps/web/app/dev/p1-floorplan-adjustment/page.tsx`
  - Future debug-only validation page if needed.
- `apps/web/app/p1/*`
  - Future production P1 correction stage routes only after contracts/API boundaries are ready.

### Tests

- `tests/p1/*.test.ts`
  - P1 confirmation, canonical revision, hash, and rejection tests.
- `tests/geometry/*.test.ts`
  - Hash and topology tests.
- `tests/scene/*.test.ts`
  - SceneContract readonly builder and white model tests.
- `tests/camera/*.test.ts`
  - Camera planner tests.
- `tests/affordance/*.test.ts`
  - Affordance and anchor tests.
- `tests/api/*.test.ts`
  - API contract validation tests.
- `tests/fixtures/p1/**`
  - Draft, edit-session, confirmation, canonical revision, geometry hash, bay-window, and balcony fixtures.

## 8. Do-not-touch list

For P1 implementation planning, avoid changing these unless a later task explicitly asks for it:

- Existing M0 fixture semantics under `tests/fixtures/floorplans/**`.
- Existing root workspace setup: `pnpm-workspace.yaml`, `package.json`, `tsconfig.base.json`, `vitest.config.ts`.
- Existing architecture guardrails in `AGENTS.md`, `task.md`, and `.agents/skills/**`.
- Existing contract exports unrelated to P1 unless adding explicit P1-compatible fields with tests.
- `apps/web/app/page.tsx` and `apps/web/app/layout.tsx` until a UI task explicitly starts.
- Downstream render, soft decor, provider, and lead contracts unless the task is specifically about adding required `canonicalRevisionId` / `geometryHash` traceability.
- Any construction, PDF, DXF/DWG export, structural feasibility, load-bearing recognition, GB compliance, LLM/chat editing, or freeform geometry surface.

## Audit conclusion

The repository is ready for P1 planning but not yet for P1 implementation without new contracts and tests. The current codebase has a solid M0 schema baseline, floorplan fixtures, and Space Truth rules, but P1-critical primitives are absent: `CanonicalFloorplanRevision`, deterministic `geometryHash`, explicit line/polyline geometry primitives, bay-window projection metadata, readonly SceneContract v0.2 enforcement, and geometry traceability fields on downstream artifacts.

The safest P1 start point is contract-first: add revision/hash/geometry primitive schemas and tests before adding API routes or UI. Parser, scene, camera, affordance, anchor, and render modules should remain downstream consumers of confirmed canonical revisions, not writers of Space Truth.
