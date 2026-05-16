import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const escapedNewline = String.fromCharCode(92) + "n";
const lineFeedByte = 10;
const carriageReturnByte = 13;
const byteOrderMark = [239, 187, 191];
const hiddenUnicodeCategoryPattern = new RegExp("[\\p{Cf}\\p{Zl}\\p{Zp}]", "u");
const hiddenCodePoints = new Set([
  0x200b,
  0x200c,
  0x200d,
  0xfeff,
  0x2028,
  0x2029,
  0x202a,
  0x202b,
  0x202c,
  0x202d,
  0x202e,
  0x2066,
  0x2067,
  0x2068,
  0x2069
]);

const batch14RawGuardFiles = [
  {
    path: "docs/ads-integration/ADS_CONSUMER_CONTRACT.md",
    firstLine: "# ADS Consumer Contract",
    secondLine: "",
    thirdLine: "## Boundary",
    minimumLfBytes: 50
  },
  {
    path: "docs/ads-integration/ADS_RECOVERY_PR_REVIEW_GATE.md",
    firstLine: "# ADS Recovery PR Review Gate",
    secondLine: "",
    thirdLine: "## Current PR Handling",
    minimumLfBytes: 30
  },
  {
    path: "packages/contracts/src/render-job.ts",
    firstLine: 'import { z } from "zod";',
    thirdLine: 'import { GeometryHashSchema, P1RoomTypeSchema } from "./p1-floorplan-adjustment.js";',
    minimumLfBytes: 100
  },
  {
    path: "tests/contracts/render-job-contracts.test.ts",
    firstLine: 'import { describe, expect, it } from "vitest";',
    thirdLine: "  GalleryEligibilityDecisionSchema,",
    minimumLfBytes: 70
  },
  {
    path: "tests/docs/creative-render-spec-freeze-docs.test.ts",
    firstLine: 'import { readFileSync } from "node:fs";',
    thirdLine: 'import { describe, expect, it } from "vitest";',
    minimumLfBytes: 90
  }
] as const;

describe("CreativeRenderSpec freeze documentation", () => {
  it("documents active input asset field names and ADS rejection conditions", () => {
    const doc = read("docs/render-pipeline/CREATIVE_RENDER_SPEC_FREEZE.md");

    expect(doc).toContain("inputs.controlRender.uri");
    expect(doc).toContain("inputs.depthMap.uri");
    expect(doc).toContain("inputs.semanticMask.uri");
    expect(doc).toContain("inputs.lineMap.uri");
    expect(doc).toContain("inputs.lockedGeometryMask.uri");
    expect(doc).toContain("inputs.anchorLayoutMask.uri");
    expect(doc).toContain("ADS must reject the spec");
    expect(doc).toContain("Do not add parallel revision id fields");
  });

  it("documents ADS consumer boundary and recovery PR gate", () => {
    const consumer = read("docs/ads-integration/ADS_CONSUMER_CONTRACT.md");
    const gate = read("docs/ads-integration/ADS_RECOVERY_PR_REVIEW_GATE.md");

    expect(consumer).toContain("Codex does not import ADS runtime packages");
    expect(consumer).toContain("CreativeRenderSpec` freeze is active, not deferred");
    expect(consumer).toContain("RenderTrace.sourceModule = render_verifier_l1");
    expect(consumer).toContain("validateCreativeRenderSpecForADS()");
    expect(gate).toContain("Old ADS PR #2 has been closed as superseded and must not be merged");
    expect(gate).toContain("https://github.com/daijin-beep/homeai-v1/pull/10");
    expect(gate).toContain("ads/rebased-batch03-06-verifier-debug-bakeoff-gated-provider");
    expect(gate).toContain("render_verifier_l1");
  });

  it.each(batch14RawGuardFiles)("%s uses UTF-8 physical LF bytes and no hidden Unicode", (guard) => {
    const bytes = readBytes(guard.path);
    const text = read(guard.path);
    const lines = text.split(String.fromCharCode(lineFeedByte));

    expect(hasByteOrderMark(bytes)).toBe(false);
    expect(countByte(bytes, lineFeedByte)).toBeGreaterThan(guard.minimumLfBytes);
    expect(countByte(bytes, carriageReturnByte)).toBe(0);
    expect(text).not.toContain(escapedNewline);
    expect(hasNonAsciiByte(bytes)).toBe(false);
    expect(hiddenUnicodeCategoryPattern.test(text)).toBe(false);
    expect(findHiddenCodePoints(text)).toEqual([]);
    expect(lines[0]).toBe(guard.firstLine);
    if ("secondLine" in guard) {
      expect(lines[1]).toBe(guard.secondLine);
    }
    expect(lines[2]).toBe(guard.thirdLine);
  });
});

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}

function readBytes(path: string): Buffer {
  return readFileSync(join(repoRoot, path));
}

function countByte(bytes: Buffer, value: number): number {
  return bytes.reduce((count, byte) => count + (byte === value ? 1 : 0), 0);
}

function hasByteOrderMark(bytes: Buffer): boolean {
  return byteOrderMark.every((byte, index) => bytes[index] === byte);
}

function hasNonAsciiByte(bytes: Buffer): boolean {
  return bytes.some((byte) => byte > 127);
}

function findHiddenCodePoints(text: string): string[] {
  const hits: string[] = [];
  for (let index = 0; index < text.length; index += 1) {
    const codePoint = text.codePointAt(index);
    if (codePoint === undefined) {
      continue;
    }
    if (hiddenCodePoints.has(codePoint)) {
      hits.push(`U+${codePoint.toString(16).toUpperCase()}`);
    }
  }
  return hits;
}
