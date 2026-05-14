import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

describe("CreativeRenderSpec ADS freeze scope scan", () => {
  it("does not import or implement ADS runtime-owned surfaces", () => {
    const files = collectFiles([
      join(repoRoot, "packages", "creative-render-spec", "src"),
      join(repoRoot, "packages", "contracts", "src", "creative-render-spec.ts")
    ]);
    const forbidden = [
      /@homeai\/ads-runtime/i,
      /@homeai\/render-verifier/i,
      /packages\/ads-runtime/i,
      /packages\\ads-runtime/i,
      /packages\/render-verifier/i,
      /packages\\render-verifier/i,
      /app\/dev\/render-debug/i,
      /app\\dev\\render-debug/i,
      /render-snapshot/i,
      /render-human-review/i,
      /image adapter registry/i,
      /createImageAdapterRegistry/i,
      /bakeoff harness implementation/i,
      /human review queue implementation/i,
      /real provider gate implementation/i,
      /fetch\s*\(\s*["']https:\/\//i,
      /axios/i
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
  return roots.filter((root) => existsSync(root)).flatMap((root) => walk(root)).filter((file) => /\.(ts|tsx|md)$/.test(file));
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
