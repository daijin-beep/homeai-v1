import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { AdsInterfaceGatesSchema, type AdsInterfaceGates } from "../contracts/ads-interface-gates.js";

const fixtureRoot = dirname(fileURLToPath(import.meta.url));

export function loadAdsInterfaceGates(): AdsInterfaceGates {
  const text = readFileSync(join(fixtureRoot, "ads-interface-gates.json"), "utf8");
  const parsed: unknown = JSON.parse(text);
  return AdsInterfaceGatesSchema.parse(parsed);
}
