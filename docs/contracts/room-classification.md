# Room Classification

Room classification constants live in `packages/contracts/src/room-classification.ts`.

## Groups

- `knownRoomTypes`: room types accepted from parser or user correction, excluding `unknown`.
- `mainRoomTypes`: rooms considered primary full-home spaces.
- `renderableRoomTypes`: room types that can receive render coverage after spatial validation.
- `softDecorTargetRoomTypes`: room types eligible for primary soft decor GPS.
- `nonPrimarySoftDecorTypes`: renderable rooms that are not primary soft decor targets.
- `userLabelRequiredTypes`: room types that require user confirmation before downstream use.

## Eligibility

`getRoomEligibility()` returns:

- `isSpatiallyValid`
- `isRenderable`
- `isSoftDecorTarget`
- `isMainRoom`
- `reason`

Rules:

- Unknown room type is not renderable until user confirmed.
- Room polygon must be closed.
- Room polygon must not self-intersect.
- Room area must be above minimum threshold.
- Storage and corridor may be renderable but are not primary soft decor targets.
- Small corridors may be merged into adjacent visual context in later tasks.
