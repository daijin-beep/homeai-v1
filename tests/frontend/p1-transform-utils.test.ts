import { describe, expect, it } from "vitest";
import {
  applyPan,
  applyZoom,
  computeViewBoxFromFloorplanBBox,
  convertArcLikeInputToPolyline,
  formatMmAsCm,
  parseCmToMm,
  screenPxToWorldMm,
  worldMmToScreenPx,
  type ViewTransform
} from "../../apps/web/app/p1/_lib/geometry-view.js";

describe("P1 canvas coordinate utilities", () => {
  it("converts mm world coordinates to px screen coordinates", () => {
    const transform: ViewTransform = { scale: 0.5, panX: 20, panY: 40 };

    expect(worldMmToScreenPx({ x: 1000, y: 2000 }, transform)).toEqual({ x: 520, y: 1040 });
  });

  it("converts px screen coordinates back to mm world coordinates", () => {
    const transform: ViewTransform = { scale: 0.5, panX: 20, panY: 40 };

    expect(screenPxToWorldMm({ x: 520, y: 1040 }, transform)).toEqual({ x: 1000, y: 2000 });
  });

  it("pan and zoom do not mutate world geometry", () => {
    const wall = { start: { x: 0, y: 0 }, end: { x: 2000, y: 0 } };
    const before = JSON.stringify(wall);
    const transform = applyPan(applyZoom({ scale: 1, panX: 0, panY: 0 }, 2), { x: 100, y: -50 });

    expect(transform).toEqual({ scale: 2, panX: 100, panY: -50 });
    expect(JSON.stringify(wall)).toBe(before);
  });

  it("computes viewBox from floorplan bbox without changing bbox", () => {
    const bbox = { minX: 0, minY: 0, maxX: 5000, maxY: 4000, widthMm: 5000, heightMm: 4000 };
    const before = JSON.stringify(bbox);
    const viewBox = computeViewBoxFromFloorplanBBox(bbox, { scale: 2, panX: 0, panY: 0 });

    expect(viewBox.width).toBe(3300);
    expect(viewBox.height).toBe(2800);
    expect(JSON.stringify(bbox)).toBe(before);
  });

  it("formats mm as cm and parses cm input to mm", () => {
    expect(formatMmAsCm(1230)).toBe("123");
    expect(formatMmAsCm(1235)).toBe("123.5");
    expect(parseCmToMm("123.5")).toBe(1235);
    expect(parseCmToMm("123,5")).toBe(1235);
  });

  it("converts arc-like input to polyline points without curve metadata", () => {
    const points = convertArcLikeInputToPolyline(
      { x: 0, y: 0 },
      { x: 500, y: -300 },
      { x: 1000, y: 0 }
    );

    expect(points).toEqual([
      { x: 0, y: 0 },
      { x: 500, y: -300 },
      { x: 1000, y: 0 }
    ]);
    expect(JSON.stringify(points)).not.toContain("Bezier");
    expect(JSON.stringify(points)).not.toContain("NURBS");
  });
});
