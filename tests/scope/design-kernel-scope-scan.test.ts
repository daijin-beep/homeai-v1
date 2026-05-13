import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();

describe("Design Kernel contract-only scope scan", () => {
  it("keeps Batch 07 out of product UI, exports, construction, SKU, payment, and network scopes", () => {
    const files = collectFiles([
      join(repoRoot, "packages", "contracts", "src", "design-kernel.ts"),
      join(repoRoot, "packages", "design-kernel", "src"),
      join(repoRoot, "apps", "web", "app", "api", "dev", "design-kernel")
    ]);
    const forbidden = [
      /Canvas UI/i,
      /CreativeRenderSpec/,
      /RenderJob/,
      /RenderCandidate/,
      /RenderVerificationReport/,
      /RoomGallery/,
      /SkuFitResult/,
      /SKU matching/i,
      /payment/i,
      /PDF/i,
      /DWG/i,
      /DXF/i,
      /construction/i,
      /load-bearing/i,
      /GB compliance/i,
      /structural feasibility/i,
      /chat editing/i,
      /OpenAI/i,
      /fetch\s*\(/,
      /XMLHttpRequest/,
      /axios/
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
  return roots.flatMap((root) => walk(root)).filter((file) => /\.(ts|tsx|json)$/.test(file));
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
