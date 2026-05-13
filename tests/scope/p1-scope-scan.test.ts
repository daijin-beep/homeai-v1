import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();

describe("P1 release-gate scope scan", () => {
  it("keeps forbidden product scope out of implementation files", () => {
    const files = collectFiles([
      join(repoRoot, "apps", "web", "app", "p1"),
      join(repoRoot, "apps", "web", "app", "api", "p1"),
      join(repoRoot, "packages", "contracts", "src"),
      join(repoRoot, "packages", "floorplan-parser", "src"),
      join(repoRoot, "packages", "geometry", "src"),
      join(repoRoot, "packages", "scene", "src")
    ]);
    const forbidden = [
      /Design Kernel/i,
      /PDF export/i,
      /DWG/i,
      /DXF/i,
      /construction drawing/i,
      /load-bearing/i,
      /GB compliance/i,
      /structural feasibility/i,
      /chat editing/i,
      /true curve canonical/i,
      /承重墙/,
      /施工风险/,
      /建筑规范/,
      /无法报建/
    ];

    const hits = files.flatMap((file) => {
      const text = readFileSync(file, "utf8");
      return forbidden
        .filter((pattern) => pattern.test(text))
        .map((pattern) => `${file}: ${pattern.toString()}`);
    });

    expect(hits).toEqual([]);
  });

  it("keeps P1 UI behind API routes instead of direct service/store imports", () => {
    const files = collectFiles([join(repoRoot, "apps", "web", "app", "p1")]);
    const forbidden = [
      /@homeai\/floorplan-parser/,
      /createInMemoryP1Repositories/,
      /Repository/,
      /LayoutIntentRepository/,
      /InMemory/,
      /confirmFloorplanDraft/,
      /createCanonicalFloorplanRevision/,
      /runSpaceTruthGate/,
      /buildSceneContract/,
      /createSceneContractV02/,
      /createInitialLayoutIntent/,
      /buildLayoutIntentContract/
    ];
    const hits = files.flatMap((file) => {
      const text = readFileSync(file, "utf8");
      return forbidden
        .filter((pattern) => pattern.test(text))
        .map((pattern) => `${file}: ${pattern.toString()}`);
    });

    expect(hits).toEqual([]);
  });

  it("keeps downstream baseline builders behind SceneContract instead of draft or store imports", () => {
    const files = collectFiles([join(repoRoot, "packages", "scene", "src")]);
    const forbidden = [
      /@homeai\/floorplan-parser/,
      /FloorplanDraftRevision/,
      /DraftWallSegment/,
      /DraftOpening/,
      /createInMemoryP1Repositories/,
      /postP1/,
      /confirmFloorplanDraft/
    ];
    const hits = files.flatMap((file) => {
      const text = readFileSync(file, "utf8");
      return forbidden
        .filter((pattern) => pattern.test(text))
        .map((pattern) => `${file}: ${pattern.toString()}`);
    });

    expect(hits).toEqual([]);
  });

  it("keeps rebased downstream baselines out of product generation and layout mutation scope", () => {
    const files = collectFiles([join(repoRoot, "packages", "scene", "src")]);
    const forbidden = [
      /Design Kernel/i,
      /SchemeLite/i,
      /CreativeRenderSpec/i,
      /render provider/i,
      /image provider/i,
      /RenderVerificationReport/i,
      /SKU matching/i,
      /payment/i,
      /PDF export/i,
      /DWG/i,
      /DXF/i,
      /construction drawing/i,
      /load-bearing/i,
      /GB compliance/i,
      /structural feasibility/i,
      /chat editing/i,
      /LayoutIntentRevision/,
      /FurniturePlaceholder/,
      /layoutIntentHash/,
      /layout\.placeholder/,
      /aiAutofillEnabled/
    ];
    const hits = files.flatMap((file) => {
      const text = readFileSync(file, "utf8");
      return forbidden
        .filter((pattern) => pattern.test(text))
        .map((pattern) => `${file}: ${pattern.toString()}`);
    });

    expect(hits).toEqual([]);
  });

  it("keeps layout intent out of canonical geometry and SceneContract geometry", () => {
    const spaceTruthFiles = [
      join(repoRoot, "packages", "contracts", "src", "p1-floorplan-adjustment.ts"),
      join(repoRoot, "packages", "geometry", "src", "index.ts"),
      join(repoRoot, "packages", "scene", "src", "index.ts")
    ];
    const forbidden = [
      /FurniturePlaceholder/,
      /LayoutIntentRevision/,
      /layoutIntentHash/,
      /layout\.placeholder/,
      /aiAutofillEnabled/
    ];
    const hits = spaceTruthFiles.flatMap((file) => {
      const text = readFileSync(file, "utf8");
      return forbidden
        .filter((pattern) => pattern.test(text))
        .map((pattern) => `${file}: ${pattern.toString()}`);
    });

    expect(hits).toEqual([]);
  });

  it("keeps layout intent spike out of forbidden product scope", () => {
    const files = collectFiles([
      join(repoRoot, "packages", "contracts", "src", "layout-intent.ts"),
      join(repoRoot, "packages", "floorplan-parser", "src", "layout-intent.ts"),
      join(repoRoot, "apps", "web", "app", "api", "p1", "layout-intents")
    ]);
    const forbidden = [
      /P3 editor implementation/i,
      /Design Kernel/i,
      /image provider/i,
      /SKU matching/i,
      /payment/i,
      /PDF export/i,
      /DWG/i,
      /DXF/i,
      /construction drawing/i,
      /load-bearing/i,
      /GB compliance/i,
      /chat editing/i
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
