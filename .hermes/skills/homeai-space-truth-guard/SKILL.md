---
name: homeai-space-truth-guard
description: Use for every homeAI code review or merge gate that could affect floorplans, geometry, SceneContract, render verification, room coverage, or provider outputs.
---

# homeAI Space Truth Guard

## Purpose

Prevent any agent or provider from corrupting homeAI Space Truth.

## Check

Reject if any change:

- Mutates confirmed geometry downstream.
- Allows render output to update walls, doors, windows, room polygons, geometryHash, CanonicalFloorplan, or SceneContract.
- Lets LLM write final coordinates.
- Bypasses schema validation.
- Duplicates canonical schemas.
- Removes every-valid-room coverage.
- Allows failed renders into user gallery.
- Adds PDF export, contractor collaboration, or construction-ready material list to V1.

## Required output

```md
## Space Truth Guard Result
pass / fail

## Findings
- ...

## Red-zone diff
...

## Required action
merge allowed / block merge / escalate to GPT gate
```
