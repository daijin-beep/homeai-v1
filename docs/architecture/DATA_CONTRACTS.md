# Data Contracts

`packages/contracts` is the single source of truth for persistent data shapes, API payloads, provider outputs, render specs, soft decor GPS, and lead events.

## Contract Rules

- All runtime validation uses Zod schemas exported from `@homeai/contracts`.
- App code must not duplicate contract schemas inline.
- Provider raw output is never accepted directly into canonical geometry.
- Canonical Floorplan JSON requires `unit: "mm"`, `scale.source: "user_confirmed"`, and `confirmedByUser: true`.
- Scene Contract consumes canonical geometry and declares immutable geometry constraints.
- RenderImageAsset must preserve traceability to project, scheme, room, camera, scene contract, render spec, and render batch.
- LeadEvent metadata must not include unnecessary PII.

## Schema Groups

- Project and file lifecycle: Project, FileAsset, ParseJob.
- Space truth: DraftFloorplan, CanonicalFloorplan, CanonicalRoom, CanonicalWall, CanonicalOpening.
- Scene and camera: SceneContract, SceneRoom, SceneWall, SceneOpening, RoomCameraPlan, RoomCamera.
- Design and render: DesignBrief, StyleProfile, RenderImageSpec, RenderBatch, RenderImageAsset.
- Soft decor GPS: SoftDecorGPSPlan, RoomSoftDecorGuide, SoftDecorRecommendation, ProductCandidate.
- Analytics and errors: LeadEvent, AppError, error definitions.
