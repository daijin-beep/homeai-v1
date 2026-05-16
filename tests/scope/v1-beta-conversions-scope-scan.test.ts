import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

describe("V1 Beta conversions scope scan", () => {
  it("keeps Batch 22 mock-only without real provider, checkout, network, or geometry mutation", () => {
    const files = collectFiles([
      join(repoRoot, "packages", "contracts", "src", "v1-beta-conversion.ts"),
      join(repoRoot, "packages", "contracts", "src", "v1-beta-event.ts"),
      join(repoRoot, "packages", "analytics", "src"),
      join(repoRoot, "apps", "web", "app", "api", "dev", "v1-beta-conversions"),
      join(repoRoot, "apps", "web", "app", "dev", "v1-beta-conversions-debug")
    ]);
    const forbidden = [
      { pattern: /@homeai\/ads-runtime/i, allow: [] },
      { pattern: /@homeai\/render-verifier/i, allow: [] },
      { pattern: /render-snapshot/i, allow: [] },
      { pattern: /render-human-review/i, allow: [] },
      { pattern: /fetch\s*\(/i, allow: [] },
      { pattern: /axios/i, allow: [] },
      { pattern: /node:http|node:https|node-fetch|undici|XMLHttpRequest/i, allow: [] },
      { pattern: /https?:\/\//i, allow: [] },
      { pattern: /OpenAI|Anthropic|Gemini|Replicate|Stability|DASHSCOPE/i, allow: [] },
      { pattern: /API_KEY|SECRET|TOKEN/i, allow: [] },
      { pattern: /stripe|checkout/i, allow: [] },
      {
        pattern: /payment/i,
        allow: [
          /payment_started_mock/,
          /mock/i,
          /payment mock/i,
          /Payment started mock/,
          /requiresRealPaymentProvider/
        ]
      },
      { pattern: /pdf|dwg|dxf/i, allow: [] },
      { pattern: /construction|contractor|load-bearing|structural/i, allow: [] },
      { pattern: /wallMutation|roomPolygon|confirmedGeometryMutable|persistCanonicalRevision|confirmFloorplanDraft/i, allow: [] }
    ];

    const hits = files.flatMap((file) => {
      const lines = readFileSync(file, "utf8").split(/\r?\n/);
      return lines.flatMap((line, index) =>
        forbidden
          .filter(({ pattern, allow }) => pattern.test(line) && !allow.some((allowed) => allowed.test(line)))
          .map(({ pattern }) => `${file}:${index + 1}: ${pattern.toString()}`)
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
