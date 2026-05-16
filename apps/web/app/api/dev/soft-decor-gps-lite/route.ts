import { createSchemePageFixtureContract } from "@homeai/scheme-page";
import { buildSoftDecorGpsLitePlan, buildVerifiedSkuDebugFixture } from "@homeai/soft-decor-gps";

export function GET() {
  if (isDevRouteDisabled()) {
    return Response.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const scheme = createSchemePageFixtureContract({ withLayoutIntent: true, withWarnings: true });
  const catalog = buildVerifiedSkuDebugFixture();

  return Response.json({
    ok: true,
    plan: buildSoftDecorGpsLitePlan({ scheme, catalog })
  });
}

function isDevRouteDisabled(): boolean {
  return process.env.NODE_ENV === "production" && process.env.ENABLE_DEV_ROUTES !== "true";
}
