# CreativeRenderSpec Freeze

## Purpose

`CreativeRenderSpec` is the frozen producer-side contract that Codex hands to ADS for render runtime consumption.

ADS may validate and consume this object, but it must not mutate the spec, SceneContract geometry, SchemeLite data, or any Space Truth artifact.

Batch 12 does not add a new render runtime. It locks the current contract semantics and adds producer-side validation helpers so ADS has a clear fail-closed input boundary.

## Current Contract Shape

The active contract already includes these top-level trace fields:

```text
renderSpecId
schemeId
homeId
floorplanRevisionId
sceneContractId
roomId
cameraId
geometryHash
layoutIntentHash optional
```

Do not add parallel revision id fields. If a future consumer needs extra context, pass it through a separate validation context rather than changing the frozen spec shape.

The active input asset field names are nested asset refs:

```text
inputs.controlRender.uri
inputs.depthMap.uri
inputs.semanticMask.uri
inputs.lineMap.uri
inputs.lockedGeometryMask.uri
inputs.anchorLayoutMask.uri
```

These names are canonical for this branch. Do not rename them to flat URL aliases in Batch 12.

## Required Invariants

- `geometryHash` must match the confirmed Space Truth geometry used by SchemeLite, camera references, and input assets.
- `homeId`, `floorplanRevisionId`, `sceneContractId`, `roomId`, and `cameraId` must match `trace`.
- Every input asset must be present and must carry the same `roomId` and `geometryHash` as the spec.
- All `hardConstraints` values must be `true`.
- `promptDirectives.forbiddenChanges` must include locks for walls, doors, windows, room proportion, floorplan changes, and anchor zone movement.
- Style and budget fields are pass-through render directives only.
- Provider and runtime code must treat the spec as readonly.

## ADS Rejection Conditions

ADS must reject the spec when:

- schema validation fails
- `geometryHash` is missing or mismatched against the render context
- `renderSpecId`, `roomId`, or `cameraId` is missing
- `homeId`, `floorplanRevisionId`, or `sceneContractId` mismatches the ADS freeze validation context
- any required input asset ref is missing
- any input asset `uri` is missing
- any input asset `roomId` or `geometryHash` mismatches the spec
- any hard constraint is not `true`
- required forbidden-change directives are missing

## Scope Lock

Batch 12 is producer-side only.

- Do not import ADS runtime packages.
- Do not add provider or network behavior.
- Do not add persistence or database writes.
- Do not add SKU, payment, PDF, DWG, DXF, export, construction, load-bearing, or GB compliance logic.
- Do not use provider output as new geometry truth.

## Encoding Guard

This document must remain readable in GitHub raw view with ordinary physical line breaks.

- Store the file as UTF-8 text without a byte order mark.
- Use ordinary LF or CRLF newline bytes only.
- Do not serialize this document as escaped newline text.
- Do not collapse this document into one physical line.
- Do not include zero-width, bidi, line-separator, paragraph-separator, or other format control characters.
- Keep headings, bullets, and code fences on separate physical lines.

## Versioning Policy

Any breaking change to `CreativeRenderSpec` requires a new reviewed batch and corresponding ADS consumer review.

Additive helper functions and docs are allowed only when they preserve the existing schema and do not create runtime or provider scope.
