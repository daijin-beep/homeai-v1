import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

describe("CreativeRenderSpec freeze documentation", () => {
  it("documents active input asset field names and ADS rejection conditions", () => {
    const doc = read("docs/render-pipeline/CREATIVE_RENDER_SPEC_FREEZE.md");

    expect(doc).toContain("inputs.controlRender.uri");
    expect(doc).toContain("inputs.depthMap.uri");
    expect(doc).toContain("inputs.semanticMask.uri");
    expect(doc).toContain("inputs.lineMap.uri");
    expect(doc).toContain("inputs.lockedGeometryMask.uri");
    expect(doc).toContain("inputs.anchorLayoutMask.uri");
    expect(doc).toContain("ADS must reject the spec");
    expect(doc).toContain("Do not add parallel revision id fields");
  });

  it("documents ADS consumer boundary and recovery PR gate", () => {
    const consumer = read("docs/ads-integration/ADS_CONSUMER_CONTRACT.md");
    const gate = read("docs/ads-integration/ADS_RECOVERY_PR_REVIEW_GATE.md");

    expect(consumer).toContain("Codex does not import ADS runtime packages");
    expect(consumer).toContain("validateCreativeRenderSpecForADS()");
    expect(gate).toContain("Old ADS PR #2 must be closed as superseded and must not be merged");
    expect(gate).toContain("ads/rebased-batch03-06-verifier-debug-bakeoff-gated-provider");
  });
});

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}
