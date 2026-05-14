// @homeai/render-verifier — Track B-owned deterministic L1 render verifier.
//
// Per D-036, this package does NOT redefine canonical render contracts.
// All shared schemas come from @homeai/contracts; this package only adds
// the verification service that examines a RenderCandidate against its
// CreativeRenderSpec and emits a canonical RenderVerificationReport.

export {
  verifyRenderCandidate,
  type VerifyRenderCandidateInput
} from "./services/verify-render-candidate.js";

export {
  isNotEvaluable,
  runDeterministicChecks
} from "./checks/deterministic-checks.js";

export { RenderVerifierInputError } from "./errors/index.js";
