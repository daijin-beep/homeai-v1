# Error Codes

Error definitions live in `packages/contracts/src/errors.ts`.

Each definition includes:

- `code`
- `module`
- `severity`
- `blocking`
- `userFixable`
- `defaultMessage`

Severity values:

- `info`
- `warning`
- `error`
- `critical`

## Upload

- `UPLOAD_UNSUPPORTED_FORMAT`
- `UPLOAD_TOO_LARGE`
- `IMAGE_TOO_LOW_RESOLUTION`

## Parse

- `PARSE_PROVIDER_TIMEOUT`
- `PARSE_PROVIDER_MALFORMED_OUTPUT`

## Space Truth

- `SCALE_UNKNOWN`
- `LOW_CONFIDENCE_ROOM_BOUNDARY`
- `TOPOLOGY_INVALID`
- `OPENING_UNCONFIRMED`
- `SPACE_TRUTH_SCORE_TOO_LOW`

## Scene

- `SCENE_CONTRACT_INVALID`

## Camera

- `CAMERA_PLAN_FAILED`
- `CAMERA_INTERSECTS_WALL`

## Render

- `RENDER_PROVIDER_FAILED`
- `RENDER_CONSTRAINT_VIOLATION`
- `ROOM_RENDER_INCOMPLETE`

## SKU

- `SKU_SIZE_MISMATCH`
- `SKU_PROVIDER_EMPTY`

## Lead

- `LEAD_EVENT_INVALID`
- `PII_CAPTURE_BLOCKED`
