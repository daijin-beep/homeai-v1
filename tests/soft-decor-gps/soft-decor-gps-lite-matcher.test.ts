import { describe, expect, it } from "vitest";
import {
  ProductCandidateSchema,
  SoftDecorGPSPlanSchema,
} from "@homeai/contracts";
import {
  matchCandidates,
  scoreBudget,
  scoreCategoryMatch,
  scoreSizeFit,
  scoreStyle,
  generateWarnings,
  type LocalProductInput,
  type MatcherInput,
  type RoomConstraint,
} from "../../packages/soft-decor-gps/src/index";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeSofa(overrides: Partial<LocalProductInput> = {}): LocalProductInput {
  return {
    id: "sofa-001",
    provider: "fixture-provider",
    category: "sofa",
    title: "Modern Minimalist Sofa",
    imageUrl: "fixture://soft-decor/sofa-001.jpg",
    leadUrl: "fixture://soft-decor/lead/sofa-001",
    priceAmount: 3500,
    currency: "CNY",
    budgetBand: "mid",
    widthMm: 2200,
    depthMm: 900,
    heightMm: 850,
    styleTags: ["modern", "minimalist"],
    ...overrides,
  };
}

function makeCurtain(overrides: Partial<LocalProductInput> = {}): LocalProductInput {
  return {
    id: "curtain-001",
    provider: "fixture-provider",
    category: "curtain",
    title: "Sheer Linen Curtain",
    imageUrl: "fixture://soft-decor/curtain-001.jpg",
    leadUrl: "fixture://soft-decor/lead/curtain-001",
    priceAmount: 800,
    currency: "CNY",
    budgetBand: "low",
    widthMm: 3000,
    styleTags: ["linen", "natural"],
    ...overrides,
  };
}

function makeRoom(overrides: Partial<RoomConstraint> = {}): RoomConstraint {
  return {
    roomId: "room-living-01",
    roomType: "living",
    categories: ["sofa"],
    styleKeywords: ["modern", "minimalist"],
    budgetBand: "mid",
    maxWidthMm: 3000,
    maxDepthMm: 1200,
    maxHeightMm: 1000,
    ...overrides,
  };
}

function makeInput(overrides: Partial<MatcherInput> = {}): MatcherInput {
  return {
    projectId: "proj-001",
    schemeId: "scheme-001",
    sceneContractId: "scene-001",
    styleProfileId: "style-001",
    candidates: [makeSofa()],
    rooms: [makeRoom()],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Soft Decor GPS Lite local matcher", () => {
  describe("happy path", () => {
    it("produces a valid SoftDecorGPSPlan for a single room with one category", () => {
      const result = matchCandidates(makeInput());

      expect(result.status).toBe("ready");
      expect(result.projectId).toBe("proj-001");
      expect(result.rooms).toHaveLength(1);
      expect(result.rooms[0]!.recommendations).toHaveLength(1);
      expect(result.rooms[0]!.recommendations[0]!.primaryCandidate.id).toBe("sofa-001");
      expect(result.rooms[0]!.recommendations[0]!.category).toBe("sofa");
    });

    it("schema-validates the full plan output", () => {
      const result = matchCandidates(makeInput());
      const parsed = SoftDecorGPSPlanSchema.safeParse(result);
      expect(parsed.success).toBe(true);
    });

    it("schema-validates each product candidate in the plan", () => {
      const input = makeInput({
        candidates: [
          makeSofa({ id: "sofa-a" }),
          makeSofa({ id: "sofa-b", priceAmount: 5000, budgetBand: "high" }),
        ],
      });
      const result = matchCandidates(input);
      const rec = result.rooms[0]!.recommendations[0]!;
      expect(ProductCandidateSchema.safeParse(rec.primaryCandidate).success).toBe(true);
      for (const alt of rec.alternatives) {
        expect(ProductCandidateSchema.safeParse(alt).success).toBe(true);
      }
    });

    it("handles multiple rooms with multiple categories", () => {
      const input = makeInput({
        candidates: [
          makeSofa(),
          makeCurtain(),
        ],
        rooms: [
          makeRoom({ roomId: "room-1", categories: ["sofa", "curtain"] }),
          makeRoom({ roomId: "room-2", roomType: "bedroom", categories: ["curtain"] }),
        ],
      });
      const result = matchCandidates(input);
      expect(result.rooms).toHaveLength(2);
      expect(result.rooms[0]!.recommendations).toHaveLength(2);
      expect(result.rooms[1]!.recommendations).toHaveLength(1);
      const curtainRec = result.rooms[0]!.recommendations.find(
        (rec) => rec.category === "curtain",
      );
      expect(curtainRec?.primaryCandidate.fit.warnings).not.toContainEqual(
        expect.stringContaining("Category mismatch"),
      );
    });
  });

  describe("category filtering", () => {
    it("only matches candidates whose category matches the room category", () => {
      const input = makeInput({
        candidates: [
          makeSofa(),
          makeCurtain(),
        ],
        rooms: [makeRoom({ categories: ["curtain"] })],
      });
      const result = matchCandidates(input);
      const rec = result.rooms[0]!.recommendations[0]!;
      expect(rec.primaryCandidate.category).toBe("curtain");
    });

    it("adds a warning when no candidates exist for a requested category", () => {
      const input = makeInput({
        candidates: [makeSofa()],
        rooms: [makeRoom({ categories: ["sofa", "rug"] })],
      });
      const result = matchCandidates(input);
      expect(result.rooms[0]!.warnings).toContain(
        "No candidates available for category: rug",
      );
      expect(result.rooms[0]!.recommendations).toHaveLength(1);
    });
  });

  describe("budget mismatch warning", () => {
    it("warns when candidate budget band differs from room target", () => {
      const input = makeInput({
        candidates: [makeSofa({ budgetBand: "premium" })],
        rooms: [makeRoom({ budgetBand: "low" })],
      });
      const result = matchCandidates(input);
      const rec = result.rooms[0]!.recommendations[0]!;
      expect(rec.primaryCandidate.fit.warnings).toContainEqual(
        expect.stringContaining("Budget mismatch"),
      );
    });

    it("does not warn when budget bands match", () => {
      const input = makeInput({
        candidates: [makeSofa({ budgetBand: "mid" })],
        rooms: [makeRoom({ budgetBand: "mid" })],
      });
      const result = matchCandidates(input);
      const rec = result.rooms[0]!.recommendations[0]!;
      const budgetWarnings = rec.primaryCandidate.fit.warnings.filter((w) =>
        w.includes("Budget"),
      );
      expect(budgetWarnings).toHaveLength(0);
    });
  });

  describe("size mismatch warning", () => {
    it("warns when candidate width exceeds room max", () => {
      const input = makeInput({
        candidates: [makeSofa({ widthMm: 4000 })],
        rooms: [makeRoom({ maxWidthMm: 3000 })],
      });
      const result = matchCandidates(input);
      const rec = result.rooms[0]!.recommendations[0]!;
      expect(rec.primaryCandidate.fit.warnings).toContainEqual(
        expect.stringContaining("Size mismatch"),
      );
    });

    it("warns when candidate depth exceeds room max", () => {
      const input = makeInput({
        candidates: [makeSofa({ depthMm: 1500 })],
        rooms: [makeRoom({ maxDepthMm: 1000 })],
      });
      const result = matchCandidates(input);
      const rec = result.rooms[0]!.recommendations[0]!;
      expect(rec.primaryCandidate.fit.warnings).toContainEqual(
        expect.stringContaining("depth"),
      );
    });

    it("does not warn when candidate fits within size constraints", () => {
      const input = makeInput({
        candidates: [makeSofa({ widthMm: 2000, depthMm: 800 })],
        rooms: [makeRoom({ maxWidthMm: 3000, maxDepthMm: 1200 })],
      });
      const result = matchCandidates(input);
      const rec = result.rooms[0]!.recommendations[0]!;
      const sizeWarnings = rec.primaryCandidate.fit.warnings.filter((w) =>
        w.includes("Size mismatch"),
      );
      expect(sizeWarnings).toHaveLength(0);
    });
  });

  describe("deterministic ordering", () => {
    it("ranks candidates by fitScore descending, then id ascending", () => {
      const input = makeInput({
        candidates: [
          makeSofa({ id: "sofa-c", budgetBand: "premium", styleTags: [] }),
          makeSofa({ id: "sofa-a", budgetBand: "mid", styleTags: ["modern", "minimalist"] }),
          makeSofa({ id: "sofa-b", budgetBand: "mid", styleTags: ["modern"] }),
        ],
        rooms: [makeRoom({ budgetBand: "mid", styleKeywords: ["modern", "minimalist"] })],
      });
      const result = matchCandidates(input);
      const rec = result.rooms[0]!.recommendations[0]!;
      expect(rec.primaryCandidate.id).toBe("sofa-a");
      const altIds = rec.alternatives.map((a) => a.id);
      expect(altIds.indexOf("sofa-b")).toBeLessThan(altIds.indexOf("sofa-c"));
    });

    it("produces identical output on repeated calls with same input", () => {
      const input = makeInput({
        candidates: [
          makeSofa({ id: "s1" }),
          makeSofa({ id: "s2", priceAmount: 2000, budgetBand: "low" }),
        ],
      });
      const result1 = matchCandidates(input);
      const result2 = matchCandidates(input);
      expect(result1).toEqual(result2);
    });
  });

  describe("schema validation of generated plan", () => {
    it("full plan passes SoftDecorGPSPlanSchema.parse", () => {
      const input = makeInput({
        candidates: [
          makeSofa(),
          makeSofa({ id: "sofa-alt", priceAmount: 6000, budgetBand: "high" }),
          makeCurtain(),
        ],
        rooms: [
          makeRoom({ categories: ["sofa", "curtain"] }),
        ],
      });
      const result = matchCandidates(input);
      expect(() => SoftDecorGPSPlanSchema.parse(result)).not.toThrow();
    });

    it("every ProductCandidate in the plan passes ProductCandidateSchema", () => {
      const input = makeInput({
        candidates: [
          makeSofa({ id: "s1" }),
          makeSofa({ id: "s2", budgetBand: "premium" }),
          makeSofa({ id: "s3", budgetBand: "low" }),
        ],
      });
      const result = matchCandidates(input);
      for (const room of result.rooms) {
        for (const rec of room.recommendations) {
          expect(ProductCandidateSchema.safeParse(rec.primaryCandidate).success).toBe(true);
          for (const alt of rec.alternatives) {
            expect(ProductCandidateSchema.safeParse(alt).success).toBe(true);
          }
        }
      }
    });
  });

  describe("scoring helpers", () => {
    it("scoreCategoryMatch returns 1 for match, 0 for mismatch", () => {
      expect(scoreCategoryMatch(makeSofa(), "sofa")).toBe(1.0);
      expect(scoreCategoryMatch(makeSofa(), "curtain")).toBe(0.0);
    });

    it("scoreStyle returns proportion of matching keywords", () => {
      const candidate = makeSofa({ styleTags: ["modern", "minimalist"] });
      expect(scoreStyle(candidate, ["modern", "minimalist"])).toBe(1.0);
      expect(scoreStyle(candidate, ["modern", "rustic"])).toBe(0.5);
      expect(scoreStyle(candidate, [])).toBe(0.5);
    });

    it("scoreSizeFit penalizes exceeding constraints", () => {
      const room = makeRoom({ maxWidthMm: 2000 });
      expect(scoreSizeFit(makeSofa({ widthMm: 1800 }), room)).toBe(1.0);
      expect(scoreSizeFit(makeSofa({ widthMm: 2500 }), room)).toBe(0.5);
    });

    it("scoreBudget returns 1 for exact match, lower for distance", () => {
      expect(scoreBudget(makeSofa({ budgetBand: "mid" }), "mid")).toBe(1.0);
      expect(scoreBudget(makeSofa({ budgetBand: "mid" }), "high")).toBe(0.6);
      expect(scoreBudget(makeSofa({ budgetBand: "low" }), "premium")).toBe(0.2);
    });

    it("generateWarnings includes all relevant mismatch warnings", () => {
      const candidate = makeSofa({
        budgetBand: "premium",
        widthMm: 4000,
        styleTags: [],
      });
      const room = makeRoom({
        budgetBand: "low",
        maxWidthMm: 3000,
        styleKeywords: ["rustic", "farmhouse"],
      });
      const warnings = generateWarnings(candidate, room);
      expect(warnings.some((w) => w.includes("Budget mismatch"))).toBe(true);
      expect(warnings.some((w) => w.includes("Size mismatch"))).toBe(true);
      expect(warnings.some((w) => w.includes("Style mismatch"))).toBe(true);
    });
  });
});
