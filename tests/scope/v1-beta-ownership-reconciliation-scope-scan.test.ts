import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

const adsRuntimePaths = [
  "packages/ads-runtime/**",
  "packages/render-verifier/**",
  "apps/web/app/dev/render-debug/**",
  "apps/web/app/api/render-snapshot/**",
  "apps/web/app/api/render-human-review/**"
];

const spaceTruthRedZonePaths = [
  "apps/web/app/p1/**",
  "packages/floorplan-parser/**",
  "packages/geometry/**",
  "packages/scene/**",
  "packages/contracts/src/p1-*",
  "packages/contracts/src/scene*",
  "packages/contracts/src/design-kernel*",
  "packages/contracts/src/layout-intent*",
  "packages/contracts/src/anchor*",
  "packages/contracts/src/floorplan*"
];

const codexOwnedImplementationRoots = [
  join(repoRoot, "packages", "creative-render-spec", "src"),
  join(repoRoot, "packages", "scheme-page", "src"),
  join(repoRoot, "packages", "render-pipeline", "src"),
  join(repoRoot, "packages", "soft-decor-gps", "src"),
  join(repoRoot, "packages", "analytics", "src"),
  join(repoRoot, "apps", "web", "components"),
  join(repoRoot, "apps", "web", "app", "dev")
];

describe("V1 Beta ownership reconciliation gates", () => {
  it("keeps Codex remaining-work branches out of Claude Track B ADS runtime paths", () => {
    expect(diffAgainstMain(adsRuntimePaths)).toEqual([]);
  });

  it("keeps Codex remaining-work branches out of Space Truth red-zone paths", () => {
    expect(diffAgainstMain(spaceTruthRedZonePaths)).toEqual([]);
  });

  it("does not duplicate canonical render schemas outside packages/contracts", () => {
    const files = collectFiles([
      join(repoRoot, "apps"),
      join(repoRoot, "packages")
    ]).filter((file) => !normal(file).startsWith("packages/contracts/"));
    const duplicateSchemaDeclarations = [
      /(?:export\s+)?const\s+RenderTraceSchema\s*=\s*z\./,
      /(?:export\s+)?const\s+RenderTraceSourceModuleSchema\s*=\s*z\./,
      /(?:export\s+)?const\s+RenderJobSchema\s*=\s*z\./,
      /(?:export\s+)?const\s+RenderCandidateSchema\s*=\s*z\./,
      /(?:export\s+)?const\s+RenderVerificationReportSchema\s*=\s*z\./,
      /(?:export\s+)?const\s+GalleryEligibilityDecisionSchema\s*=\s*z\./,
      /(?:export\s+)?const\s+SchemeRenderGalleryViewModelSchema\s*=\s*z\./,
      /(?:export\s+)?const\s+CreativeRenderSpecSchema\s*=\s*z\./
    ];

    expect(scanFiles(files, duplicateSchemaDeclarations)).toEqual([]);
  });

  it("keeps real provider SDKs, external network calls, and secrets out of Codex-owned surfaces", () => {
    const forbidden = [
      /fetch\s*\(/i,
      /axios/i,
      /undici/i,
      /node-fetch/i,
      /XMLHttpRequest/i,
      /node:http/i,
      /node:https/i,
      /openai/i,
      /anthropic/i,
      /gemini/i,
      /replicate/i,
      /stability/i,
      /flux/i,
      /DASHSCOPE_API_KEY/,
      /OPENAI_API_KEY/,
      /ANTHROPIC_API_KEY/,
      /GOOGLE_API_KEY/
    ];

    expect(scanFiles(collectFiles(codexOwnedImplementationRoots), forbidden)).toEqual([]);
  });

  it("keeps PDF export and construction workflow scope out of Codex-owned implementation", () => {
    const forbidden = [
      /PDF export/i,
      /professional drawing/i,
      /construction workflow/i,
      /construction-ready material list/i,
      /construction material/i,
      /contractor collaboration/i,
      /contractor workflow/i
    ];

    expect(scanFiles(collectFiles(codexOwnedImplementationRoots), forbidden)).toEqual([]);
  });
});

function diffAgainstMain(paths: string[]): string[] {
  const output = execFileSync("git", ["diff", "--name-only", "origin/main...HEAD", "--", ...paths], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  return output.split(/\r?\n/).filter(Boolean).sort();
}

function scanFiles(files: string[], patterns: RegExp[]): string[] {
  return files.flatMap((file) => {
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    return lines.flatMap((line, index) =>
      patterns
        .filter((pattern) => pattern.test(line))
        .map((pattern) => `${normal(file)}:${index + 1}: ${pattern.toString()}`)
    );
  });
}

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
    if (child.includes(`${sep}node_modules${sep}`) || child.includes(`${sep}.next${sep}`)) {
      return [];
    }
    return walk(child);
  });
}

function normal(path: string): string {
  return relative(repoRoot, path).replaceAll("\\", "/");
}
