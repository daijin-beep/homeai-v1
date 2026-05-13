---
name: space-truth-review
description: Use when implementing or reviewing floorplan parsing, canonical geometry, scene contracts, 3D white models, or any feature that touches space truth.
---

# Space Truth Review Skill

The invariant:

Confirmed floorplan geometry may only be created or changed by the Space Truth Engine through validated user correction or verified parser output.

## checks

1. Are coordinates validated?
2. Is scale confirmed or clearly marked as estimated?
3. Are rooms closed polygons?
4. Are walls, openings, and rooms topologically consistent?
5. Are low-confidence elements blocked or flagged?
6. Is Scene Contract generated from Canonical Floorplan JSON?
7. Can downstream modules mutate geometry? If yes, reject.
8. Can rendering add/delete walls/windows? If yes, reject.

## reject conditions

- LLM writes final geometry directly.
- Confirmed geometry is mutated outside Space Truth Engine.
- Scene or render modules rewrite walls, windows, doors, or room polygons.
- Canonical floorplan lacks user-confirmed scale.

## required output

- blocking issues
- warnings
- suggested verifier tests
