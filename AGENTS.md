# AGENTS.md — homeAI V1 Beta Codex Working Rules

## Mission

Build homeAI V1 Beta as a contract-first, Space-Truth-rooted system.

## Mandatory pre-task reading

Before executing any task in this repository, read this file first. For P1 work, also read:

1. `docs/architecture/p1-current-state-audit.md`
2. Relevant shared contracts in `packages/contracts/src`
3. Relevant review skill files under `.agents/skills`

Do not start implementation from chat context alone when repository instruction files or contracts exist.

## P1 execution context

Current stage: homeAI P1 floorplan adjustment main-stage engineering.

Validated pre-development baseline:

1. P01 real-floorplan manual tracing is basically feasible; remaining work is interaction optimization, not a blocked technical route.
2. P02 SceneContract v0.2 passed validation.
3. P03 white model, P04 camera, and P05 affordance / anchor validation baselines passed.

P1 positioning:

1. P1 floorplan adjustment is fallback correction for AI-parsed floorplans.
2. P1 is the user confirmation layer for Space Truth.
3. P1 is not a design tool.
4. P1 is not a construction drawing tool.
5. P1 does not support LLM/chat editing.

After each task batch, the final report must include:

1. Changed files.
2. Added schemas, services, UI, and tests.
3. Tests that passed.
4. Boundaries still not implemented.
5. Architecture risks, if any.

## Non-negotiable architecture rules

1. Space Truth is the root of the system.
2. Downstream modules must not mutate confirmed geometry.
3. LLMs must not write final coordinates.
4. Image generation outputs must never become new walls / windows / doors truth.
5. Every core module must communicate through schemas / contracts.
6. Every provider output must pass schema validation.
7. Every render must have renderSpecId, roomId, cameraId, geometryHash, providerTrace, and verification status.
8. Fail renders must not enter the user gallery.
9. Every valid room must have RoomSchemeLite, CameraPlan, CreativeRenderSpec, and RenderVerificationReport.
10. V1 Beta must not add施工图、contractor collaboration、construction-ready material list、free-form AI redesign, AR量房, or high-fidelity real-time 3D.

## P1 Space Truth correction rules

P1 is the production floorplan adjustment main stage. It is a Space Truth correction and user confirmation stage, not a design tool, construction tool, or LLM/chat editing tool.

1. AI parse output is always an untrusted draft.
2. CanonicalFloorplanRevision may be created only after explicit user confirmation.
3. CanonicalFloorplanRevision must be immutable after creation.
4. Every confirmed revision must compute a deterministic geometryHash.
5. SceneContract v0.2 is readonly.
6. Downstream modules must not mutate confirmed geometry.
7. P1 does not support LLM/chat editing.
8. P1 does not support structural feasibility checks, load-bearing wall recognition, GB compliance checks, construction drawing export, DXF/DWG export, or PDF export.
9. Advanced geometry must be represented internally as line segments or polyline segments.
10. Canonical geometry must not use NURBS, Bezier curves, freeform 3D geometry, or true curves.
11. Bay windows are window objects with projection metadata; they must not mutate wall topology.
12. Balconies are independent room-like spaces with roomType = balcony.
13. All geometry-dependent downstream artifacts must carry canonicalRevisionId and geometryHash.
14. All behavior changes require tests.

## Automatic reject conditions

Reject any proposed implementation that:

1. Treats AI parse output as trusted Space Truth.
2. Creates CanonicalFloorplanRevision before user confirmation.
3. Allows CanonicalFloorplanRevision mutation after creation.
4. Skips deterministic geometryHash generation after confirmation.
5. Mutates SceneContract v0.2 or treats it as writable state.
6. Lets downstream modules edit confirmed walls, windows, doors, openings, room polygons, or coordinates.
7. Adds LLM/chat editing to P1 floorplan adjustment.
8. Adds structural feasibility, load-bearing wall recognition, GB compliance, construction drawings, DXF/DWG export, or PDF export to P1.
9. Introduces NURBS, Bezier, freeform 3D, or true-curve canonical geometry.
10. Models bay window projection by changing wall topology instead of window metadata.
11. Models balconies as wall mutations instead of independent room-like spaces with roomType = balcony.
12. Produces geometry-dependent downstream artifacts without canonicalRevisionId and geometryHash.
13. Changes behavior without tests.
