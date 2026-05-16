import {
  buildV1BetaConversionDebugFixture,
  createPaymentStartedMockEvent
} from "@homeai/analytics";

export function GET() {
  if (isDevRouteDisabled()) {
    return Response.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  return Response.json(buildV1BetaConversionDebugFixture());
}

export async function POST(request: Request) {
  if (isDevRouteDisabled()) {
    return Response.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const fixture = buildV1BetaConversionDebugFixture();
    const event = createPaymentStartedMockEvent({
      ...(typeof body.eventId === "string" ? { eventId: body.eventId } : {}),
      anonymousSessionId: typeof body.anonymousSessionId === "string" ? body.anonymousSessionId : "session-v1-beta-dev",
      homeId: fixture.actionSet.homeId,
      schemeId: fixture.actionSet.schemeId,
      floorplanRevisionId: fixture.actionSet.floorplanRevisionId,
      sceneContractId: fixture.actionSet.sceneContractId,
      geometryHash: fixture.actionSet.geometryHash
    });

    return Response.json({ ok: true, event });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown conversion mock event error"
      },
      { status: 400 }
    );
  }
}

function isDevRouteDisabled(): boolean {
  return process.env.NODE_ENV === "production" && process.env.ENABLE_DEV_ROUTES !== "true";
}
