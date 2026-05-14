import { describe, expect, it } from "vitest";
import {
  buildRenderJobFromCreativeRenderSpecs,
  createRenderLifecycleFixtureInput
} from "@homeai/render-pipeline";

describe("RenderJob full-space coverage", () => {
  it("covers every valid room with at least one room job", () => {
    const fixture = createRenderLifecycleFixtureInput();
    const renderJob = buildRenderJobFromCreativeRenderSpecs(fixture);

    expect(renderJob.coverage.validRoomCount).toBe(fixture.sceneContract.rooms.length);
    expect(renderJob.coverage.coveredRoomCount).toBe(renderJob.coverage.validRoomCount);
    expect(renderJob.roomJobs).toHaveLength(fixture.sceneContract.rooms.length);
    expect(renderJob.roomJobs.every((roomJob) => roomJob.renderSpecIds.length >= 1)).toBe(true);
  });

  it("fails coverage when a valid room is missing render specs", () => {
    const fixture = createRenderLifecycleFixtureInput();
    const missingRoomId = fixture.sceneContract.rooms[0]?.roomId;
    if (missingRoomId === undefined) {
      throw new Error("Expected fixture room.");
    }
    const renderJob = buildRenderJobFromCreativeRenderSpecs({
      ...fixture,
      creativeRenderSpecs: fixture.creativeRenderSpecs.filter((spec) => spec.roomId !== missingRoomId)
    });

    expect(renderJob.coverage.status).toBe("fail");
    expect(renderJob.coverage.missingRoomIds).toContain(missingRoomId);
    expect(renderJob.status).toBe("failed");
  });

  it("rejects key-room-only render coverage", () => {
    const fixture = createRenderLifecycleFixtureInput();
    const keyRoomSpecs = fixture.creativeRenderSpecs.filter((spec) => spec.roomType === "living_room");
    const renderJob = buildRenderJobFromCreativeRenderSpecs({
      ...fixture,
      creativeRenderSpecs: keyRoomSpecs
    });

    expect(renderJob.coverage.status).toBe("fail");
    expect(renderJob.coverage.coveredRoomCount).toBe(1);
    expect(renderJob.coverage.missingRoomIds.length).toBeGreaterThan(0);
  });
});
