import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

describe("Scheme Page bounded scope scan", () => {
  it("keeps Batch 08 out of provider, render lifecycle, commerce, export, construction, and persistence scopes", () => {
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
