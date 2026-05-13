# Mock Provider Contracts

M0 defines deterministic provider contracts only. It does not implement real provider calls.

## MockFloorplanProvider

Inputs:

- `projectId`
- `fileAssetId`
- `mockFixtureId`

Allowed fixture IDs:

- `fixture_one_bedroom`
- `fixture_two_bedroom`
- `fixture_three_bedroom_balcony`
- `fixture_malformed_provider_output`
- `fixture_low_confidence_boundaries`

Outputs:

- `rawOutput`
- `DraftFloorplan`
- `confidence`
- `warnings`

Rules:

- The same fixture ID must always produce the same DraftFloorplan.
- Raw output must be persisted as a `provider_raw_output` FileAsset in future tasks.
- The malformed fixture must fail schema validation.

## MockRenderProvider

Inputs:

- `RenderImageSpec`
- `SceneContract`
- `RoomCamera`

Output:

- RenderImageAsset-compatible asset metadata.

Rules:

- Generate deterministic SVG or PNG placeholder output.
- Include visible `roomId`, room label, `cameraId`, `viewType`, `styleProfileId`, and `renderSpecId`.
- Do not use stock images.
- Do not call real image models.
- Do not mutate canonical geometry or scene geometry.

## MockSKUProvider

Inputs:

- `category`
- `styleKeywords`
- `sizeConstraint`
- `budgetBand`

Output:

- `ProductCandidate[]`

Catalog requirements:

- Minimum 60 products, recommended 100.
- Cover all V1 soft decor categories.
- Include price, dimensions, placeholder image URL, provider, style tags, budget band, and availability.

Required categories:

- `sofa`
- `coffee_table`
- `tv_cabinet`
- `dining_table`
- `dining_chair`
- `bed`
- `wardrobe`
- `desk`
- `chair`
- `curtain`
- `rug`
- `lamp`
- `storage_cabinet`
- `mirror`
- `decor`

## MockAffiliateProvider

Inputs:

- `productId`
- `projectId`
- optional `roomId`
- `source`

Output:

- `leadUrl`
- `trackingId`

Rules:

- `leadUrl` may use `provider://mock-affiliate/{trackingId}`.
- M0 must not use real affiliate links.
