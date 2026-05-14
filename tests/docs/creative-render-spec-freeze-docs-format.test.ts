import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const files = [
  "docs/render-pipeline/CREATIVE_RENDER_SPEC_FREEZE.md",
  "docs/ads-integration/ADS_CONSUMER_CONTRACT.md",
  "docs/ads-integration/ADS_RECOVERY_PR_REVIEW_GATE.md",
  "tests/docs/creative-render-spec-freeze-docs-format.test.ts"
];

const docs = files.filter((path) => path.endsWith(".md"));

const byteOrderMark = [0xef, 0xbb, 0xbf];
const lineFeedByte = 0x0a;
const carriageReturn = String.fromCharCode(13);
const lineFeed = String.fromCharCode(10);
const escapedNewline = String.fromCharCode(92) + "n";
const formatCategory = /^\p{Cf}$/u;
const lineSeparatorCategory = /^\p{Zl}$/u;
const paragraphSeparatorCategory = /^\p{Zp}$/u;
const forbiddenCodePoints = new Set([
  0x200b,
  0x200e,
  0x200f,
  0x2028,
  0x2029,
  0x202a,
  0x202b,
  0x202c,
  0x202d,
  0x202e,
  0x2066,
  0x2067,
  0x2068,
  0x2069,
  0xfeff
]);

describe("Batch 12 docs markdown formatting", () => {
  it.each(files)("%s has physical line breaks and no hidden Unicode", (path) => {
    const bytes = readFileSync(path);
    const text = bytes.toString("utf8");
    const physicalLfCount = countByte(bytes, lineFeedByte);
    const hiddenCharacters = findHiddenCharacters(text);

    expect(Array.from(bytes.subarray(0, 3))).not.toEqual(byteOrderMark);
    expect(text).not.toContain(escapedNewline);
    expect(hiddenCharacters).toEqual([]);

    if (path.endsWith(".md")) {
      expect(physicalLfCount).toBeGreaterThan(30);
    } else {
      expect(physicalLfCount).toBeGreaterThan(25);
    }
  });

  it.each(docs)("%s has readable markdown structure", (path) => {
    const bytes = readFileSync(path);
    const text = bytes.toString("utf8");
    const lines = text.replaceAll(carriageReturn, "").split(lineFeed);
    const sectionHeadings = lines.filter((line) => /^## [^#].+/.test(line));
    const headingLines = lines.filter((line) => /^#{1,6} /.test(line));
    const codeFenceLines = lines.filter((line) => line.startsWith("```"));

    expect(lines.length).toBeGreaterThan(20);
    expect(text).toMatch(/^# .+/m);
    expect(sectionHeadings.length).toBeGreaterThanOrEqual(3);
    expect(codeFenceLines.length).toBeGreaterThanOrEqual(2);

    for (const line of headingLines) {
      const headingText = line.replace(/^#{1,6} /, "");
      expect(headingText).not.toMatch(/(^|\s)#{1,6}\s/);
    }

    for (const line of codeFenceLines) {
      expect(line).toMatch(/^```(?:[A-Za-z0-9_-]+)?$/);
    }
  });
});

function countByte(bytes: Buffer, expected: number): number {
  let count = 0;

  for (const byte of bytes) {
    if (byte === expected) {
      count += 1;
    }
  }

  return count;
}

function findHiddenCharacters(text: string): string[] {
  const hidden: string[] = [];
  let index = 0;

  for (const character of text) {
    const codePoint = character.codePointAt(0);

    if (codePoint === undefined) {
      index += 1;
      continue;
    }

    if (
      forbiddenCodePoints.has(codePoint) ||
      formatCategory.test(character) ||
      lineSeparatorCategory.test(character) ||
      paragraphSeparatorCategory.test(character)
    ) {
      hidden.push(`U+${codePoint.toString(16).toUpperCase().padStart(4, "0")} at char ${index}`);
    }

    index += character.length;
  }

  return hidden;
}
