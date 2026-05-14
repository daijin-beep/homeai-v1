import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

// Pure-numeric ranges so this scanner's own source stays ASCII and cannot
// trip its own detection. Mirrors trojan-source class per CVE-2021-42574.
//   bidi controls   U+202A-202E (LRE/RLE/PDF/LRO/RLO)
//   bidi isolates   U+2066-2069 (LRI/RLI/FSI/PDI)
//   zero-width      U+200B-200D (ZWSP/ZWNJ/ZWJ)
//   BOM / ZWNBSP    U+FEFF
const HIDDEN_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x202a, 0x202e],
  [0x2066, 0x2069],
  [0x200b, 0x200d],
  [0xfeff, 0xfeff]
];

function findHidden(text: string): { line: number; codepoint: number } | null {
  let line = 1;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    if (ch === 0x0a) {
      line++;
      continue;
    }
    for (const range of HIDDEN_RANGES) {
      const lo = range[0];
      const hi = range[1];
      if (ch >= lo && ch <= hi) {
        return { line, codepoint: ch };
      }
    }
  }
  return null;
}

const SCAN_ROOTS = [
  join(repoRoot, "packages"),
  join(repoRoot, "apps"),
  join(repoRoot, "tests"),
  join(repoRoot, "docs"),
  join(repoRoot, "vitest.config.ts"),
  join(repoRoot, "tsconfig.base.json"),
  join(repoRoot, "package.json"),
  join(repoRoot, "pnpm-workspace.yaml"),
  join(repoRoot, "AGENTS.md"),
  join(repoRoot, "README.md")
];

const SCANNABLE_EXT = /\.(ts|tsx|js|jsx|json|jsonc|yaml|yml|md|css|html)$/;

const EXCLUDED_PATH_FRAGMENTS = ["node_modules", ".next", ".turbo", ".git"];

describe("Unicode hygiene scope scan", () => {
  it("contains no bidi control / zero-width / BOM characters anywhere under source, config, fixtures, or docs", () => {
    const files = SCAN_ROOTS.flatMap((root) => collect(root)).filter((p) => SCANNABLE_EXT.test(p));
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      const hit = findHidden(text);
      if (hit !== null) {
        const hex = hit.codepoint.toString(16).toUpperCase().padStart(4, "0");
        offenders.push(`${file}:${hit.line}: U+${hex}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("scanner's own source remains ASCII to avoid self-flagging", () => {
    const text = readFileSync(join(repoRoot, "tests", "scope", "unicode-hygiene.test.ts"), "utf8");
    expect(findHidden(text)).toBeNull();
  });
});

function collect(path: string): string[] {
  let stat;
  try {
    stat = statSync(path);
  } catch {
    return [];
  }
  if (stat.isFile()) {
    return [path];
  }
  return readdirSync(path).flatMap((entry) => {
    if (EXCLUDED_PATH_FRAGMENTS.some((f) => entry === f)) {
      return [];
    }
    const child = join(path, entry);
    if (EXCLUDED_PATH_FRAGMENTS.some((f) => child.includes(`${f}/`) || child.endsWith(f))) {
      return [];
    }
    return collect(child);
  });
}
