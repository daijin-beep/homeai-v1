export {
  AdsInterfaceGatesSchema,
  CreativeRenderSpecStatusSchema,
  GalleryAdmissionPolicyStatusSchema,
  ProviderPolicyStatusSchema,
  type AdsInterfaceGates
} from "./contracts/ads-interface-gates.js";

export {
  BudgetProfileLiteSchema,
  CreativeRenderSpecConsumerSchema,
  CreativeRenderSpecHardConstraintsSchema,
  CreativeRenderSpecInputsSchema,
  StylePacketLiteSchema,
  type BudgetProfileLite,
  type CreativeRenderSpecConsumer,
  type CreativeRenderSpecConsumerInput,
  type StylePacketLite
} from "./contracts/creative-render-spec-consumer.js";

export {
  validateCreativeRenderSpecForADS,
  type AdsRenderInputValidationResult
} from "./validation/validate-creative-render-spec-for-ads.js";

export {
  AdsSpecValidationError,
  type AdsSpecValidationIssue
} from "./errors/spec-validation-errors.js";

export {
  loadAdsInterfaceGates,
  loadCreativeRenderSpecFixture,
  listCreativeRenderSpecFixtures,
  type CreativeRenderSpecFixtureName
} from "./fixtures/loader.js";

export {
  GalleryAdmissionStatusSchema,
  HumanReviewDecisionSchema,
  HumanReviewDecisionTypeSchema,
  RenderGalleryItemSchema,
  type GalleryAdmissionStatus,
  type HumanReviewDecision,
  type HumanReviewDecisionType,
  type RenderGalleryItem
} from "./contracts/gallery-admission.js";
