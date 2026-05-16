# CreativeRenderSpec ADS Dispatch Payload

## Purpose

Batch 16 defines the producer-side dispatch payload that Codex can hand to ADS
after compiling full-space `CreativeRenderSpec` coverage.

This is not an ADS runtime API and does not call Track B services. It is a
canonical, schema-validated payload that packages specs, room coverage, and
typed room readiness statuses for later ADS consumption.

## Inputs

The producer reads only canonical, readonly inputs:

```text
SchemeLiteContract
SceneContract v0.2
P1RoomCameraPlanBatch
CreativeRenderAssetRef[]
```

The producer must not mutate any upstream input. It must not write Space Truth,
change `geometryHash`, or infer missing geometry from render output.

## Output Shape

The payload is validated by `CreativeRenderSpecDispatchPayloadSchema`.

```text
dispatchId
schemeId
homeId
floorplanRevisionId
sceneContractId
geometryHash
layoutIntentHash optional
status
specs
rooms
coverage
trace
createdAt
```

`specs` contains only canonical `CreativeRenderSpec` objects that already pass
producer validation. `coverage` contains the canonical full-space compiler
summary for every SceneContract room.

## Room Dispatch Status

Every valid SceneContract room appears in `rooms` with one status:

```text
ready
render_asset_pending
render_ineligible
```

- `ready` means the room has at least one valid `CreativeRenderSpec`.
- `render_asset_pending` means the producer lacks required control assets.
- `render_ineligible` means the room cannot be dispatched by current producer
  policy or has a blocking trace/camera/spec issue.

The producer must not silently drop rooms or emit a key-room-only payload.

## ADS Boundary

ADS may consume and validate this payload after the Track B recovery branch
lands. Before PR #10 lands, Codex must use deterministic fixtures and this
canonical payload only; it must not call `/api/render-snapshot` or
`/api/render-human-review`.

ADS remains responsible for runtime orchestration, provider gating, render
verification, human review, and bakeoff. Codex must not implement those systems
in this producer package.

## Failure Rules

- Missing required assets produce `render_asset_pending`.
- Non-renderable producer-policy rooms produce `render_ineligible`.
- Trace or `geometryHash` mismatch emits no valid specs.
- All issues are explicit in `coverage` and `rooms.issueIds`.
- `networkCalls` remains `false`.

No real provider, external network call, provider SDK, secret, PDF export, or
construction workflow is part of this payload.
