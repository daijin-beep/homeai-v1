import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const lineFeedByte = 0x0a;
const carriageReturnByte = 0x0d;
const carriageReturn = String.fromCharCode(13);
const lineFeed = String.fromCharCode(10);
const escapedNewline = String.fromCharCode(92) + "n";
const byteOrderMark = [0xef, 0xbb, 0xbf];
const formatCategory = /^\p{Cf}$/u;
const lineSeparatorCategory = /^\p{Zl}$/u;
const paragraphSeparatorCategory = /^\p{Zp}$/u;
const forbiddenCodePoints = new Set([
  0x061c,
  0x200b,
  0x200c,
  0x200d,
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

const batch18RawGuardFiles = [
  { path: "apps/web/app/beta/page.tsx", expectedLfBytes: 7, minLfBytes: 5 },
  { path: "apps/web/app/page.tsx", expectedLfBytes: 54, minLfBytes: 30 },
  { path: "apps/web/components/v1-beta-flow/V1BetaFlowShell.tsx", expectedLfBytes: 348, minLfBytes: 250 },
  { path: "packages/contracts/src/index.ts", expectedLfBytes: 40, minLfBytes: 25 },
  { path: "packages/contracts/src/v1-beta-flow.ts", expectedLfBytes: 115, minLfBytes: 80 },
  { path: "tests/contracts/v1-beta-flow-contracts.test.ts", expectedLfBytes: 134, minLfBytes: 90 },
  { path: "tests/frontend/v1-beta-flow-shell.test.tsx", expectedLfBytes: 46, minLfBytes: 30 },
  { path: "tests/scope/v1-beta-flow-scope-scan.test.ts", expectedLfBytes: 173, minLfBytes: 120 }
];

describe("V1 Beta flow shell scope scan", () => {
  it("keeps Batch 18 out of ADS runtime, provider, live network, commerce, and Space Truth write paths", () => {
    const files = collectFiles([
      join(repoRoot, "packages", "contracts", "src", "v1-beta-flow.ts"),
      join(repoRoot, "apps", "web", "app", "beta"),
      join(repoRoot, "apps", "web", "app", "page.tsx"),
      join(repoRoot, "apps", "web", "components", "v1-beta-flow")
    ]);
    const forbidden = [
      { pattern: /@homeai\/ads-runtime/i, allow: [] },
      { pattern: /@homeai\/render-verifier/i, allow: [] },
      { pattern: /render-snapshot/i, allow: [] },
      { pattern: /render-human-review/i, allow: [] },
      { pattern: /fetch\s*\(/i, allow: [] },
      { pattern: /axios/i, allow: [] },
      { pattern: /OpenAI|Anthropic|Gemini|Replicate|Stability/i, allow: [] },
      { pattern: /OPENAI_API_KEY|ANTHROPIC_API_KEY|GOOGLE_API_KEY|DASHSCOPE_API_KEY/i, allow: [] },
      { pattern: /sku/i, allow: [] },
      { pattern: /stripe|checkout|payment/i, allow: [] },
      { pattern: /pdf|dwg|dxf/i, allow: [] },
      { pattern: /construction|contractor|load-bearing|structural/i, allow: [] },
      { pattern: /persistCanonicalRevision|confirmFloorplanDraft|createInMemoryP1Repositories/i, allow: [] },
      { pattern: /confirmedGeometryMutable:\s*true/i, allow: [] },
      { pattern: /adsRuntimeConsumed:\s*true/i, allow: [] },
      { pattern: /realProviderEnabled:\s*true/i, allow: [] },
      { pattern: /networkCallsEnabled:\s*true/i, allow: [] },
      { pattern: /downstreamCommerceEnabled:\s*true/i, allow: [] }
    ];

    const hits = files.flatMap((file) => {
      const lines = readFileSync(file, "utf8").replaceAll(carriageReturn, "").split(lineFeed);
      return lines.flatMap((line, index) =>
        forbidden
          .filter(({ pattern, allow }) => pattern.test(line) && !allow.some((allowed) => allowed.test(line)))
          .map(({ pattern }) => `${file}:${index + 1}: ${pattern.toString()}`)
      );
    });

    expect(hits).toEqual([]);
  });

  it.each(batch18RawGuardFiles)("$path uses strict Batch 18 ASCII LF raw formatting", ({ path, expectedLfBytes, minLfBytes }) => {
    const bytes = readFileSync(join(repoRoot, path));
    const text = bytes.toString("utf8");
    const physicalLfCount = countByte(bytes, lineFeedByte);
    const lines = text.split(lineFeed);

    expect(Array.from(bytes.subarray(0, 3))).not.toEqual(byteOrderMark);
    expect(physicalLfCount).toBe(expectedLfBytes);
    expect(physicalLfCount).toBeGreaterThan(minLfBytes);
    expect(countByte(bytes, carriageReturnByte)).toBe(0);
    expect(bytes[bytes.length - 1]).toBe(lineFeedByte);
    expect(lines.length).toBe(physicalLfCount + 1);
    expect(text).not.toContain(escapedNewline);
    expect(findHiddenCharacters(text)).toEqual([]);
    expect(findNonAsciiBytes(bytes)).toEqual([]);
  });
});

function collectFiles(roots: string[]): string[] {
  return roots.filter((root) => existsSync(root)).flatMap((root) => walk(root)).filter((file) => /\.(ts|tsx|json)$/.test(file));
}

function walk(path: string): string[] {
  const stat = statSync(path);
  if (stat.isFile()) {
    return [path];
  }
  return readdirSync(path).flatMap((entry) => {
    const child = join(path, entry);
    if (child.includes("node_modules")) {
      return [];
    }
    return walk(child);
  });
}

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
