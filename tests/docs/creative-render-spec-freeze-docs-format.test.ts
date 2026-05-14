import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const docs = [
  "docs/render-pipeline/CREATIVE_RENDER_SPEC_FREEZE.md",
  "docs/ads-integration/ADS_CONSUMER_CONTRACT.md",
  "docs/ads-integration/ADS_RECOVERY_PR_REVIEW_GATE.md"
];

describe("Batch 12 docs markdown formatting", () => {
  it.each(docs)("%s has readable markdown structure", (path) => {
    const text = readFileSync(path, "utf8");
    const lines = text.split(/\r?\n/);

    expect(lines.length).toBeGreaterThan(20);
    expect(text).toMatch(/^# .+/m);
    expect(text).toMatch(/^## .+/m);
    expect(text).not.toMatch(/^# .*## /m);
    expect(text).not.toMatch(/^## .* - /m);
    expect(text).not.toMatch(/```text [^\n]+/);
  });
});
