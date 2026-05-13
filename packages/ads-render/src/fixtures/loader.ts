import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { AdsInterfaceGatesSchema, type AdsInterfaceGates } from "../contracts/ads-interface-gates.js";

const fixtureRoot = dirname(fileURLToPath(import.meta.url));
const SPEC_FIXTURE_DIR = join(fixtureRoot, "creative-render-spec");

export function loadAdsInterfaceGates(): AdsInterfaceGates {
  const text = readFileSync(join(fixtureRoot, "ads-interface-gates.json"), "utf8");
  const parsed: unknown = JSON.parse(text);
  return AdsInterfaceGatesSchema.parse(parsed);
}

export type CreativeRenderSpecFixtureName =
  | "valid"
  | "missing-geometry-hash"
  | "missing-control-assets"
  | "invalid-hard-constraints"
  | "geometry-mutation-attempt"
  | "missing-style"
  | "missing-budget";

const KNOWN_SPEC_FIXTURES: ReadonlyArray<CreativeRenderSpecFixtureName> = [
  "valid",
  "missing-geometry-hash",
  "missing-control-assets",
  "invalid-hard-constraints",
  "geometry-mutation-attempt",
  "missing-style",
  "missing-budget"
];

/**
 * Returns the raw fixture as `unknown` because the fixture set intentionally
 * includes invalid specs. ADS callers must run `validateCreativeRenderSpecForADS`
 * before consuming.
 */
export function loadCreativeRenderSpecFixture(name: CreativeRenderSpecFixtureName): unknown {
  const text = readFileSync(join(SPEC_FIXTURE_DIR, `${name}.json`), "utf8");
  return JSON.parse(text);
}

export function listCreativeRenderSpecFixtures(): CreativeRenderSpecFixtureName[] {
  const onDisk = readdirSync(SPEC_FIXTURE_DIR)
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.replace(/\.json$/, ""));
  // Filter to the known typed union so callers get type-safe names.
  return KNOWN_SPEC_FIXTURES.filter((name) => onDisk.includes(name));
}
