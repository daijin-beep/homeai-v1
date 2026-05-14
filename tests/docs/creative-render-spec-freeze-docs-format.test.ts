import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const docs = [
  "docs/render-pipeline/CREATIVE_RENDER_SPEC_FREEZE.md",
  "docs/ads-integration/ADS_CONSUMER_CONTRACT.md",
  "docs/ads-integration/ADS_RECOVERY_PR_REVIEW_GATE.md"
];

const carriageReturn = String.fromCharCode(13);
const newline = String.fromCharCode(10);
const escapedNewline = "\\" + "n";

describe("Batch 12 docs markdown formatting", () => {
  it.each(docs)("%s has readable markdown structure", (path) => {
    const text = readFileSync(path, "utf8");
    const lines = text.replaceAll(carriageReturn, "").split(newline);
    const sectionHeadings = lines.filter((line) => /^## [^#].+/.test(line));
    const headingLines = lines.filter((line) => /^#{1,6} /.test(line));
    const codeFenceLines = lines.filter((line) => line.startsWith("```"));

    expect(lines.length).toBeGreaterThan(20);
    expect(text).toMatch(/^# .+/m);
    expect(sectionHeadings.length).toBeGreaterThanOrEqual(3);
    expect(text).not.toContain(escapedNewline);

    for (const line of headingLines) {
      const headingText = line.replace(/^#{1,6} /, "");
      expect(headingText).not.toMatch(/(^|\s)#{1,6}\s/);
    }

    for (const line of codeFenceLines) {
      expect(line).toMatch(/^```(?:[A-Za-z0-9_-]+)?$/);
    }
  });
});
