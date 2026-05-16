import { buildVerifiedSkuDebugFixture } from "@homeai/soft-decor-gps";

export function GET() {
  if (isDevRouteDisabled()) {
    return Response.json(
      { ok: false, error: "Not found" },
      { status: 404 },
    );
  }

  return Response.json({
    ok: true,
    catalog: buildVerifiedSkuDebugFixture(),
  });
}

function isDevRouteDisabled(): boolean {
  return (
    process.env.NODE_ENV === "production" &&
    process.env.ENABLE_DEV_ROUTES !== "true"
  );
}
