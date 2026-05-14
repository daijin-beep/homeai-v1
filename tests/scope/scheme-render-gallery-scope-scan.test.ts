import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

describe("Scheme render gallery scope scan", () => {
  it("keeps Batch 11 out of providers, commerce, export, construction, and persistence scopes", () => {
    const files = collectFiles([
      join(repoRoot, "packages", "contracts", "src", "scheme-render-gallery.ts"),
      join(repoRoot, "packages", "render-pipeline", "src", "scheme-render-gallery-view-model.ts"),
      join(repoRoot, "packages", "render-pipeline", "src", "render-gallery-fixtures.ts"),
      join(repoRoot, "apps", "web", "app", "api", "dev", "scheme-render-gallery"),
      join(repoRoot, "apps", "web", "app", "dev", "render-gallery-debug"),
      join(repoRoot, "apps", "web", "components", "scheme-render-gallery")
    ]);
    const forbidden = [
      { pattern: /openai/i, allow: [] },
      { pattern: /anthropic/i, allow: [] },
      { pattern: /gemini/i, allow: [] },
      { pattern: /flux/i, allow: [] },
      { pattern: /qwen/i, allow: [] },
      { pattern: /stability/i, allow: [] },
      { pattern: /replicate/i, allow: [] },
      { pattern: /fetch\s*\(/i, allow: [] },
      { pattern: /axios/i, allow: [] },
      { pattern: /stripe/i, allow: [] },
      { pattern: /sku/i, allow: [/skuUsed/] },
      { pattern: /payment/i, allow: [/paymentUsed/] },
      { pattern: /pdf/i, allow: [/pdfUsed/] },
      { pattern: /dwg/i, allow: [] },
      { pattern: /dxf/i, allow: [] },
      { pattern: /construction/i, allow: [/constructionScopeUsed/] },
      { pattern: /contractor/i, allow: [] },
      { pattern: /prisma/i, allow: [] },
      { pattern: /drizzle/i, allow: [] },
      { pattern: /postgres/i, allow: [] }
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
