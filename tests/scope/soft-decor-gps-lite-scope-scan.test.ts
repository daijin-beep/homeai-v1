import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

describe("Soft Decor GPS Lite scope scan", () => {
  it("keeps Batch 21 on admitted SKUs without live provider, network, commerce, or geometry mutation", () => {
    const files = collectFiles([
      join(repoRoot, "packages", "contracts", "src", "soft-decor-gps.ts"),
      join(repoRoot, "packages", "soft-decor-gps", "src"),
      join(repoRoot, "apps", "web", "app", "api", "dev", "soft-decor-gps-lite"),
      join(repoRoot, "apps", "web", "app", "dev", "soft-decor-gps-lite-debug")
    ]);
    const forbidden = [
      /@homeai\/ads-runtime/i,
      /@homeai\/render-verifier/i,
      /render-snapshot/i,
      /render-human-review/i,
      /fetch\s*\(/i,
      /axios/i,
      /node:http|node:https|node-fetch|undici|XMLHttpRequest/i,
      /https?:\/\//i,
      /OpenAI|Anthropic|Gemini|Replicate|Stability|DASHSCOPE/i,
      /API_KEY|SECRET|TOKEN/i,
      /stripe|checkout|payment/i,
      /pdf|dwg|dxf/i,
      /construction|contractor|load-bearing|structural/i,
      /wallMutation|roomPolygon|confirmedGeometryMutable|persistCanonicalRevision|confirmFloorplanDraft/i
    ];

    const hits = files.flatMap((file) => {
      const lines = readFileSync(file, "utf8").split(/\r?\n/);
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
