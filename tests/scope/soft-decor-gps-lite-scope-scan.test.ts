import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const carriageReturn = String.fromCharCode(13);
const lineFeed = String.fromCharCode(10);

describe("Soft Decor GPS Lite scope scan", () => {
  it("does not introduce network, provider, secrets, payment, ADS, P1, geometry, or contracts edits", () => {
    const files = collectFiles([
      join(repoRoot, "packages", "soft-decor-gps", "src"),
      join(repoRoot, "tests", "soft-decor-gps"),
    ]);
    const forbidden = [
      /@homeai\/ads-runtime/i,
      /@homeai\/render-verifier/i,
      /@homeai\/geometry/i,
      /@homeai\/scene/i,
      /render-snapshot/i,
      /render-human-review/i,
      /fetch\s*\(/i,
      new RegExp(["ax", "ios"].join(""), "i"),
      new RegExp(
        ["node:", "http", "|node:", "https", "|node-", "fetch", "|un", "dici", "|XML", "Http", "Request"].join(""),
        "i",
      ),
      /OpenAI|Anthropic|Gemini|Replicate|Stability|DASHSCOPE/i,
      new RegExp(["API", "_KEY", "|SEC", "RET", "|TOK", "EN"].join(""), "i"),
      /stripe|checkout|payment/i,
      /pdf|dwg|dxf/i,
      /construction|contractor|load-bearing/i,
      /writeFile|appendFile|prisma|drizzle|postgres|sqlite/i,
      /persistCanonicalRevision|confirmFloorplanDraft|createInMemoryP1Repositories/i,
      /CanonicalFloorplan/i,
      /confirmedGeometryMutable:\s*true/i,
      /realProviderEnabled:\s*true/i,
      /networkCallsEnabled:\s*true/i,
      /dbPersistenceEnabled:\s*true/i,
    ];

    const hits = files.flatMap((file) => {
      const lines = readFileSync(file, "utf8")
        .replaceAll(carriageReturn, "")
        .split(lineFeed);
      return lines.flatMap((line, index) =>
        forbidden
          .filter((pattern) => pattern.test(line))
          .map((pattern) => `${file}:${index + 1}: ${pattern.toString()}`),
      );
    });

    expect(hits).toEqual([]);
  });

  it("does not modify packages/contracts/src files", () => {
    const status = execFileSync("git", ["status", "--short", "--", "packages/contracts/src"], {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim();
    expect(status).toBe("");
  });

  it("source files are ASCII LF with no hidden Unicode", () => {
    const files = collectFiles([
      join(repoRoot, "packages", "soft-decor-gps", "src"),
      join(repoRoot, "tests", "soft-decor-gps"),
    ]);
    const bom = String.fromCharCode(0xfeff);
    const issues: string[] = [];
    for (const file of files) {
      const raw = readFileSync(file, "utf8");
      if (raw.includes(bom)) {
        issues.push(`${file}: contains BOM`);
      }
      if (raw.includes("\r")) {
        issues.push(`${file}: contains CR`);
      }
      for (let i = 0; i < raw.length; i++) {
        const code = raw.charCodeAt(i);
        if (
          code > 127 &&
          code !== 0x2018 &&
          code !== 0x2019 &&
          code !== 0x201c &&
          code !== 0x201d
        ) {
          issues.push(`${file}: non-ASCII char at offset ${i} (U+${code.toString(16).padStart(4, "0")})`);
          break;
        }
      }
    }
    expect(issues).toEqual([]);
  });
});

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
    if (child.includes("node_modules")) {
      return [];
    }
    return walk(child);
  });
}
