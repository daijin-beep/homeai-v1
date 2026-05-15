# CreativeRenderSpec Compiler Hardening

## Purpose

Batch 13 strengthens the Codex producer-side compiler that creates ADS-consumable `CreativeRenderSpec` objects.

The compiler connects existing canonical inputs:

```text
SchemeLiteContract
RoomSchemeLite
SceneContract v0.2
P1 room camera plan
ControlScene asset refs
```

The output is one validated `CreativeRenderSpec` for every renderable room camera, or an explicit blocking compiler issue.

## Producer Responsibility

Codex owns the deterministic producer boundary.

- Read SchemeLite room intent.
- Read readonly SceneContract geometry trace.
- Read camera plans for each valid room.
- Read control scene asset references.
- Emit nested input asset refs in the current contract shape.
- Validate every emitted spec with `validateCreativeRenderSpecForADS()`.
- Return a coverage summary for every valid SceneContract room.

## ADS Consumer Boundary

ADS remains the consumer of the frozen spec.

- ADS may validate a spec.
- ADS may reject a spec.
- ADS may run runtime work in ADS-owned modules.
- ADS must not mutate SceneContract geometry.
- ADS must not change the geometryHash.
- ADS must not treat provider output as new Space Truth.

Batch 13 does not implement ADS runtime.

## Full-space Coverage Rule

Every valid SceneContract room must appear in the compiler coverage summary.

- A covered room has at least the required number of emitted specs.
- A cautious room is still present and may still emit specs.
- A non-renderable room is still present and explains why no spec was emitted.
- A room missing a camera plan produces a blocking issue.
- A room missing a required asset produces a blocking issue.
- The compiler must not silently emit only key spaces.

## Required Asset Refs

Each compiled spec must include all six nested input asset refs:

```text
inputs.controlRender.uri
inputs.depthMap.uri
inputs.semanticMask.uri
inputs.lineMap.uri
inputs.lockedGeometryMask.uri
inputs.anchorLayoutMask.uri
```

These are the current canonical fields. Do not add flat URL aliases.

## GeometryHash Invariants

The compiler fails closed when trace values do not align.

- SchemeLite `homeId` must match SceneContract `homeId`.
- SchemeLite `floorplanRevisionId` must match SceneContract `canonicalRevisionId`.
- SchemeLite `sceneContractId` must match SceneContract `sceneContractId`.
- SchemeLite `geometryHash` must match SceneContract `geometryHash`.
- CameraPlan trace fields must match SceneContract trace fields.
- Every asset `geometryHash` must match SceneContract `geometryHash`.

No valid specs are emitted when the top-level geometry trace is mismatched.

## Cautious and Non-renderable Rooms

Kitchen and bathroom rooms may be marked cautious by producer policy.

- Cautious rooms remain in room coverage.
- Cautious rooms may still emit specs when the policy includes them.
- Non-renderable rooms remain in room coverage.
- Non-renderable rooms must explain why no spec was emitted.

The compiler must not drop cautious or non-renderable rooms from the summary.

## Forbidden Scope

Batch 13 does not add runtime or product behavior.

- No ADS runtime imports.
- No verifier implementation.
- No real image provider.
- No network calls.
- No gallery admission engine.
- No commerce or export logic.
- No construction logic.
- No production persistence.

## Encoding Guard

This document must remain readable in GitHub raw view with ordinary physical line breaks.

- Store the file as UTF-8 text without a byte order mark.
- Use ordinary LF or CRLF newline bytes only.
- Do not serialize this document as escaped newline text.
- Do not include zero-width, bidi, line-separator, paragraph-separator, or other format control characters.
- Keep headings, bullets, and code fences on separate physical lines.
