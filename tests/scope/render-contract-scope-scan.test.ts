import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

describe("Render contract foundation scope scan", () => {
  it("keeps Batch 10 out of provider, commerce, export, and construction scopes", () => {
    const files = collectFiles([
      join(repoRoot, "packages", "contracts", "src", "render-job.ts"),
      join(repoRoot, "packages", "contracts", "src", "render-candidate.ts"),
      join(repoRoot, "packages", "contracts", "src", "render-verification-report.ts"),
      join(repoRoot, "packages", "contracts", "src", "render-gallery-eligibility.ts"),
      join(repoRoot, "packages", "render-pipeline", "src"),
      join(repoRoot, "apps", "web", "app", "api", "dev", "render-job"),
      join(repoRoot, "apps", "web", "app", "dev", "render-job-debug")
    ]);
    const forbidden = [
      /openai/i,
      /anthropic/i,
      /gemini/i,
      /flux/i,
      /qwen/i,
      /stability/i,
      /replicate/i,
      /stripe/i,
      /payment/i,
      /pdf/i,
      /construction/i,
      /contractor/i,
      /sku recommendation/i,
      /merchant feed/i
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
