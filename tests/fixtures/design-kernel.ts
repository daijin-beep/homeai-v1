import type {
  FloorplanDraftRevision,
  FurniturePlaceholder,
  LayoutIntentRevision,
  P1AnchorPlan,
  P1RoomAffordanceGraph,
  P1RoomCameraPlanBatch,
  P1SceneContractV02,
  UserBriefInput
} from "@homeai/contracts";
import {
  buildDesignKernelInputFromP1Artifacts,
  type BuildDesignKernelInputArgs
} from "@homeai/design-kernel";
import {
  buildLayoutIntentContract,
  computeLayoutIntentHash,
  createInMemoryP1Repositories,
  postP1ConfirmDraft,
  postP1Session,
  type P1ApiContext
} from "@homeai/floorplan-parser";
import {
  buildAnchorPlanFromAffordanceGraph,
  buildCameraPlanFromSceneContract,
  buildRoomAffordanceGraphFromSceneContract
} from "@homeai/scene";
import { homeWithBalcony, p1FixtureTimestamp, simpleRectangleHome } from "./p1/index.js";

export type DesignKernelFixtureBundle = {
  context: P1ApiContext;
  sceneContract: P1SceneContractV02;
  roomAffordanceGraph: P1RoomAffordanceGraph;
  anchorPlan: P1AnchorPlan;
  cameraPlan: P1RoomCameraPlanBatch;
  layoutIntentContract?: BuildDesignKernelInputArgs["layoutIntentContract"];
  userBriefInput: UserBriefInput;
  input: ReturnType<typeof buildDesignKernelInputFromP1Artifacts>;
};

export function createDesignKernelFixtureBundle(
  options: {
    draft?: FloorplanDraftRevision;
    withLayoutIntent?: boolean;
    inputOverrides?: Partial<BuildDesignKernelInputArgs>;
  } = {}
): DesignKernelFixtureBundle {
  const draft = options.draft ?? homeWithBalcony;
  const context = apiContext({ [draft.homeId]: draft });
  const session = postP1Session(context, draft.homeId);
  const confirmed = postP1ConfirmDraft(context, session.draftRevisionId);
  if (!confirmed.ok) {
    throw new Error("Expected fixture draft to confirm.");
  }
  const sceneContract = context.repositories.sceneContracts.getActiveSceneContractForHome(draft.homeId);
  if (sceneContract === undefined) {
    throw new Error("Expected active scene contract.");
  }
  const roomAffordanceGraph = buildRoomAffordanceGraphFromSceneContract(sceneContract);
  const anchorPlan = buildAnchorPlanFromAffordanceGraph(roomAffordanceGraph);
  const cameraPlan = buildCameraPlanFromSceneContract(sceneContract);
  const layoutIntentContract = options.withLayoutIntent
    ? createLayoutIntentContract(sceneContract)
    : undefined;
  const userBriefInput: UserBriefInput = {
    homeId: sceneContract.homeId,
    text: "A calm practical home with durable finishes.",
    language: "en-US",
    styleTags: ["modern", "warm"],
    budgetBand: "standard",
    budgetMinCny: 50000,
    budgetMaxCny: 120000,
    householdHints: ["two adults"],
    functionalNeeds: ["storage", "easy circulation"],
    avoid: ["dark palette"],
    source: "debug_fixture"
  };
  const input = buildDesignKernelInputFromP1Artifacts({
    inputId: "input-design-kernel-fixture",
    homeId: sceneContract.homeId,
    floorplanRevisionId: sceneContract.canonicalRevisionId,
    sceneContractId: sceneContract.sceneContractId,
    geometryHash: sceneContract.geometryHash,
    sceneContract,
    roomAffordanceGraph,
    anchorPlans: [anchorPlan],
    cameraPlan,
    ...(layoutIntentContract === undefined ? {} : { layoutIntentContract }),
    userBriefInput,
    source: "fixture",
    ...options.inputOverrides
  });

  return {
    context,
    sceneContract,
    roomAffordanceGraph,
    anchorPlan,
    cameraPlan,
    ...(layoutIntentContract === undefined ? {} : { layoutIntentContract }),
    userBriefInput,
    input
  };
}

export function createSimpleDesignKernelFixtureBundle() {
  return createDesignKernelFixtureBundle({ draft: simpleRectangleHome });
}

function apiContext(fixtures: Record<string, FloorplanDraftRevision>): P1ApiContext {
  let counter = 0;
  return {
    repositories: createInMemoryP1Repositories(),
    fixtureDrafts: fixtures,
    actor: {
      anonymousSessionId: "anonymous-design-kernel-test"
    },
    now: () => p1FixtureTimestamp,
    idFactory: (prefix: string) => `${prefix}-${counter += 1}`
  };
}

function createLayoutIntentContract(sceneContract: P1SceneContractV02): BuildDesignKernelInputArgs["layoutIntentContract"] {
  const targetRoom = sceneContract.rooms.find((room) => room.roomType !== "balcony") ?? sceneContract.rooms[0];
  if (targetRoom === undefined) {
    throw new Error("Expected at least one scene room.");
  }
  const placeholder: FurniturePlaceholder = {
    placeholderId: "placeholder-design-kernel-sofa",
    roomId: targetRoom.roomId,
    category: "sofa",
    center: targetRoom.polygon[0] ?? { x: 0, y: 0 },
    rotationDeg: 0,
    displaySizeMm: {
      width: 2200,
      depth: 900
    },
    sizeSource: "category_default",
    userResizable: true,
    source: "fixture",
    label: "Sofa",
    createdAt: p1FixtureTimestamp,
    updatedAt: p1FixtureTimestamp
  };
  const layoutIntentHash = computeLayoutIntentHash({
    aiAutofillEnabled: true,
    placeholders: [placeholder]
  });
  const layoutIntent: LayoutIntentRevision = {
    layoutIntentRevisionId: "layout-intent-design-kernel-fixture",
    homeId: sceneContract.homeId,
    canonicalRevisionId: sceneContract.canonicalRevisionId,
    sceneContractId: sceneContract.sceneContractId,
    geometryHash: sceneContract.geometryHash,
    layoutIntentHash,
    revision: 1,
    source: "fixture",
    aiAutofillEnabled: true,
    placeholders: [placeholder],
    validation: {
      status: "valid",
      canConfirm: true,
      issues: [],
      validatedAt: p1FixtureTimestamp
    },
    createdAt: p1FixtureTimestamp,
    updatedAt: p1FixtureTimestamp
  };

  return buildLayoutIntentContract(layoutIntent, sceneContract, {
    layoutIntentContractId: "layout-contract-design-kernel-fixture",
    createdAt: p1FixtureTimestamp
  });
}
