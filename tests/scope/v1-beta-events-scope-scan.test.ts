import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const carriageReturn = String.fromCharCode(13);
const lineFeed = String.fromCharCode(10);

describe("V1 Beta events scope scan", () => {
  it("keeps Batch 19 local-only and outside provider, persistence, ADS runtime, and Space Truth write scopes", () => {
    const files = collectFiles([
      join(repoRoot, "packages", "contracts", "src", "v1-beta-event.ts"),
      join(repoRoot, "packages", "analytics", "src"),
      join(repoRoot, "apps", "web", "app", "api", "dev", "v1-beta-events"),
      join(repoRoot, "apps", "web", "app", "dev", "v1-beta-events-debug")
    ]);
    const forbidden = [
      /@homeai\/ads-runtime/i,
      /@homeai\/render-verifier/i,
      /render-snapshot/i,
      /render-human-review/i,
      /fetch\s*\(/i,
      /axios/i,
      /node:http|node:https|node-fetch|undici|XMLHttpRequest/i,
      /OpenAI|Anthropic|Gemini|Replicate|Stability|DASHSCOPE/i,
      /API_KEY|SECRET|TOKEN/i,
      /stripe|checkout|payment/i,
      /sku/i,
      /pdf|dwg|dxf/i,
      /construction|contractor|load-bearing|structural/i,
      /writeFile|appendFile|readFile|prisma|drizzle|postgres|sqlite/i,
      /persistCanonicalRevision|confirmFloorplanDraft|createInMemoryP1Repositories/i
    ];

    const hits = files.flatMap((file) => {
      const lines = readFileSync(file, "utf8").replaceAll(carriageReturn, "").split(lineFeed);
      return lines.flatMap((line, index) =>
        forbidden
          .filter((pattern) => pattern.test(line))
          .map((pattern) => `${file}:${index + 1}: ${pattern.toString()}`)
      );
    });

    expect(hits).toEqual([]);
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
