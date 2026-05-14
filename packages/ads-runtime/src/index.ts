// @homeai/ads-runtime — Track B-owned ADS runtime surface.
//
// Per D-036, this package contains:
//   - Image adapter interface + mock/stub adapters
//   - Package-local provider policy (RenderProviderPolicy is runtime
//     configuration, NOT a cross-module canonical contract)
//   - Repositories + factories typed against canonical RenderJob /
//     RenderCandidate / RenderVerificationReport
//   - Human review queue
//   - Bakeoff harness
//   - Gated real provider scaffold
//
// This package never redefines RenderJob, RenderCandidate,
// RenderVerificationReport, RenderTrace, GalleryEligibilityDecision,
// or CreativeRenderSpec. All those come from @homeai/contracts.
//
// Real implementation lands in commits 4-6 (Batches 04-06).
export {};
