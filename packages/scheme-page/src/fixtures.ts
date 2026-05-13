import { SchemeLiteContractSchema, type SchemeLiteContract, type RoomSchemeLite } from "@homeai/contracts";

export const schemePageFixtureTimestamp = "2026-05-14T00:00:00.000Z";
export const schemePageFixtureGeometryHash = `sha256:${"1".repeat(64)}`;
export const schemePageFixtureLayoutIntentHash = `sha256:${"2".repeat(64)}`;

export function createSchemePageFixtureContract(
  options: { withLayoutIntent?: boolean; withWarnings?: boolean } = {}
): SchemeLiteContract {
  const withLayoutIntent = options.withLayoutIntent ?? true;
  const withWarnings = options.withWarnings ?? true;
  const trace = {
    homeId: "home-scheme-page-fixture",
    floorplanRevisionId: "canonical-scheme-page-fixture",
    sceneContractId: "scene-scheme-page-fixture",
    geometryHash: schemePageFixtureGeometryHash,
    ...(withLayoutIntent ? { layoutIntentHash: schemePageFixtureLayoutIntentHash } : {})
  };
  const rooms = [
    room({
      ...trace,
      roomId: "room-living",
      roomType: "living_room",
      role: "living",
      anchorId: "anchor-living",
      ...(withLayoutIntent ? { layoutRef: "placeholder-living-sofa" } : {})
    }),
    room({ ...trace, roomId: "room-kitchen", roomType: "kitchen", role: "cooking", anchorId: "anchor-kitchen" }),
    room({ ...trace, roomId: "room-primary", roomType: "primary_bedroom", role: "primary sleep", anchorId: "anchor-primary" }),
    room({ ...trace, roomId: "room-study", roomType: "study", role: "work", anchorId: "anchor-study" }),
    room({ ...trace, roomId: "room-bath", roomType: "bathroom", role: "bath", anchorId: "anchor-bath" }),
    room({ ...trace, roomId: "room-balcony", roomType: "balcony", role: "balcony", anchorId: "anchor-balcony" }),
    room({
      ...trace,
      roomId: "room-corridor",
      roomType: "corridor",
      role: "circulation",
      anchorId: "anchor-corridor",
      ...(withWarnings ? { warning: "Review corridor storage density." } : {})
    })
  ];

  return SchemeLiteContractSchema.parse({
    version: "0.1",
    schemeId: "scheme-page-fixture",
    ...trace,
    brief: {
      summary: "Whole-home scheme for a calm practical home.",
      language: "en-US",
      householdProfile: ["two adults"],
      functionalNeeds: ["storage", "easy circulation"],
      avoid: ["dark palette"],
      unknowns: [],
      source: "deterministic_mock"
    },
    budget: {
      currency: "CNY",
      band: "standard",
      minCny: 50000,
      maxCny: 120000,
      confidence: 0.8,
      notes: ["Budget preference is planning guidance only."]
    },
    style: {
      styleId: "style-scheme-page-fixture",
      displayName: "modern / warm",
      tags: ["modern", "warm"],
      palette: ["warm white", "soft gray", "natural wood"],
      materialTags: ["paint", "wood", "fabric"],
      avoidTokens: ["dark palette"],
      source: "user_brief",
      confidence: 0.8
    },
    roomRolePlan: {
      homeId: trace.homeId,
      floorplanRevisionId: trace.floorplanRevisionId,
      sceneContractId: trace.sceneContractId,
      geometryHash: trace.geometryHash,
      ...(trace.layoutIntentHash === undefined ? {} : { layoutIntentHash: trace.layoutIntentHash }),
      rooms: rooms.map((candidate) => ({
        roomId: candidate.roomId,
        roomType: candidate.roomType,
        inferredRole: candidate.role,
        confidence: 0.8,
        source: candidate.layoutIntentRefs.length > 0 ? "layout_intent" : "affordance_graph",
        reasons: [`roomType=${candidate.roomType}`],
        riskFlags: candidate.riskFlags
      }))
    },
    rooms,
    verification: {
      status: withWarnings ? "warning" : "pass",
      checks: withWarnings
        ? [
            {
              checkId: "scheme-warning-corridor-density",
              status: "warning",
              message: "Corridor scheme should be reviewed for clear passage.",
              roomId: "room-corridor"
            }
          ]
        : []
    },
    trace: {
      traceId: "trace-scheme-page-fixture",
      providerName: "deterministic_mock",
      providerVersion: "0.1.0",
      mode: "contract_only",
      inputId: "input-scheme-page-fixture",
      status: withWarnings ? "warning" : "pass",
      networkCalls: false,
      warnings: withWarnings ? ["Corridor card includes a review warning."] : [],
      startedAt: schemePageFixtureTimestamp,
      completedAt: schemePageFixtureTimestamp
    },
    createdAt: schemePageFixtureTimestamp
  });
}

function room(input: {
  homeId: string;
  floorplanRevisionId: string;
  sceneContractId: string;
  geometryHash: string;
  layoutIntentHash?: string;
  roomId: string;
  roomType: RoomSchemeLite["roomType"];
  role: string;
  anchorId: string;
  layoutRef?: string;
  warning?: string;
}): RoomSchemeLite {
  return {
    roomSchemeId: `room-scheme-${input.roomId}`,
    homeId: input.homeId,
    floorplanRevisionId: input.floorplanRevisionId,
    sceneContractId: input.sceneContractId,
    geometryHash: input.geometryHash,
    ...(input.layoutIntentHash === undefined ? {} : { layoutIntentHash: input.layoutIntentHash }),
    roomId: input.roomId,
    roomType: input.roomType,
    role: input.role,
    status: input.warning === undefined ? "pass" : "warning",
    designIntent: `Keep ${input.roomType} focused on ${input.role}.`,
    keyMoves: [`Use ${input.role} as the room planning role.`],
    storageStrategy: "Keep storage guidance lightweight for this stage.",
    circulationNotes: ["Keep circulation clear."],
    lightingNotes: ["Use existing openings as lighting context."],
    anchorRefs: [
      {
        anchorPlanId: "anchor-plan-scheme-page-fixture",
        anchorId: input.anchorId,
        type: "room_center"
      }
    ],
    layoutIntentRefs: input.layoutRef === undefined
      ? []
      : [
          {
            layoutIntentRevisionId: "layout-intent-scheme-page-fixture",
            placeholderId: input.layoutRef,
            category: "sofa",
            label: "Sofa"
          }
        ],
    riskFlags: input.warning === undefined ? [] : ["corridor_density_review"],
    issues: input.warning === undefined
      ? []
      : [
          {
            issueId: `issue-${input.roomId}-review`,
            severity: "warning",
            code: "ROOM_REVIEW_RECOMMENDED",
            message: input.warning
          }
        ]
  };
}
