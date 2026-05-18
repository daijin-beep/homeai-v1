import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const lineFeedByte = 0x0a;
const carriageReturnByte = 0x0d;
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

const batch17RawGuardFiles = [
  { path: "apps/web/app/dev/scheme-page-debug/page.tsx", minLfBytes: 40 },
  { path: "apps/web/components/scheme-page/SchemePagePreview.tsx", minLfBytes: 250 },
  { path: "packages/contracts/src/scheme-page.ts", minLfBytes: 200 },
  { path: "packages/scheme-page/src/index.ts", minLfBytes: 400 },
  { path: "tests/contracts/scheme-page-contracts.test.ts", minLfBytes: 90 },
  { path: "tests/frontend/scheme-page-preview.test.tsx", minLfBytes: 40 },
  { path: "tests/frontend/scheme-render-gallery-ui.test.tsx", minLfBytes: 50 },
  { path: "tests/scheme-page/scheme-page-route.test.ts", minLfBytes: 80 },
  { path: "tests/scheme-page/scheme-page-view-model.test.ts", minLfBytes: 120 },
  { path: "tests/scope/scheme-page-scope-scan.test.ts", minLfBytes: 120 }
];

describe("Scheme Page bounded scope scan", () => {
  it("keeps Batch 17A out of provider, render lifecycle, commerce, export, construction, and persistence scopes", () => {
    const files = collectFiles([
      join(repoRoot, "packages", "contracts", "src", "scheme-page.ts"),
      join(repoRoot, "packages", "scheme-page", "src"),
      join(repoRoot, "apps", "web", "app", "api", "dev", "scheme-page"),
      join(repoRoot, "apps", "web", "app", "dev", "scheme-page-debug"),
      join(repoRoot, "apps", "web", "components", "scheme-page")
    ]);
    const forbidden = [
      /OpenAI/i,
      /Anthropic/i,
      /Claude/i,
      /Gemini/i,
      /@homeai\/ads-runtime/i,
      /@homeai\/render-verifier/i,
      /render-snapshot/i,
      /render-human-review/i,
      /fetch\s*\(\s*["']https:\/\//i,
      /axios/i,
      /RenderJob/,
      /RenderCandidate/,
      /ImageGenerationProvider/,
      /ImageAdapter/,
      /provider adapter implementation/i,
      /SKU/,
      /productUrl/,
      /payment/i,
      /checkout/i,
      /lead submission/i,
      /PDF/,
      /DWG/,
      /DXF/,
      /construction/i,
      /load-bearing/i,
      /GB compliance/i,
      /structural engineering/i,
      /createInMemoryP1Repositories/,
      /persistCanonicalRevision/,
      /persistSceneContract/
    ];

    const hits = files.flatMap((file) => {
      const text = readFileSync(file, "utf8");
      return forbidden
        .filter((pattern) => pattern.test(text))
        .map((pattern) => `${file}: ${pattern.toString()}`);
    });

    expect(hits).toEqual([]);
  });

  it.each(batch17RawGuardFiles)("$path uses strict Batch 17A ASCII LF raw formatting", ({ path, minLfBytes }) => {
    const bytes = readFileSync(join(repoRoot, path));
    const text = bytes.toString("utf8");
    const physicalLfCount = countByte(bytes, lineFeedByte);
    const lines = text.split(lineFeed);

    expect(Array.from(bytes.subarray(0, 3))).not.toEqual(byteOrderMark);
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
