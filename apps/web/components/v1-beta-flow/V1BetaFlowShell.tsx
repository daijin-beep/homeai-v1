import type {
  SchemePageRenderStatusShell,
  SchemePageViewModel,
  SchemeRenderGalleryViewModel,
  V1BetaFlowStage,
  V1BetaFlowViewModel,
} from "@homeai/contracts";
import { V1BetaFlowViewModelSchema } from "@homeai/contracts";
import {
  buildSchemePageRenderStatusShell,
  buildSchemePageViewModelFromSchemeLite,
} from "@homeai/scheme-page";
import { buildSchemeRenderGalleryDebugFixture } from "@homeai/render-pipeline";
import { SchemePagePreview } from "../scheme-page/SchemePagePreview.js";

export type V1BetaFlowShellFixture = {
  flow: V1BetaFlowViewModel;
  schemePageViewModel: SchemePageViewModel;
  renderStatusShell: SchemePageRenderStatusShell;
  renderGalleryViewModel: SchemeRenderGalleryViewModel;
};

export function buildV1BetaFlowShellFixture(): V1BetaFlowShellFixture {
  const renderDebug = buildSchemeRenderGalleryDebugFixture(
    "one_anchor_zone_warning",
  );
  const schemePageViewModel = buildSchemePageViewModelFromSchemeLite(
    renderDebug.schemeLiteContract,
    { title: "homeAI V1 Beta" },
  );
  const renderStatusShell = buildSchemePageRenderStatusShell({
    viewModel: schemePageViewModel,
    renderGalleryViewModel: renderDebug.galleryViewModel,
  });
  const stages = buildStages({
    roomCount: schemePageViewModel.coverage.totalRooms,
    readyRoomCount: renderStatusShell.summary.roomsWithEligibleRender,
    renderIssueCount:
      renderStatusShell.summary.roomsNeedingHumanReview +
      renderStatusShell.summary.roomsFailed,
    renderCandidateCount: renderStatusShell.summary.eligibleCandidateCount,
  });
  const flow = V1BetaFlowViewModelSchema.parse({
    version: "0.1",
    source: "deterministic_fixture",
    homeId: renderDebug.schemeLiteContract.homeId,
    schemeId: renderDebug.schemeLiteContract.schemeId,
    floorplanRevisionId: renderDebug.schemeLiteContract.floorplanRevisionId,
    sceneContractId: renderDebug.sceneContract.sceneContractId,
    geometryHash: renderDebug.sceneContract.geometryHash,
    title: "homeAI V1 Beta flow",
    summary: buildFlowSummary(stages),
    stages,
    guardrails: {
      deterministicFixturesOnly: true,
      adsRuntimeConsumed: false,
      realProviderEnabled: false,
      networkCallsEnabled: false,
      confirmedGeometryMutable: false,
      downstreamCommerceEnabled: false,
    },
    generatedAt: schemePageViewModel.generatedAt,
  });

  return deepFreeze({
    flow,
    schemePageViewModel,
    renderStatusShell,
    renderGalleryViewModel: renderDebug.galleryViewModel,
  });
}

export function V1BetaFlowShell({
  fixture = buildV1BetaFlowShellFixture(),
  showDebug = false,
}: {
  fixture?: V1BetaFlowShellFixture;
  showDebug?: boolean;
}) {
  return (
    <main data-testid="v1-beta-flow-shell" style={shellStyle}>
      <section style={headerStyle}>
        <div>
          <p style={eyebrowStyle}>User beta flow</p>
          <h1 style={titleStyle}>{fixture.flow.title}</h1>
          <p style={mutedStyle}>
            Deterministic preview from confirmed-space, scheme, and
            render-status view models.
          </p>
        </div>
        <span data-testid="v1-beta-flow-status" style={statusStyle}>
          {fixture.flow.summary.status}
        </span>
      </section>

      <section data-testid="v1-beta-flow-stage-panel" style={panelStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitleStyle}>Flow stages</h2>
          <p style={mutedStyle}>
            {fixture.flow.summary.completeStages} complete /{" "}
            {fixture.flow.summary.lockedStages} locked
          </p>
        </div>
        <div style={stageGridStyle}>
          {fixture.flow.stages.map((stage) => (
            <StageItem key={stage.stageId} stage={stage} />
          ))}
        </div>
      </section>

      <section data-testid="v1-beta-flow-guardrails" style={panelStyle}>
        <h2 style={sectionTitleStyle}>Guardrails</h2>
        <dl style={guardrailGridStyle}>
          {Object.entries(fixture.flow.guardrails).map(([key, value]) => (
            <div key={key} style={contentsStyle}>
              <dt>{key}</dt>
              <dd>{String(value)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <SchemePagePreview
        viewModel={fixture.schemePageViewModel}
        renderStatusShell={fixture.renderStatusShell}
        renderGalleryViewModel={fixture.renderGalleryViewModel}
        showDebug={showDebug}
      />

      {showDebug ? (
        <section data-testid="v1-beta-flow-debug-json" style={panelStyle}>
          <h2 style={sectionTitleStyle}>Debug JSON</h2>
          <pre style={jsonStyle}>{JSON.stringify(fixture.flow, null, 2)}</pre>
        </section>
      ) : null}
    </main>
  );
}

function StageItem({ stage }: { stage: V1BetaFlowStage }) {
  return (
    <article
      data-testid={`v1-beta-flow-stage-${stage.stageId}`}
      style={stageStyle}
    >
      <div style={stageHeaderStyle}>
        <h3 style={stageTitleStyle}>{stage.label}</h3>
        <span style={statusStyle}>{stage.status}</span>
      </div>
      <p style={mutedStyle}>{stage.summary}</p>
      <p style={mutedStyle}>
        {stage.itemCount ?? 0} items / {stage.issueCount ?? 0} issues
      </p>
      {stage.primaryHref === undefined ? null : (
        <a href={stage.primaryHref} style={linkStyle}>
          Open
        </a>
      )}
    </article>
  );
}

function buildStages(input: {
  roomCount: number;
  readyRoomCount: number;
  renderIssueCount: number;
  renderCandidateCount: number;
}): V1BetaFlowStage[] {
  return [
    {
      stageId: "floorplan_upload",
      status: "complete",
      label: "Floorplan upload",
      summary: "Fixture floorplan is available for the beta shell.",
      primaryHref: "/p1/home-scheme-page-fixture",
      itemCount: 1,
      issueCount: 0,
    },
    {
      stageId: "space_confirmation",
      status: "complete",
      label: "Space confirmation",
      summary: "Confirmed geometry trace is read-only downstream.",
      itemCount: input.roomCount,
      issueCount: 0,
    },
    {
      stageId: "scheme_review",
      status: "complete",
      label: "Scheme review",
      summary: "Full-space SchemeLite preview is ready.",
      primaryHref: "/dev/scheme-page-debug",
      itemCount: input.roomCount,
      issueCount: 0,
    },
    {
      stageId: "render_review",
      status: "current",
      label: "Room visual review",
      summary:
        "Render-status shell is driven by deterministic gallery view models.",
      primaryHref: "/dev/render-gallery-debug",
      itemCount: input.renderCandidateCount,
      issueCount: input.renderIssueCount,
    },
    {
      stageId: "decor_matching",
      status: "locked",
      label: "Decor matching",
      summary: "Locked until verified local catalog admission is implemented.",
      itemCount: 0,
      issueCount: 0,
    },
    {
      stageId: "conversion_intent",
      status: "locked",
      label: "Conversion intent",
      summary: "Locked until explicit mock conversion actions are implemented.",
      itemCount: 0,
      issueCount: 0,
    },
  ];
}

function buildFlowSummary(
  stages: readonly V1BetaFlowStage[],
): V1BetaFlowViewModel["summary"] {
  const completeStages = stages.filter(
    (stage) => stage.status === "complete",
  ).length;
  const readyStages = stages.filter((stage) => stage.status === "ready").length;
  const lockedStages = stages.filter(
    (stage) => stage.status === "locked",
  ).length;
  const needsReviewStages = stages.filter(
    (stage) => stage.status === "needs_review",
  ).length;
  const currentStage = stages.find((stage) => stage.status === "current");
  if (currentStage === undefined) {
    throw new Error("Expected exactly one current V1 Beta flow stage.");
  }

  return {
    totalStages: stages.length,
    completeStages,
    readyStages,
    lockedStages,
    needsReviewStages,
    currentStageId: currentStage.stageId,
    status: stages.some((stage) => (stage.issueCount ?? 0) > 0)
      ? "needs_review"
      : "in_progress",
  };
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const key of Reflect.ownKeys(value)) {
    deepFreeze((value as Record<PropertyKey, unknown>)[key]);
  }
  return Object.freeze(value);
}

const shellStyle = {
  display: "grid",
  gap: 16,
  padding: 24,
  fontFamily: "Arial, sans-serif",
  color: "#202124",
  background: "#f8fafc",
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  paddingBottom: 16,
  borderBottom: "1px solid #d9dee5",
};

const titleStyle = {
  margin: "4px 0",
  fontSize: 30,
};

const sectionTitleStyle = {
  margin: 0,
  fontSize: 16,
};

const stageTitleStyle = {
  margin: 0,
  fontSize: 15,
};

const eyebrowStyle = {
  margin: 0,
  fontSize: 12,
  textTransform: "uppercase" as const,
  color: "#667085",
};

const mutedStyle = {
  margin: 0,
  color: "#5f6368",
};

const panelStyle = {
  display: "grid",
  gap: 12,
  border: "1px solid #d9dee5",
  borderRadius: 8,
  padding: 16,
  background: "#fff",
};

const sectionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
};

const stageGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const stageStyle = {
  display: "grid",
  gap: 8,
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  padding: 12,
  background: "#fff",
};

const stageHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
};

const statusStyle = {
  alignSelf: "flex-start",
  border: "1px solid #d9dee5",
  borderRadius: 6,
  padding: "5px 8px",
  background: "#fff",
};

const guardrailGridStyle = {
  display: "grid",
  gridTemplateColumns: "max-content 1fr",
  gap: "6px 12px",
  margin: 0,
};

const contentsStyle = {
  display: "contents",
};

const jsonStyle = {
  maxHeight: 360,
  overflow: "auto",
  padding: 12,
  background: "#f6f7f8",
};

const linkStyle = {
  justifySelf: "start",
  color: "#1a73e8",
};
