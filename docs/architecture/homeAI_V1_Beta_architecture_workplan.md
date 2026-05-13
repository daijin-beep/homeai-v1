# homeAI V1 Beta Technical Architecture and Work Plan

## Executive decision

The V1 Beta system should be built as a Space-Truth-rooted, contract-first pipeline:

```text
Floorplan Upload
→ Parse Job / Import Job
→ User Correction / Scale Gate / Room Review
→ Canonical Floorplan JSON
→ Scene Contract
→ 3D White Model / Control Scene
→ Design Kernel
→ Room Affordance Graph
→ Anchor Planner
→ Per-room Camera Plan
→ Creative Render Spec
→ Image Adapter Orchestrator
→ Render Consistency Verifier
→ Room Gallery / Scheme Page
→ Soft Decor GPS Lite
→ Lead Event Tracking
```

V1 Beta should not be treated as a full commercial装修平台. Its goal is to prove real upload, correction, full-space trust, render verification, SKU interest, payment intent, lead intent, and a decreasing delivery-cost path.

## Current validation status

| Validation item | Status | Decision |
|---|---|---|
| P0-1A Space Truth Gate | Completed | Freeze as validation baseline. |
| P0-1B DWG to DXF conversion | Completed | Keep ODA/DXF path; do not write DWG parser first. |
| P0-1C DXF entity filtering | Not completed | Run spike before depending on auto parse. |
| P0-1D manual tracing cost | Not completed | Run UX spike. |
| P0-1E real irregular floorplan to CanonicalFloorplan | Not completed | Cannot start production parser claim yet. |

## Can start now

1. Shared contracts and schema validation.
2. Provider trace and error boundaries.
3. Space Truth Gate regression tests.
4. Scene Contract Builder from canonical fixtures.
5. Control Scene / White Model fixture pipeline.
6. Room Affordance Graph schema and deterministic builder.
7. Anchor Planner heuristic baseline.
8. Camera Plan Engine.
9. CreativeRenderSpec compiler.
10. Render Verifier L1 baseline.
11. Scheme Page mock vertical slice.
12. Soft Decor GPS Lite admission gate.
13. LeadEvent tracking and debug pages.
14. Codex AGENTS.md and code review rules.

## Must wait for validation

1. Production-grade automatic DXF parser.
2. Real irregular-floorplan canonicalization without manual review.
3. Fully automated user floorplan correction workflow.
4. Image adapter model selection as main provider.
5. Claims about fully automated V1 delivery.

## Phase plan

### Phase A — Architecture foundation

Goal: make the system contract-first before feature work.

Deliverables:

- shared schemas
- fixture suite
- provider trace
- error boundaries
- geometryHash rules
- debug page skeleton
- CI validation tests

Exit criteria:

- malformed JSON rejected
- downstream mutation rejected
- geometryHash mismatch blocked
- every provider result traced

### Phase B — Space Truth input validation

Goal: validate the real floorplan entry path.

Deliverables:

- DXF entity filtering spike
- manual tracing UX spike
- scale gate
- room review flow
- canonicalization only after confirmation

Exit criteria:

- at least one real irregular floorplan can become CanonicalFloorplan through correction
- unconfirmed DXF never becomes canonical
- user correction effort is measured

### Phase C — Scene and Design Kernel vertical slice

Goal: generate a full-space scheme from confirmed geometry.

Deliverables:

- SceneContract
- white model / control scene
- DesignBriefLite
- RoomSchemeLite for every valid room
- RoomAffordanceGraph
- AnchorPlan
- CameraPlan

Exit criteria:

- every valid room has a scheme card
- no downstream geometry mutation
- anchor placement warnings are explicit

### Phase D — Render pipeline

Goal: produce verified render specs and gallery gating.

Deliverables:

- CreativeRenderSpec
- image adapter abstraction
- mock + challenger adapters
- L1 verifier
- VLM checklist placeholder
- render debug page

Exit criteria:

- every render has traceability
- fail render blocked
- warning render routed to review

### Phase E — Scheme page, SKU, lead tracking

Goal: convert scheme outputs into user-facing beta funnel.

Deliverables:

- full-space scheme page
- room render gallery
- Soft Decor GPS Lite
- lead event tracking
- operational dashboard

Exit criteria:

- scheme view / render view / SKU click / save / share / lead events visible
- verified SKU gate excludes missing dimensions, price, or links

## Module start matrix

| Module | Start now? | Required input | Stop condition |
|---|---:|---|---|
| Shared Contracts | Yes | Current V1 contract list | Missing validation tests |
| Space Truth Gate | Freeze + test | Existing gate | Any rule weakening |
| Floorplan Intake | Yes | Upload + mock parse | Direct canonicalization |
| DXF Filtering | Spike only | DXF entities | Claiming production parser |
| Manual Tracing | Spike only | background DXF/image | User flow bypasses gate |
| Scene Contract | Yes | canonical fixture | Mutable geometry |
| White Model | Yes | SceneContract | High-fidelity renderer creep |
| Design Brief Lite | Yes | free text + defaults | Questionnaire bloat |
| Design Kernel | Yes | SceneContract + brief | LLM final coordinates |
| Affordance Graph | Yes | room polygons | Template-only shortcut |
| Anchor Planner | Yes | affordance graph | Aesthetic autopilot scope |
| Camera Plan | Yes | scene + rooms | Key-space-only rendering |
| Render Spec | Yes | camera + style + anchors | Missing locked geometry masks |
| Image Adapter | Mock first | RenderSpec | Hard-coding one model |
| Render Verifier | Yes | RenderSpec + output | VLM-only pass/fail |
| Scheme Page | Yes | mock outputs | Shows fail renders |
| Soft Decor GPS | Yes | verified SKU fixtures | Recommends items without dimensions |
| Lead Events | Yes | event schema | No idempotency / trace |

