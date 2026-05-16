import { buildV1BetaFixtureHarness } from "@homeai/v1-beta-fixtures";
import { V1BetaFixtureHarnessPayloadSchema } from "@homeai/contracts";

export async function GET() {
  if (isDevRouteDisabled()) {
    return notFoundResponse();
  }

  return Response.json(V1BetaFixtureHarnessPayloadSchema.parse(buildV1BetaFixtureHarness()));
}

function isDevRouteDisabled(): boolean {
  return process.env.NODE_ENV === "production" && process.env.ENABLE_DEV_ROUTES !== "true";
}

function notFoundResponse(): Response {
  return Response.json({ ok: false, error: "Not found" }, { status: 404 });
}
