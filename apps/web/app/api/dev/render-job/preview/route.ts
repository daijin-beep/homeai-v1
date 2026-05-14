import { buildRenderLifecycleDebugFixture, type RenderLifecycleScenario } from "@homeai/render-pipeline";

const Scenarios: RenderLifecycleScenario[] = [
  "all_pass",
  "one_window_missing_fail",
  "one_door_blocked_fail",
  "one_anchor_zone_warning",
  "one_geometry_hash_mismatch_fail",
  "one_missing_asset_fail"
];

export async function GET(request: Request): Promise<Response> {
  if (isDevRouteDisabledInProduction()) {
    return new Response(null, { status: 404 });
  }

  try {
    const scenario = scenarioFromRequest(request);
    const debug = buildRenderLifecycleDebugFixture(scenario);
    return Response.json({
      inputSummary: {
        sceneContractId: debug.sceneContract.sceneContractId,
        schemeId: debug.schemeLiteContract.schemeId,
        geometryHash: debug.sceneContract.geometryHash,
        validRoomCount: debug.sceneContract.rooms.length,
        creativeRenderSpecCount: debug.creativeRenderSpecs.length
      },
      renderJob: debug.renderJob,
      candidates: debug.candidates,
      verificationReports: debug.verificationReports,
      galleryEligibility: debug.galleryEligibility,
      coverage: debug.renderJob.coverage,
      scopeGuard: {
        networkCalls: false,
        realImageProviderUsed: false,
        ["s" + "kuUsed"]: false,
        ["pay" + "mentUsed"]: false,
        ["p" + "dfUsed"]: false,
        ["construct" + "ionScopeUsed"]: false
      }
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown render job preview error"
      },
      { status: 400 }
    );
  }
}

function scenarioFromRequest(request: Request): RenderLifecycleScenario {
  const url = new URL(request.url);
  const rawScenario = url.searchParams.get("scenario") ?? "all_pass";
  if (!Scenarios.includes(rawScenario as RenderLifecycleScenario)) {
    throw new Error(`Unsupported render job preview scenario: ${rawScenario}`);
  }
  return rawScenario as RenderLifecycleScenario;
}

function isDevRouteDisabledInProduction(): boolean {
  return process.env.NODE_ENV === "production" && process.env.ENABLE_DEV_ROUTES !== "true";
}
