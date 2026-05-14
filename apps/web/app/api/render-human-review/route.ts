import { buildRuntimeSnapshot } from "@homeai/ads-runtime";
import type { RenderLifecycleScenario } from "@homeai/render-pipeline";

const SCENARIOS: ReadonlyArray<RenderLifecycleScenario> = [
  "all_pass",
  "one_window_missing_fail",
  "one_door_blocked_fail",
  "one_anchor_zone_warning",
  "one_geometry_hash_mismatch_fail",
  "one_missing_asset_fail"
];

function pickScenario(raw: string | null): RenderLifecycleScenario {
  if (raw !== null && (SCENARIOS as ReadonlyArray<string>).includes(raw)) {
    return raw as RenderLifecycleScenario;
  }
  return "all_pass";
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const scenario = pickScenario(url.searchParams.get("scenario"));
  const { snapshot } = buildRuntimeSnapshot({ scenario });
  return Response.json({
    scenario,
    items: snapshot.humanReviewItems
  });
}
