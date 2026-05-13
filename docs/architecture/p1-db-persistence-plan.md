# P1 DB Persistence Plan

Date: 2026-05-13

Scope: concrete persistence plan for P1 repositories. This is planning only; it does not implement production database storage, auth, or migrations.

## Repository Mapping

| Repository interface | Table / collection |
|---|---|
| `FloorplanDraftRepository` | `floorplan_draft_revisions`, `floorplan_draft_operations` |
| `CanonicalFloorplanRepository` | `canonical_floorplan_revisions`, plus active pointer by `homeId` |
| `SceneContractRepository` | `scene_contracts`, plus active pointer by `homeId` |
| `GeometryDependencyRepository` | `geometry_dependent_artifacts` |
| `P1EventRepository` | `p1_events` |
| `LayoutIntentRepository` | `layout_intent_revisions`, `layout_intent_placeholders`, `layout_intent_operations`, `layout_intent_contracts` |
| `LayoutIntentEventRepository` | `layout_intent_events` |

## Proposed Tables

### `floorplan_draft_revisions`

- `draftRevisionId` primary key
- `homeId` indexed
- `sourceAssetId`
- `baseCanonicalRevisionId` indexed when present
- `source`
- `unit`
- `wallsJson`
- `openingsJson`
- `roomsJson`
- `globalParamsJson`
- `validationJson`
- `createdAt`
- `updatedAt`

### `floorplan_draft_operations`

- `operationId` primary key
- `draftRevisionId` indexed
- `homeId` indexed
- `operationType` indexed
- `targetType`
- `targetId`
- `actor`
- `payloadJson`
- `createdAt` indexed

### `canonical_floorplan_revisions`

- `canonicalRevisionId` primary key
- `homeId` indexed
- `draftRevisionId` indexed
- `baseCanonicalRevisionId`
- `version`
- `unit`
- `geometryHash` indexed
- `wallsJson`
- `openingsJson`
- `roomsJson`
- `globalParamsJson`
- `validationJson`
- `confirmedByUser`
- `confirmedAt`
- `createdAt`
- `updatedAt`
- `isActiveForHome`

### `scene_contracts`

- `sceneContractId` primary key
- `homeId` indexed
- `canonicalRevisionId` indexed
- `geometryHash` indexed
- `version`
- `readonly`
- `roomsJson`
- `wallsJson`
- `openingsJson`
- `validationJson`
- `createdAt`
- `isActiveForHome`
- `archivedAt`

### `geometry_dependent_artifacts`

- `dependencyId` primary key
- `artifactId` indexed
- `artifactType` indexed
- `homeId` indexed
- `canonicalRevisionId` indexed
- `geometryHash` indexed
- `status`
- `active`
- `createdAt` indexed
- `invalidatedAt`
- `archivedAt`

### `p1_events`

- `eventId` primary key
- `eventType` indexed
- `homeId` indexed
- `userId`
- `anonymousSessionId`
- `draftRevisionId` indexed
- `canonicalRevisionId` indexed when present
- `geometryHash` indexed when present
- `previousGeometryHash`
- `newGeometryHash`
- `operationType`
- `timestamp` indexed
- `source`

### `layout_intent_revisions`

- `layoutIntentRevisionId` primary key
- `homeId` indexed
- `canonicalRevisionId` indexed
- `sceneContractId` indexed
- `geometryHash` indexed
- `layoutIntentHash` indexed
- `revision`
- `source`
- `aiAutofillEnabled`
- `validationJson`
- `status`
- `createdAt` indexed
- `updatedAt`
- `archivedAt`
- `isActiveForHome`

### `layout_intent_placeholders`

- `placeholderId` primary key
- `layoutIntentRevisionId` indexed
- `homeId` indexed
- `canonicalRevisionId` indexed
- `sceneContractId` indexed
- `geometryHash` indexed
- `layoutIntentHash` indexed
- `roomId` indexed
- `category`
- `centerJson`
- `rotationDeg`
- `displaySizeMmJson`
- `sizeSource`
- `userResizable`
- `source`
- `label`
- `createdAt` indexed
- `updatedAt`

### `layout_intent_operations`

- `operationId` primary key
- `layoutIntentRevisionId` indexed
- `homeId` indexed
- `canonicalRevisionId` indexed
- `sceneContractId` indexed
- `geometryHash` indexed
- `layoutIntentHash` indexed when present
- `operationType` indexed
- `placeholderId` indexed when present
- `actor`
- `payloadJson`
- `createdAt` indexed

### `layout_intent_contracts`

- `layoutIntentContractId` primary key
- `layoutIntentRevisionId` indexed
- `homeId` indexed
- `canonicalRevisionId` indexed
- `sceneContractId` indexed
- `geometryHash` indexed
- `layoutIntentHash` indexed
- `aiAutofillEnabled`
- `constraintsJson`
- `placeholdersJson`
- `readonly`
- `status`
- `createdAt` indexed
- `archivedAt`

### `layout_intent_events`

- `eventId` primary key
- `eventType` indexed
- `homeId` indexed
- `userId`
- `anonymousSessionId`
- `canonicalRevisionId` indexed
- `sceneContractId` indexed
- `geometryHash` indexed
- `layoutIntentRevisionId` indexed
- `layoutIntentHash` indexed when present
- `placeholderId` indexed when present
- `timestamp` indexed
- `source`

## Immutability Strategy

Canonical floorplan revisions are append-only. Updates to canonical geometry must create a new `canonicalRevisionId`; database permissions and service code should reject `UPDATE` on canonical geometry JSON columns after insert. The active home pointer is represented by `isActiveForHome` or a separate active pointer table, not by mutating prior revision geometry.

SceneContract v0.2 is also append-only and must store `readonly = true`. Archiving a scene contract sets `archivedAt` and clears the active pointer; it does not rewrite the scene geometry payload.

Geometry-dependent artifacts are invalidated by status changes on dependency records. Their payloads are not deleted or rewritten during invalidation.

Layout intent revisions are separate from canonical geometry. Furniture placeholders are user preference data and must never be embedded into `canonical_floorplan_revisions` or `scene_contracts`. A layout-only change creates or updates `layoutIntentHash` while preserving `geometryHash`; a geometry change may archive active layout intent when room IDs or polygons no longer match.

## Transaction Boundaries

Applying operations:

1. Insert operation row.
2. Read latest draft.
3. Apply operation through the P1 draft service.
4. Update draft revision JSON and validation state.
5. Emit operation event.

Confirming draft:

1. Read draft and operations.
2. Validate draft.
3. If invalid, return validation and commit no canonical changes.
4. Insert immutable canonical revision with deterministic `geometryHash`.
5. Set active canonical pointer for `homeId`.
6. Insert readonly SceneContract v0.2.
7. Set active SceneContract pointer.
8. Invalidate geometry-dependent artifacts if hash changed.
9. Insert confirm event.

The confirm flow should run in one transaction where supported. If an event bus is added later, event publication should use an outbox table inside the same transaction.

Creating a layout intent session:

1. Read active canonical revision and active SceneContract for `homeId`.
2. If active layout intent exists for `canonicalRevisionId`, return it.
3. Otherwise insert `layout_intent_revisions` with empty placeholders, `aiAutofillEnabled`, and deterministic `layoutIntentHash`.
4. Set active layout pointer by `homeId` and `canonicalRevisionId`.
5. Insert `layout_intent_events` with `layout_intent_session_started`.

Applying a layout operation:

1. Insert `layout_intent_operations`.
2. Read active layout intent revision.
3. Apply only placeholder / `aiAutofillEnabled` mutation.
4. Recompute `layoutIntentHash`.
5. Validate against SceneContract room IDs and geometry.
6. Update layout intent revision JSON and placeholder rows.
7. Insert corresponding layout intent event.

Validating layout intent:

1. Read layout intent revision and matching SceneContract.
2. Validate room references, polygon containment, display-size bounds, and simple clearance warnings.
3. Update validation JSON only.
4. Insert `layout_intent_validated` event.

Confirming layout intent:

1. Validate layout intent.
2. If any blocking error exists, return validation and do not create a contract.
3. Insert readonly `layout_intent_contracts` with `layoutIntentHash`, `geometryHash`, and non-mutation constraints.
4. Insert `layout_intent_confirmed` event.

Invalidating layout-dependent artifacts:

1. Compare previous and new `layoutIntentHash`.
2. If unchanged, preserve all artifacts.
3. If changed, invalidate placeholder-dependent artifacts such as `AnchorPlan`, `SchemeLiteContract`, render candidates, and SKU-fit results.
4. Preserve `canonical_floorplan_revisions`, `scene_contracts`, white models, camera plans, and base affordance graphs for layout-only changes.
5. If `geometryHash` changes, revalidate active layout intent against new room IDs and polygons before reuse.

## Migration Plan

Initial implementation can keep `walls`, `openings`, `rooms`, validation, and global params as JSON blobs because P1 operations already validate through shared schemas. Normalize later only when query needs are proven.

Indexes required immediately:

- `homeId`
- `draftRevisionId`
- `canonicalRevisionId`
- `geometryHash`
- `sceneContractId`
- `eventType`
- `createdAt`

Layout intent indexes required immediately:

- `homeId`
- `canonicalRevisionId`
- `sceneContractId`
- `geometryHash`
- `layoutIntentRevisionId`
- `layoutIntentHash`
- `eventType`
- `createdAt`

Normalize later:

- Wall/opening/room rows for analytics or collaborative editing.
- Operation payload projections by operation type.
- Geometry dependency metadata if downstream artifact tables become first-class.

## Auth / Session Notes

P1 currently supports `anonymousSessionId`; production must support `userId` and enforce home ownership checks on every API route. The debug endpoint must be restricted before production and should never be linked from production navigation. Anonymous sessions may create drafts, but confirmed revisions should be associated with either a user account or a controlled anonymous home session.
