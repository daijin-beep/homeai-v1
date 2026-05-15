import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const guardedFiles = [
  "docs/render-pipeline/CREATIVE_RENDER_SPEC_COMPILER_HARDENING.md",
  "tests/creative-render-spec/creative-render-spec-compiler-hardening.test.ts",
  "tests/docs/creative-render-spec-compiler-hardening-docs.test.ts",
  "tests/scope/creative-render-spec-compiler-hardening-scope-scan.test.ts"
];

const docPath = "docs/render-pipeline/CREATIVE_RENDER_SPEC_COMPILER_HARDENING.md";
const minimumLfBytesByPath = new Map<string, number>([
  ["docs/render-pipeline/CREATIVE_RENDER_SPEC_COMPILER_HARDENING.md", 50],
  ["tests/creative-render-spec/creative-render-spec-compiler-hardening.test.ts", 25],
  ["tests/docs/creative-render-spec-compiler-hardening-docs.test.ts", 25],
  ["tests/scope/creative-render-spec-compiler-hardening-scope-scan.test.ts", 25]
]);
const byteOrderMark = [0xef, 0xbb, 0xbf];
const lineFeedByte = 0x0a;
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

describe("CreativeRenderSpec compiler hardening docs", () => {
  it("documents producer-side compiler hardening boundaries", () => {
    const text = readFileSync(docPath, "utf8");

    expect(text).toContain("producer-side compiler");
    expect(text).toContain("ADS remains the consumer");
    expect(text).toContain("Every valid SceneContract room");
    expect(text).toContain("inputs.controlRender.uri");
    expect(text).toContain("geometryHash");
    expect(text).toContain("Cautious rooms");
    expect(text).toContain("Batch 13 does not implement ADS runtime");
  });

  it.each(guardedFiles)("%s uses ASCII LF bytes and no hidden Unicode", (path) => {
    const bytes = readFileSync(path);
    const text = bytes.toString("utf8");
    const hiddenCharacters = findHiddenCharacters(text);
    const nonAsciiBytes = findNonAsciiBytes(bytes);
    const minimumLfBytes = minimumLfBytesByPath.get(path) ?? 25;

    expect(Array.from(bytes.subarray(0, 3))).not.toEqual(byteOrderMark);
    expect(countByte(bytes, lineFeedByte)).toBeGreaterThan(minimumLfBytes);
    expect(text.split(lineFeed).length).toBeGreaterThan(minimumLfBytes);
    expect(text).not.toContain(escapedNewline);
    expect(nonAsciiBytes).toEqual([]);
    expect(hiddenCharacters).toEqual([]);
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

function findNonAsciiBytes(bytes: Buffer): string[] {
  const nonAscii: string[] = [];

  for (const [index, byte] of bytes.entries()) {
    if (byte > 0x7f) {
      nonAscii.push(`0x${byte.toString(16).toUpperCase().padStart(2, "0")} at byte ${index}`);
    }
  }

  return nonAscii;
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
