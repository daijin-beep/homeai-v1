# ADS Consumer Contract

## Boundary

Codex owns the producer-side canonical contracts and `CreativeRenderSpec` compiler. ADS owns runtime validation, provider gating, render verification, bakeoff, and human review runtime modules.

Batch 12 defines the handoff boundary only. Codex does not import ADS runtime packages and ADS must not write Space Truth.

## ADS Input

ADS receives `CreativeRenderSpec` as a readonly object. The spec is valid only when `validateCreativeRenderSpecForADS()` passes or ADS performs an equivalent fail-closed validation.

ADS should validate against the active contract shape:

- top-level trace fields already present on `CreativeRenderSpec`
- nested input asset refs under `inputs.*.uri`
- hard constraints locked true
- forbidden geometry-change directives present

```text
CreativeRenderSpec
validateCreativeRenderSpecForADS()
inputs.controlRender.uri
inputs.depthMap.uri
inputs.semanticMask.uri
inputs.lineMap.uri
inputs.lockedGeometryMask.uri
inputs.anchorLayoutMask.uri
```

## Required Context

ADS must compare each spec against the render context:

```text
homeId
floorplanRevisionId
sceneContractId
geometryHash
```

If those values do not match, ADS must reject the spec. ADS must not add fallback ids or infer missing geometry context from provider output.

## Readonly Rules

ADS may:

- parse the spec
- validate it
- create runtime jobs/candidates/reports in ADS-owned modules
- return validation or runtime status through shared contracts

ADS must not:

- mutate the spec
- mutate SceneContract or confirmed floorplan geometry
- change walls, doors, windows, room polygons, or camera ids
- admit failed renders into user-visible gallery state
- enable real providers without explicit provider gates

## Rejection Summary

Reject on schema failure, missing required input asset, missing trace ids, mismatched `geometryHash`, false hard constraints, missing forbidden-change directives, or any runtime attempt to use provider output as new geometry truth.
