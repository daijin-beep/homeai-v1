# TASK-M0-001 — Foundation + Contracts

## Status

ready_for_codex

## Complexity

large

## Goal

Set up the homeAI V1 technical foundation.

M0 must establish:

1. monorepo structure
2. TypeScript strict baseline
3. shared contracts package
4. schema validation baseline
5. room classification rules
6. space truth thresholds
7. deterministic mock provider contracts
8. mock floorplan fixtures
9. test baseline
10. AI collaboration docs and Codex guardrails

M0 must not implement product flows yet.

---

## V1 definition

homeAI V1 is:

- real floorplan spatial foundation
- full-space 3D white model
- per-room camera plan
- per-room multi-angle render generation
- room render gallery
- lightweight design brief
- soft decor GPS
- product candidate matching
- lead event tracking

V1 is not:

- PDF export
- construction communication
- contractor collaboration
- professional drawing output
- construction-ready material list
- high-fidelity real-time 3D renderer
- AI chat redesign system

---

## Depends on

None.

This is the first implementation task.

---

## Modifies packages

Allowed to create or modify:

```text
AGENTS.md
package.json
pnpm-workspace.yaml
tsconfig.base.json
vitest.config.ts

apps/web/

packages/contracts/
packages/geometry/
packages/scene/
packages/floorplan-parser/
packages/render-pipeline/
packages/soft-decor-gps/
packages/providers/
packages/analytics/

tests/fixtures/
tests/contracts/

docs/architecture/
docs/contracts/
docs/tasks/
docs/ai/
.agents/skills/
````

---

## Must not modify

Do not implement:

```text
PDF export
construction communication
contractor workflow
professional drawing output
high-fidelity 3D renderer
walkthrough video
AI free-form redesign chat
real provider API calls
real affiliate integrations
real SKU marketplace integrations
```

---

## Context

Read first:

```text
AGENTS.md
docs/ai/GPT_ARCHITECT.md
docs/ai/CLAUDE_REQUIREMENTS.md
docs/ai/code_review.md
docs/architecture/TECH_STACK.md
docs/architecture/DATA_CONTRACTS.md
docs/contracts/mock-providers.md
docs/contracts/room-classification.md
```

If any of these docs do not exist, create them as part of this task.

---

## Technical stack decisions

Use these choices. Do not substitute without explicit approval.

| Layer                                | Decision                          |
| ------------------------------------ | --------------------------------- |
| Monorepo                             | pnpm workspaces                   |
| Language                             | TypeScript strict                 |
| Web app                              | Next.js + React                   |
| 2D floorplan editor future baseline  | SVG + React                       |
| 3D white model future baseline       | Three.js + React Three Fiber      |
| Runtime schema                       | Zod                               |
| JSON Schema generation               | zod-to-json-schema or equivalent  |
| Unit tests                           | Vitest                            |
| UI tests future baseline             | React Testing Library             |
| E2E future baseline                  | Playwright                        |
| DB V1 future baseline                | SQLite                            |
| DB abstraction future baseline       | Drizzle                           |
| Object storage V1 future baseline    | local filesystem adapter          |
| Job orchestration V1 future baseline | DB-backed async jobs              |
| Real queue future                    | Redis / BullMQ, not M0            |
| Mock render output                   | deterministic SVG/PNG placeholder |
| Mock SKU source                      | deterministic catalog JSON        |

---

## Build

### 1. Monorepo foundation

Create:

```text
apps/web
packages/contracts
packages/geometry
packages/scene
packages/floorplan-parser
packages/render-pipeline
packages/soft-decor-gps
packages/providers
packages/analytics
tests/fixtures
tests/contracts
docs/architecture
docs/contracts
docs/tasks
docs/ai
.agents/skills
```

Add:

```text
pnpm-workspace.yaml
root package.json
tsconfig.base.json
vitest config
basic README
```

Requirements:

```text
TypeScript strict mode enabled.
All packages build or typecheck.
Contracts package exports public schemas and types.
No app code should duplicate contract schemas.
```

---

### 2. Create `packages/contracts`

The contracts package is the single source of truth for persistent data shapes, API payloads, provider outputs, render specs, soft decor GPS, and lead events.

Create Zod schemas and inferred TypeScript types for:

```text
Project
FileAsset
ParseJob
DraftFloorplan
CanonicalFloorplan
CanonicalRoom
CanonicalWall
CanonicalOpening
SceneContract
SceneRoom
SceneWall
SceneOpening
RoomCameraPlan
RoomCamera
DesignBrief
StyleProfile
RenderImageSpec
RenderBatch
RenderImageAsset
SoftDecorGPSPlan
RoomSoftDecorGuide
SoftDecorRecommendation
ProductCandidate
LeadEvent
AppError
```

Each persistent entity must include:

```text
id
createdAt where relevant
updatedAt where relevant
version where persistent schema evolution matters
```

---

### 3. Core contract requirements

#### Project

Required fields:

```text
id
ownerId optional
name
status
createdAt
updatedAt
```

Allowed project statuses:

```text
created
floorplan_uploaded
draft_floorplan_ready
space_confirmed
scene_ready
design_brief_ready
camera_plan_ready
renders_ready
soft_gps_ready
```

---

#### FileAsset

Required fields:

```text
id
projectId
kind
mimeType
storageUrl
sizeBytes
checksum
createdAt
```

Allowed kinds:

```text
floorplan_image
provider_raw_output
render_image
mock_render_image
sku_image
```

Allowed MIME types:

```text
image/png
image/jpeg
image/svg+xml
application/pdf
application/json
```

---

#### ParseJob

Required fields:

```text
id
projectId
fileAssetId
provider
status
progress
createdAt
updatedAt
```

Allowed statuses:

```text
queued
running
succeeded
failed
cancelled
```

Provider enum:

```text
mock_floorplan
vision_floorplan
hybrid_floorplan
```

Must support optional:

```text
rawOutputAssetId
draftFloorplanId
error
```

---

#### DraftFloorplan

Required fields:

```text
id
projectId
parseJobId
unit
scale
rooms
walls
openings
confidence
warnings
createdAt
updatedAt
```

Scale source enum:

```text
provider_estimated
user_confirmed
unknown
```

---

#### CanonicalFloorplan

Required fields:

```text
id
projectId
draftFloorplanId
version
unit
scale
rooms
walls
openings
verifier
confirmedByUser
confirmedAt
createdAt
updatedAt
```

Rules:

```text
scale.source must be user_confirmed.
confirmedByUser must be true.
unit must be mm.
```

---

#### CanonicalRoom

Required fields:

```text
id
type
label
polygon
areaMm2
confidence
userConfirmed
```

Room type enum:

```text
living
dining
living_dining
bedroom
master_bedroom
children_room
study
kitchen
bathroom
entry
balcony
corridor
storage
unknown
```

---

#### SceneContract

Required fields:

```text
id
projectId
floorplanId
version
coordinateSystem
unit
rooms
walls
openings
constraints
validation
createdAt
updatedAt
```

Constraints must include:

```text
immutableGeometry: true
noNewWindows: true
noNewDoorsWithoutUserApproval: true
noWallDeletionWithoutUserApproval: true
renderingCannotMutateGeometry: true
```

---

#### DesignBrief

Required fields:

```text
id
projectId
source
styleProfile
functionalPreferences
clarificationNeeded
createdAt
updatedAt
```

DesignBrief exists in M0 as a contract only.
The actual Design Brief Capture UI/API will be implemented in `TASK-M3.5-001`.

---

#### RenderImageSpec

Required fields:

```text
id
projectId
schemeId
sceneContractId
roomId
cameraId
styleProfileId
viewType
constraints
designIntent
output
createdAt
updatedAt
```

Render constraints must include:

```text
preserveWalls: true
preserveWindows: true
preserveDoors: true
noNewOpenings: true
noRoomShapeChange: true
noFunctionChange: true
```

---

#### RenderImageAsset

Required fields:

```text
id
projectId
schemeId
roomId
cameraId
sceneContractId
renderSpecId
renderBatchId
asset
generation
verification
createdAt
```

Every render image must be traceable to:

```text
projectId
schemeId
roomId
cameraId
sceneContractId
renderSpecId
renderBatchId
```

---

#### SoftDecorGPSPlan

Required fields:

```text
id
projectId
schemeId
sceneContractId
styleProfileId
status
rooms
createdAt
updatedAt
```

Allowed statuses:

```text
queued
running
ready
failed
```

---

#### ProductCandidate

Required fields:

```text
id
provider
category
title
imageUrl
leadUrl
price
size
fit
```

Fit must include:

```text
roomId
fitScore
styleScore
sizeScore
budgetScore
warnings
```

---

#### LeadEvent

Required fields:

```text
id
projectId
eventType
source
createdAt
```

Optional fields:

```text
roomId
recommendationId
productId
metadata
```

Allowed event types:

```text
floorplan_uploaded
space_confirmed
white_model_viewed
room_render_viewed
product_view
product_click
product_save
alternative_click
contact_request
style_regenerate
room_regenerate
```

LeadEvent metadata must not include unnecessary PII.

---

### 4. Room classification constants

Create:

```text
packages/contracts/src/room-classification.ts
docs/contracts/room-classification.md
```

Export:

```ts
ROOM_CLASSIFICATION
ROOM_AREA_THRESHOLDS
getRoomEligibility()
```

Required classification groups:

```text
knownRoomTypes
mainRoomTypes
renderableRoomTypes
softDecorTargetRoomTypes
nonPrimarySoftDecorTypes
userLabelRequiredTypes
```

Recommended definition:

```ts
export const ROOM_CLASSIFICATION = {
  knownRoomTypes: [
    "living",
    "dining",
    "living_dining",
    "bedroom",
    "master_bedroom",
    "children_room",
    "study",
    "kitchen",
    "bathroom",
    "entry",
    "balcony",
    "corridor",
    "storage"
  ],

  mainRoomTypes: [
    "living",
    "dining",
    "living_dining",
    "bedroom",
    "master_bedroom",
    "children_room",
    "study",
    "kitchen",
    "bathroom"
  ],

  renderableRoomTypes: [
    "living",
    "dining",
    "living_dining",
    "bedroom",
    "master_bedroom",
    "children_room",
    "study",
    "kitchen",
    "bathroom",
    "entry",
    "balcony",
    "corridor",
    "storage"
  ],

  softDecorTargetRoomTypes: [
    "living",
    "dining",
    "living_dining",
    "bedroom",
    "master_bedroom",
    "children_room",
    "study",
    "kitchen",
    "bathroom",
    "entry",
    "balcony"
  ],

  nonPrimarySoftDecorTypes: [
    "corridor",
    "storage"
  ],

  userLabelRequiredTypes: [
    "unknown"
  ]
} as const;
```

Room eligibility must distinguish:

```text
isSpatiallyValid
isRenderable
isSoftDecorTarget
isMainRoom
reason
```

Rules:

```text
unknown room type is not renderable until user confirmed.
room polygon must be closed.
room polygon must not self-intersect.
room area must be above minimum threshold.
storage and corridor may be renderable but are not primary soft decor targets.
small corridors may be merged into adjacent visual context in later tasks.
```

---

### 5. Space truth thresholds

Create:

```text
packages/contracts/src/space-truth-thresholds.ts
```

Export:

```ts
export const SPACE_TRUTH_THRESHOLDS = {
  minScoreForScene: 0.8,
  minScoreForCameraPlan: 0.8,
  minScoreForRender: 0.8,
  minScoreForSoftDecorGps: 0.8
} as const;
```

Create docs:

```text
docs/contracts/space-truth-thresholds.md
```

Document:

```text
scale unknown blocks confirmation
invalid topology blocks confirmation
self-intersecting room polygon blocks confirmation
unknown room type blocks render for that room
door swing unknown is warning, not blocking
opening low confidence is warning unless geometry impossible
```

---

### 6. Error codes

Create:

```text
packages/contracts/src/errors.ts
docs/contracts/error-codes.md
```

Define error codes grouped by module.

Required error codes:

```text
UPLOAD_UNSUPPORTED_FORMAT
UPLOAD_TOO_LARGE
IMAGE_TOO_LOW_RESOLUTION

PARSE_PROVIDER_TIMEOUT
PARSE_PROVIDER_MALFORMED_OUTPUT

SCALE_UNKNOWN
LOW_CONFIDENCE_ROOM_BOUNDARY
TOPOLOGY_INVALID
OPENING_UNCONFIRMED
SPACE_TRUTH_SCORE_TOO_LOW

SCENE_CONTRACT_INVALID

CAMERA_PLAN_FAILED
CAMERA_INTERSECTS_WALL

RENDER_PROVIDER_FAILED
RENDER_CONSTRAINT_VIOLATION
ROOM_RENDER_INCOMPLETE

SKU_SIZE_MISMATCH
SKU_PROVIDER_EMPTY

LEAD_EVENT_INVALID
PII_CAPTURE_BLOCKED
```

Each error definition should include:

```text
code
module
severity
blocking
userFixable
defaultMessage
```

Severity enum:

```text
info
warning
error
critical
```

---

### 7. Mock provider contract documentation

Create:

```text
docs/contracts/mock-providers.md
```

M0 must define, but not fully implement, deterministic contracts for:

```text
MockFloorplanProvider
MockRenderProvider
MockSKUProvider
MockAffiliateProvider
```

#### MockFloorplanProvider contract

Inputs:

```text
projectId
fileAssetId
mockFixtureId
```

Allowed fixture IDs:

```text
fixture_one_bedroom
fixture_two_bedroom
fixture_three_bedroom_balcony
fixture_malformed_provider_output
fixture_low_confidence_boundaries
```

Outputs:

```text
rawOutput
DraftFloorplan
confidence
warnings
```

Rules:

```text
same fixture ID must always produce the same DraftFloorplan
rawOutput must be persisted as provider_raw_output FileAsset in future tasks
malformed fixture must fail schema validation
```

---

#### MockRenderProvider contract

Inputs:

```text
RenderImageSpec
SceneContract
RoomCamera
```

Output:

```text
RenderImageAsset-compatible asset metadata
```

Rules:

```text
must generate deterministic SVG or PNG placeholder
must include visible roomId
must include visible room label
must include cameraId
must include viewType
must include styleProfileId
must include renderSpecId
must not use stock images
must not call real image models
```

---

#### MockSKUProvider contract

Inputs:

```text
category
styleKeywords
sizeConstraint
budgetBand
```

Output:

```text
ProductCandidate[]
```

Catalog requirements:

```text
minimum 60 products
recommended 100 products
cover all V1 soft decor categories
include price
include dimensions
include imageUrl placeholder
include provider
include style tags
include budget band
include availability
```

Required categories:

```text
sofa
coffee_table
tv_cabinet
dining_table
dining_chair
bed
wardrobe
desk
chair
curtain
rug
lamp
storage_cabinet
mirror
decor
```

---

#### MockAffiliateProvider contract

Inputs:

```text
productId
projectId
roomId optional
source
```

Output:

```text
leadUrl
trackingId
```

Rules:

```text
leadUrl can be provider://mock-affiliate/{trackingId}
must not use real affiliate links in M0
```

---

### 8. Mock fixtures

Create fixture directories:

```text
tests/fixtures/floorplans/one-bedroom/
tests/fixtures/floorplans/two-bedroom/
tests/fixtures/floorplans/three-bedroom-balcony/
tests/fixtures/floorplans/malformed-provider-output/
tests/fixtures/floorplans/low-confidence-boundaries/
```

Each valid floorplan fixture should include:

```text
raw-provider-output.json
draft-floorplan.json
canonical-floorplan.json
notes.md
```

The malformed fixture should include:

```text
raw-provider-output.json
expected-error.json
notes.md
```

Fixture requirements:

```text
one-bedroom covers living/dining, bedroom, kitchen, bathroom, entry
two-bedroom covers living_dining, master_bedroom, bedroom, kitchen, bathroom, balcony
three-bedroom-balcony covers living_dining, master_bedroom, children_room, study/bedroom, kitchen, bathroom, balcony, corridor
```

All valid fixtures must pass schema validation.

---

### 9. Architecture docs

Create or update:

```text
docs/architecture/TECH_STACK.md
docs/architecture/SYSTEM_ARCHITECTURE.md
docs/architecture/DATA_CONTRACTS.md
docs/architecture/V1_SCOPE.md
```

`V1_SCOPE.md` must explicitly state:

```text
V1 includes:
- spatial foundation
- canonical floorplan
- scene contract
- 3D white model
- camera planning
- per-room renders
- soft decor GPS
- lead tracking

V1 excludes:
- PDF
- construction communication
- contractor collaboration
- construction-ready material lists
- professional drawings
```

---

### 10. AI collaboration docs

Create or update:

```text
AGENTS.md
docs/ai/GPT_ARCHITECT.md
docs/ai/CLAUDE_REQUIREMENTS.md
docs/ai/CODEX_TASK_TEMPLATE.md
docs/ai/code_review.md
```

AGENTS.md must include these non-negotiable rules:

```text
Space truth first.
Never let an LLM write final geometry.
Never bypass shared schemas.
Never mutate confirmed geometry outside Space Truth Engine.
Rendering must not modify canonical geometry.
Every render image must be traceable.
Every valid room must eventually receive render coverage.
Soft decor GPS must use size/style/budget constraints.
Do not implement PDF in V1.
Do not implement construction communication in V1.
Do not implement contractor collaboration in V1.
```

---

### 11. Codex skills

Create:

```text
.agents/skills/schema-contract-review/SKILL.md
.agents/skills/space-truth-review/SKILL.md
.agents/skills/render-pipeline-review/SKILL.md
.agents/skills/soft-decor-gps-review/SKILL.md
.agents/skills/feature-implementation-plan/SKILL.md
```

Each skill should include:

```text
name
description
checks
reject conditions
required output
```

M0 only needs skill documents.
Do not implement automation around skills yet.

---

## Tests to add

Create contract validation tests under:

```text
tests/contracts/
```

Required tests:

```text
Project schema validates valid payload.
FileAsset schema validates valid payload.
ParseJob schema validates valid payload.
DraftFloorplan schema validates valid fixtures.
CanonicalFloorplan schema validates valid fixtures.
CanonicalFloorplan rejects scale.source != user_confirmed.
SceneContract schema validates valid payload.
RoomCameraPlan schema validates valid payload.
DesignBrief schema validates valid payload.
RenderImageSpec schema validates valid payload.
RenderImageAsset schema validates traceability fields.
SoftDecorGPSPlan schema validates valid payload.
ProductCandidate schema validates valid payload.
LeadEvent schema validates allowed event types.
LeadEvent rejects invalid event types.
ROOM_CLASSIFICATION exports required groups.
getRoomEligibility rejects unknown room type unless userConfirmed.
getRoomEligibility rejects room below minimum area.
getRoomEligibility marks corridor as renderable but not primary soft decor target.
SPACE_TRUTH_THRESHOLDS exports minScoreForScene = 0.8.
Error code registry includes all required codes.
Valid floorplan fixtures pass validation.
Malformed provider output fixture fails validation.
```

---

## Done when

```text
[ ] pnpm install works.
[ ] pnpm typecheck works.
[ ] pnpm test works.
[ ] packages/contracts exports all schemas and inferred types.
[ ] all valid fixtures pass schema validation.
[ ] malformed provider output fixture fails validation.
[ ] ROOM_CLASSIFICATION exists and is tested.
[ ] SPACE_TRUTH_THRESHOLDS exists and is tested.
[ ] error code registry exists and is tested.
[ ] docs/contracts/mock-providers.md exists.
[ ] docs/contracts/room-classification.md exists.
[ ] docs/contracts/error-codes.md exists.
[ ] docs/architecture/TECH_STACK.md exists.
[ ] docs/architecture/V1_SCOPE.md excludes PDF and construction communication.
[ ] AGENTS.md exists and includes V1 guardrails.
[ ] Codex skills exist.
[ ] no real AI provider is called.
[ ] no PDF, contractor, construction, or delivery-layer feature is implemented.
```

---

## Error cases to define in M0

M0 only defines these error codes and docs them.
Do not implement runtime handling yet except schema tests.

```text
UPLOAD_UNSUPPORTED_FORMAT
UPLOAD_TOO_LARGE
IMAGE_TOO_LOW_RESOLUTION
PARSE_PROVIDER_TIMEOUT
PARSE_PROVIDER_MALFORMED_OUTPUT
SCALE_UNKNOWN
LOW_CONFIDENCE_ROOM_BOUNDARY
TOPOLOGY_INVALID
OPENING_UNCONFIRMED
SPACE_TRUTH_SCORE_TOO_LOW
SCENE_CONTRACT_INVALID
CAMERA_PLAN_FAILED
CAMERA_INTERSECTS_WALL
RENDER_PROVIDER_FAILED
RENDER_CONSTRAINT_VIOLATION
ROOM_RENDER_INCOMPLETE
SKU_SIZE_MISMATCH
SKU_PROVIDER_EMPTY
LEAD_EVENT_INVALID
PII_CAPTURE_BLOCKED
```

---

## Recovery

If implementation becomes too large:

1. Stop after `packages/contracts` + tests.
2. Do not create partial hidden product behavior.
3. Do not implement UI beyond a minimal placeholder app shell.
4. Do not implement real provider calls.
5. Do not mutate existing contracts without tests.
6. Summarize incomplete files and risks.
7. Leave follow-up work as explicit tasks.

---

## Final Codex response must include

```text
1. changed files
2. created packages
3. created docs
4. commands run
5. test results
6. known limitations
7. follow-up tasks
8. any deviations from this task card
```

---

## Review focus for GPT architect

This task will be reviewed for:

```text
1. V1 scope correctness
2. contract completeness
3. schema validation
4. fixture determinism
5. room classification correctness
6. mock provider contract clarity
7. test baseline
8. absence of PDF / delivery / construction scope creep
```
