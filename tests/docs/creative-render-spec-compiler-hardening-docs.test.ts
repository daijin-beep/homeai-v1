import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const docPath = "docs/render-pipeline/CREATIVE_RENDER_SPEC_COMPILER_HARDENING.md";
const byteOrderMark = [0xef, 0xbb, 0xbf];
const lineFeedByte = 0x0a;
const escapedNewline = String.fromCharCode(92) + "n";
const formatCategory = /^\p{Cf}$/u;
const lineSeparatorCategory = /^\p{Zl}$/u;
const paragraphSeparatorCategory = /^\p{Zp}$/u;

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

  it("uses ASCII text, physical LF bytes, and no hidden Unicode", () => {
    const bytes = readFileSync(docPath);
    const text = bytes.toString("utf8");
    const hiddenCharacters = findHiddenCharacters(text);
    const nonAsciiBytes = [...bytes.entries()].filter(([, byte]) => byte > 0x7f);

    expect(Array.from(bytes.subarray(0, 3))).not.toEqual(byteOrderMark);
    expect(countByte(bytes, lineFeedByte)).toBeGreaterThan(50);
    expect(text.split("\n").length).toBeGreaterThan(50);
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
