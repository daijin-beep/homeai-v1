import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  RenderProviderPolicySchema,
  type RenderProviderPolicy
} from "../contracts/render-provider-policy.js";

const fixtureRoot = dirname(fileURLToPath(import.meta.url));
const POLICY_DIR = join(fixtureRoot, "policies");

export type RenderProviderPolicyFixtureName = "mock-allowed" | "blocked-default" | "real-provider-spike-template";

const KNOWN: ReadonlyArray<RenderProviderPolicyFixtureName> = [
  "mock-allowed",
  "blocked-default",
  "real-provider-spike-template"
];

export function loadRenderProviderPolicyFixture(name: RenderProviderPolicyFixtureName): RenderProviderPolicy {
  const text = readFileSync(join(POLICY_DIR, `${name}.json`), "utf8");
  const parsed: unknown = JSON.parse(text);
  return RenderProviderPolicySchema.parse(parsed);
}

export function listRenderProviderPolicyFixtures(): ReadonlyArray<RenderProviderPolicyFixtureName> {
  return KNOWN;
}
