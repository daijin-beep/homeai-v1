import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const carriageReturn = String.fromCharCode(13);
const lineFeed = String.fromCharCode(10);

describe("V1 Beta user backend shell scope scan", () => {
  it("keeps the user backend shell mocked, local, and outside Space Truth write paths", () => {
    const files = collectFiles([
      join(repoRoot, "packages", "contracts", "src", "v1-beta-user-backend.ts"),
      join(repoRoot, "apps", "web", "app", "api", "beta"),
      join(repoRoot, "tests", "contracts", "v1-beta-user-backend-contracts.test.ts"),
      join(repoRoot, "tests", "api", "v1-beta-user-backend-route.test.ts"),
    ]);
    const forbidden = [
      /@homeai\/ads-runtime/i,
      /@homeai\/render-verifier/i,
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
      /sku/i,
      /pdf|dwg|dxf/i,
      /construction|contractor|load-bearing/i,
      /writeFile|appendFile|prisma|drizzle|postgres|sqlite/i,
      /persistCanonicalRevision|confirmFloorplanDraft|createInMemoryP1Repositories/i,
      /dbPersistenceEnabled:\s*true/i,
      /realProviderEnabled:\s*true/i,
      /networkCallsEnabled:\s*true/i,
      /confirmedGeometryMutable:\s*true/i,
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

  it("does not create canonical floorplan records or mutate confirmed geometry", () => {
    const files = collectFiles([
      join(repoRoot, "packages", "contracts", "src", "v1-beta-user-backend.ts"),
      join(repoRoot, "apps", "web", "app", "api", "beta"),
    ]);
    const forbidden = [
      /CanonicalFloorplan/i,
      /persistCanonicalRevision/i,
      /confirmFloorplanDraft/i,
      /confirmedGeometryMutable:\s*true/i,
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
