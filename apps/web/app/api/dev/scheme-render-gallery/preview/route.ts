import {
  SchemeRenderGalleryScenarios,
  buildSchemeRenderGalleryDebugFixture,
  type RenderLifecycleScenario
} from "@homeai/render-pipeline";

export async function GET(request: Request): Promise<Response> {
  if (isDevRouteDisabledInProduction()) {
    return new Response(null, { status: 404 });
  }

  try {
    const scenario = scenarioFromRequest(request);
    const debug = buildSchemeRenderGalleryDebugFixture(scenario);
    return Response.json({
      inputSummary: debug.inputSummary,
      renderJob: debug.renderJob,
      candidates: debug.candidates,
      verificationReports: debug.verificationReports,
      galleryEligibility: debug.galleryEligibility,
      galleryViewModel: debug.galleryViewModel,
      scopeGuard: debug.scopeGuard
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown scheme render gallery preview error"
      },
      { status: 400 }
    );
  }
}

function scenarioFromRequest(request: Request): RenderLifecycleScenario {
  const url = new URL(request.url);
  const rawScenario = url.searchParams.get("scenario") ?? "all_pass";
  if (!SchemeRenderGalleryScenarios.includes(rawScenario as RenderLifecycleScenario)) {
    throw new Error(`Unsupported scheme render gallery scenario: ${rawScenario}`);
  }
  return rawScenario as RenderLifecycleScenario;
}

function isDevRouteDisabledInProduction(): boolean {
  return process.env.NODE_ENV === "production" && process.env.ENABLE_DEV_ROUTES !== "true";
}
