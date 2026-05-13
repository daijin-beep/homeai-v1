import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

describe("CreativeRenderSpec bounded scope scan", () => {
  it("keeps Batch 09 out of generation, orchestration, commerce, export, construction, and persistence scopes", () => {
    const files = collectFiles([
      join(repoRoot, "packages", "contracts", "src", "creative-render-spec.ts"),
      join(repoRoot, "packages", "creative-render-spec", "src"),
      join(repoRoot, "apps", "web", "app", "api", "dev", "creative-render-spec"),
      join(repoRoot, "apps", "web", "app", "dev", "creative-render-spec-debug")
    ]);
    const forbidden = [
      /OpenAI/i,
      /Anthropic/i,
      /Claude/i,
      /Gemini/i,
      /Replicate/i,
      /Fal\b/i,
      /fetch\s*\(\s*["']https:\/\//i,
      /axios/i,
      /ImageGenerationProvider implementation/i,
      /RenderJob orchestration/i,
      /RenderCandidate lifecycle/i,
      /galleryReady/i,
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
      /structural engineering/i,
      /GB compliance/i,
      /createInMemoryP1Repositories/,
      /persistCanonicalRevision/,
      /persistSceneContract/,
      /database writes/i
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
