import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

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
