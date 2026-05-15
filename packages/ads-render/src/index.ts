export {
  AdsInterfaceGatesSchema,
  CreativeRenderSpecStatusSchema,
  GalleryAdmissionPolicyStatusSchema,
  ProviderPolicyStatusSchema,
  type AdsInterfaceGates
} from "./contracts/ads-interface-gates.js";

export {
  AdsConsumerSpecInputsSchema,
  BudgetProfileLiteSchema,
  CreativeRenderSpecConsumerSchema,
  CreativeRenderSpecHardConstraintsSchema,
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
