import type { SchemeRenderGalleryViewModel } from "@homeai/contracts";
import {
  buildRenderLifecycleDebugFixture,
  type RenderLifecycleScenario
} from "./fixtures.js";
import { buildSchemeRenderGalleryViewModel } from "./scheme-render-gallery-view-model.js";

export const SchemeRenderGalleryScenarios = [
  "all_pass",
  "one_window_missing_fail",
  "one_door_blocked_fail",
  "one_anchor_zone_warning",
  "one_geometry_hash_mismatch_fail",
  "one_missing_asset_fail",
  "missing_room_coverage"
] as const satisfies readonly RenderLifecycleScenario[];

export interface SchemeRenderGalleryDebugFixture extends ReturnType<typeof buildRenderLifecycleDebugFixture> {
  inputSummary: {
    homeId: string;
    schemeId: string;
    floorplanRevisionId: string;
    sceneContractId: string;
    geometryHash: string;
    validRoomCount: number;
    renderJobRoomCount: number;
    eligibleCandidateCount: number;
    blockedCandidateCount: number;
    warningCandidateCount: number;
  };
  galleryViewModel: SchemeRenderGalleryViewModel;
  scopeGuard: {
    networkCalls: false;
    realImageProviderUsed: false;
    skuUsed: false;
    paymentUsed: false;
    pdfUsed: false;
    constructionScopeUsed: false;
  };
}

export function buildSchemeRenderGalleryDebugFixture(
  scenario: RenderLifecycleScenario = "all_pass"
): SchemeRenderGalleryDebugFixture {
  const lifecycle = buildRenderLifecycleDebugFixture(scenario);
  const galleryViewModel = buildSchemeRenderGalleryViewModel({
    schemeLiteContract: lifecycle.schemeLiteContract,
    sceneContract: lifecycle.sceneContract,
    renderJob: lifecycle.renderJob,
    candidates: lifecycle.candidates,
    verificationReports: lifecycle.verificationReports,
    galleryEligibility: lifecycle.galleryEligibility
  });

  return {
    ...lifecycle,
    inputSummary: {
      homeId: lifecycle.schemeLiteContract.homeId,
      schemeId: lifecycle.schemeLiteContract.schemeId,
      floorplanRevisionId: lifecycle.schemeLiteContract.floorplanRevisionId,
      sceneContractId: lifecycle.sceneContract.sceneContractId,
      geometryHash: lifecycle.sceneContract.geometryHash,
      validRoomCount: lifecycle.sceneContract.rooms.length,
      renderJobRoomCount: lifecycle.renderJob.roomJobs.length,
      eligibleCandidateCount: galleryViewModel.summary.eligibleCandidateCount,
      blockedCandidateCount: galleryViewModel.summary.blockedCandidateCount,
      warningCandidateCount: galleryViewModel.summary.warningCandidateCount
    },
    galleryViewModel,
    scopeGuard: {
      networkCalls: false,
      realImageProviderUsed: false,
      skuUsed: false,
      paymentUsed: false,
      pdfUsed: false,
      constructionScopeUsed: false
    }
  };
}
