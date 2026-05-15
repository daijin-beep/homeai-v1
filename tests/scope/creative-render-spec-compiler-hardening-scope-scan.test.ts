import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

describe("CreativeRenderSpec compiler hardening scope scan", () => {
  it("does not import ADS runtime, verifier, provider, commerce, export, or persistence scope", () => {
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
      /createImageAdapterRegistry/i,
      /bakeoff harness implementation/i,
      /human review queue implementation/i,
      /real provider gate implementation/i,
      /fetch\s*\(\s*["']https:\/\//i,
      /axios/i,
      /OpenAI/i,
      /Anthropic/i,
      /Replicate/i,
      /productUrl/i,
      /checkout/i,
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
  return roots
    .filter((root) => existsSync(root))
    .flatMap((root) => walk(root))
    .filter((file) => /\.(ts|tsx|json)$/.test(file));
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
