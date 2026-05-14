import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

const adsPackages = [
  join(repoRoot, "packages", "ads-render", "src"),
  join(repoRoot, "packages", "image-adapter", "src"),
  join(repoRoot, "packages", "render-verifier", "src"),
  join(repoRoot, "packages", "render-jobs", "src")
];

const adsWebSurfaces = [
  join(repoRoot, "apps", "web", "app", "dev", "render-debug"),
  join(repoRoot, "apps", "web", "app", "api", "render"),
  join(repoRoot, "apps", "web", "app", "api", "render-jobs"),
  join(repoRoot, "apps", "web", "app", "api", "render-candidates"),
  join(repoRoot, "apps", "web", "app", "api", "render-verification")
];

const trackAWritePathPatterns = [
  /@homeai\/floorplan-parser/,
  /@homeai\/geometry/,
  /@homeai\/scene/,
  /createCanonicalFloorplanRevision/,
  /buildSceneContract/,
  /createSceneContractV02/,
  /createInMemoryP1Repositories/,
  /confirmFloorplanDraft/,
  /runSpaceTruthGate/,
  /buildLayoutIntentContract/,
  /createInitialLayoutIntent/,
  /\bgeometryHash generator\b/i
];

const legacyRenderSchemaNames = [/\bRenderImageSpec\b/, /\bRenderBatch\b/, /\bRenderImageAsset\b/];

const forbiddenProductScope = [
  /PDF export/i,
  /DWG/i,
  /DXF/i,
  /construction drawing/i,
  /load-bearing/i,
  /GB compliance/i,
  /structural feasibility/i,
  /\bchat editing\b/i
];

describe("ADS Track B release-gate scope scan", () => {
  it("ADS packages never import Track A write paths", () => {
    const files = collectFiles(adsPackages);
    const hits = matchAny(files, trackAWritePathPatterns);
    expect(hits).toEqual([]);
  });

  it("ADS packages never reference legacy RenderImageSpec / RenderBatch / RenderImageAsset names", () => {
    const files = collectFiles(adsPackages);
    const hits = matchAny(files, legacyRenderSchemaNames);
    expect(hits).toEqual([]);
  });

  it("ADS web surfaces never import Track A write paths", () => {
    const files = collectFiles(adsWebSurfaces);
    const hits = matchAny(files, trackAWritePathPatterns);
    expect(hits).toEqual([]);
  });

  it("ADS web surfaces never reference legacy RenderImageSpec / RenderBatch / RenderImageAsset names", () => {
    const files = collectFiles(adsWebSurfaces);
    const hits = matchAny(files, legacyRenderSchemaNames);
    expect(hits).toEqual([]);
  });

  it("ADS code never contains V1-forbidden product scope markers", () => {
    const files = collectFiles([...adsPackages, ...adsWebSurfaces]);
    const hits = matchAny(files, forbiddenProductScope);
    expect(hits).toEqual([]);
  });

  it("ADS code never adds full Scheme Page ownership markers", () => {
    const files = collectFiles([...adsPackages, ...adsWebSurfaces]);
    // Track B may render a RoomRenderGallerySection (Batch 07); it must NOT own the full Scheme Page.
    const forbidden = [/\bSchemePagePayment\b/, /\bSchemePagePaymentFlow\b/, /\bownsSchemePage\b/];
    const hits = matchAny(files, forbidden);
    expect(hits).toEqual([]);
  });
});

function collectFiles(roots: string[]): string[] {
  return roots
    .flatMap((root) => walk(root))
    .filter((file) => /\.(ts|tsx|json)$/.test(file))
    .filter((file) => !file.endsWith("ads-interface-gates.json"))
    .filter((file) => !file.endsWith("ads-scope-scan.test.ts"));
}

function walk(path: string): string[] {
  let stat;
  try {
    stat = statSync(path);
  } catch {
    return [];
  }
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

function matchAny(files: string[], patterns: ReadonlyArray<RegExp>): string[] {
  return files.flatMap((file) => {
    const text = readFileSync(file, "utf8");
    return patterns.filter((p) => p.test(text)).map((p) => `${file}: ${p.toString()}`);
  });
}
