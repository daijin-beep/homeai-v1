import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const carriageReturnByte = 0x0d;
const lineFeedByte = 0x0a;
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

const adsRuntimePaths = [
  "packages/ads-runtime/**",
  "packages/render-verifier/**",
  "apps/web/app/dev/render-debug/**",
  "apps/web/app/api/render-snapshot/**",
  "apps/web/app/api/render-human-review/**"
];

const spaceTruthRedZonePaths = [
  "apps/web/app/p1/**",
  "packages/floorplan-parser/**",
  "packages/geometry/**",
  "packages/scene/**",
  "packages/contracts/src/p1-*",
  "packages/contracts/src/scene*",
  "packages/contracts/src/design-kernel*",
  "packages/contracts/src/layout-intent*",
  "packages/contracts/src/anchor*",
  "packages/contracts/src/floorplan*"
];

const codexOwnedImplementationRoots = [
  join(repoRoot, "packages", "creative-render-spec", "src"),
  join(repoRoot, "packages", "scheme-page", "src"),
  join(repoRoot, "packages", "render-pipeline", "src"),
  join(repoRoot, "packages", "soft-decor-gps", "src"),
  join(repoRoot, "packages", "analytics", "src"),
  join(repoRoot, "apps", "web", "components"),
  join(repoRoot, "apps", "web", "app", "dev")
];

const asciiLfGuardFiles = [
  {
    path: join(repoRoot, "docs", "integration", "V1_BETA_REMAINING_WORK_PLAN.md"),
    minLfBytes: 90
  },
  {
    path: join(repoRoot, "tests", "scope", "v1-beta-ownership-reconciliation-scope-scan.test.ts"),
    minLfBytes: 170
  }
];

describe("V1 Beta ownership reconciliation gates", () => {
  it.each(asciiLfGuardFiles)("$path is plain UTF-8 ASCII with physical LF", ({ path, minLfBytes }) => {
    const bytes = readFileSync(path);
    const text = bytes.toString("utf8");

    expect(Array.from(bytes.subarray(0, 3))).not.toEqual(byteOrderMark);
    expect(countByte(bytes, lineFeedByte)).toBeGreaterThan(minLfBytes);
    expect(countByte(bytes, carriageReturnByte)).toBe(0);
    expect(text).not.toContain(escapedNewline);
    expect(findHiddenCharacters(text)).toEqual([]);
    expect(findNonAsciiBytes(bytes)).toEqual([]);
  });

  it("keeps Codex remaining-work branches out of Claude Track B ADS runtime paths", () => {
    expect(diffAgainstMain(adsRuntimePaths)).toEqual([]);
  });

  it("keeps Codex remaining-work branches out of Space Truth red-zone paths", () => {
    expect(diffAgainstMain(spaceTruthRedZonePaths)).toEqual([]);
  });

  it("does not duplicate canonical render schemas outside packages/contracts", () => {
    const files = collectFiles([
      join(repoRoot, "apps"),
      join(repoRoot, "packages")
    ]).filter((file) => !normal(file).startsWith("packages/contracts/"));
    const duplicateSchemaDeclarations = [
      /(?:export\s+)?const\s+RenderTraceSchema\s*=\s*z\./,
      /(?:export\s+)?const\s+RenderTraceSourceModuleSchema\s*=\s*z\./,
      /(?:export\s+)?const\s+RenderJobSchema\s*=\s*z\./,
      /(?:export\s+)?const\s+RenderCandidateSchema\s*=\s*z\./,
      /(?:export\s+)?const\s+RenderVerificationReportSchema\s*=\s*z\./,
      /(?:export\s+)?const\s+GalleryEligibilityDecisionSchema\s*=\s*z\./,
      /(?:export\s+)?const\s+SchemeRenderGalleryViewModelSchema\s*=\s*z\./,
      /(?:export\s+)?const\s+CreativeRenderSpecSchema\s*=\s*z\./
    ];

    expect(scanFiles(files, duplicateSchemaDeclarations)).toEqual([]);
  });

  it("keeps real provider SDKs, external network calls, and secrets out of Codex-owned surfaces", () => {
    const forbidden = [
      blockedPattern(["fetch", "\\s*\\("]),
      blockedPattern(["ax", "ios"]),
      blockedPattern(["un", "dici"]),
      blockedPattern(["node", "-", "fetch"]),
      blockedPattern(["XML", "Http", "Request"]),
      blockedPattern(["node", ":", "http"]),
      blockedPattern(["node", ":", "https"]),
      blockedPattern(["open", "ai"]),
      blockedPattern(["anth", "ropic"]),
      blockedPattern(["gem", "ini"]),
      blockedPattern(["rep", "licate"]),
      blockedPattern(["stab", "ility"]),
      blockedPattern(["fl", "ux"]),
      blockedPattern(["DASH", "SCOPE", "_API", "_KEY"]),
      blockedPattern(["OPEN", "AI", "_API", "_KEY"]),
      blockedPattern(["ANTH", "ROPIC", "_API", "_KEY"]),
      blockedPattern(["GOO", "GLE", "_API", "_KEY"])
    ];

    expect(scanFiles(collectFiles(codexOwnedImplementationRoots), forbidden)).toEqual([]);
  });

  it("keeps PDF export and construction workflow scope out of Codex-owned implementation", () => {
    const forbidden = [
      /PDF export/i,
      /professional drawing/i,
      /construction workflow/i,
      /construction-ready material list/i,
      /construction material/i,
      /contractor collaboration/i,
      /contractor workflow/i
    ];

    expect(scanFiles(collectFiles(codexOwnedImplementationRoots), forbidden)).toEqual([]);
  });
});

function diffAgainstMain(paths: string[]): string[] {
  const output = execFileSync("git", ["diff", "--name-only", "origin/main...HEAD", "--", ...paths], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  return linesOf(output).filter(Boolean).sort();
}

function scanFiles(files: string[], patterns: RegExp[]): string[] {
  return files.flatMap((file) => {
    const lines = linesOf(readFileSync(file, "utf8"));
    return lines.flatMap((line, index) =>
      patterns
        .filter((pattern) => pattern.test(line))
        .map((pattern) => `${normal(file)}:${index + 1}: ${pattern.toString()}`)
    );
  });
}

function collectFiles(roots: string[]): string[] {
  return roots
    .filter((root) => existsSync(root))
    .flatMap((root) => walk(root))
    .filter((file) => /\.(ts|tsx|json)$/.test(file));
}

function walk(path: string): string[] {
  const stat = statSync(path);
  if (stat.isFile()) {
    return [path];
  }
  return readdirSync(path).flatMap((entry) => {
    const child = join(path, entry);
    if (child.includes(`${sep}node_modules${sep}`) || child.includes(`${sep}.next${sep}`)) {
      return [];
    }
    return walk(child);
  });
}

function normal(path: string): string {
  return relative(repoRoot, path).replaceAll("\\", "/");
}

function blockedPattern(parts: string[]): RegExp {
  return new RegExp(parts.join(""), "i");
}

function linesOf(text: string): string[] {
  return text.replaceAll(carriageReturn, "").split(lineFeed);
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
