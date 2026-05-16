import type {
  SchemePageCoverageSummary,
  SchemePageRenderRoomStatus,
  SchemePageRenderStatusShell,
  SchemePageRoomCard,
  SchemePageViewModel,
  SchemePageWarning,
  SchemeRenderGalleryViewModel
} from "@homeai/contracts";
import { buildSchemePageRenderStatusShell } from "@homeai/scheme-page";
import { RoomRenderGallerySection } from "../scheme-render-gallery/RoomRenderGallerySection.js";

export function SchemePagePreview({
  viewModel,
  renderStatusShell,
  renderGalleryViewModel,
  showDebug = false
}: {
  viewModel: SchemePageViewModel;
  renderStatusShell?: SchemePageRenderStatusShell;
  renderGalleryViewModel?: SchemeRenderGalleryViewModel;
  showDebug?: boolean;
}) {
  const statusShell = renderStatusShell ?? buildSchemePageRenderStatusShell({
    viewModel,
    ...(renderGalleryViewModel === undefined ? {} : { renderGalleryViewModel })
  });

  return (
    <main data-testid="scheme-page-preview" style={shellStyle}>
      <SchemePageHeader viewModel={viewModel} />
      <SchemeCoverageBanner coverage={viewModel.coverage} />
      <SchemeRenderStatusShell shell={statusShell} />
      <SchemeBudgetStyleSummary viewModel={viewModel} />
      <SchemeWarningsPanel warnings={viewModel.warnings} />
      <section aria-label="Room schemes" style={roomGridStyle}>
        {viewModel.rooms.map((room) => (
          <RoomSchemeCard key={room.roomId} room={room} />
        ))}
      </section>
      {renderGalleryViewModel === undefined ? null : <RoomRenderGallerySection gallery={renderGalleryViewModel} />}
      {showDebug ? (
        <>
          <SchemeTracePanel viewModel={viewModel} />
          <DevJsonPanel value={viewModel} />
        </>
      ) : null}
    </main>
  );
}

export function SchemeRenderStatusShell({ shell }: { shell: SchemePageRenderStatusShell }) {
  return (
    <section
      data-testid="scheme-page-render-status-shell"
      data-source={shell.source}
      style={bandStyle}
    >
      <div style={sectionHeaderStyle}>
        <div>
          <p style={eyebrowStyle}>Render status</p>
          <h2 style={sectionTitleStyle}>Room visual readiness</h2>
        </div>
        <span data-testid="scheme-page-render-status-summary" style={statusStyle}>
          {shell.summary.status}
        </span>
      </div>
      <div data-testid="scheme-page-render-status-metrics" style={metricBandStyle}>
        <Metric label="Ready" value={shell.summary.roomsWithEligibleRender} />
        <Metric label="Pending" value={shell.summary.pendingRooms} />
        <Metric label="Review" value={shell.summary.roomsNeedingHumanReview} />
        <Metric label="Blocked" value={shell.summary.roomsFailed + shell.summary.roomsMissingCoverage} />
      </div>
      <div style={statusGridStyle}>
        {shell.rooms.map((room) => (
          <RenderRoomStatusItem key={room.roomId} room={room} />
        ))}
      </div>
    </section>
  );
}

function RenderRoomStatusItem({ room }: { room: SchemePageRenderRoomStatus }) {
  return (
    <div data-testid={`scheme-page-render-status-room-${room.roomId}`} style={renderRoomStatusStyle}>
      <div>
        <p style={eyebrowStyle}>{room.presentationDepth}</p>
        <strong>{room.roomLabel}</strong>
      </div>
      <span style={statusStyle}>{room.renderStatus}</span>
      <p style={mutedStyle}>
        {room.eligibleCandidateCount} ready / {room.warningCandidateCount} review / {room.blockedCandidateCount} blocked
      </p>
      {room.issues.length > 0 ? (
        <p style={warningTextStyle}>{room.issues.join(", ")}</p>
      ) : null}
    </div>
  );
}

export function SchemePageHeader({ viewModel }: { viewModel: SchemePageViewModel }) {
  return (
    <header data-testid="scheme-page-header" style={headerStyle}>
      <div>
        <p style={eyebrowStyle}>SchemeLite preview</p>
        <h1 style={titleStyle}>{viewModel.header.title}</h1>
        <p style={mutedStyle}>{viewModel.header.briefSummary}</p>
      </div>
      <span data-testid="scheme-status" style={statusStyle}>
        {viewModel.header.status}
      </span>
    </header>
  );
}

export function SchemeCoverageBanner({ coverage }: { coverage: SchemePageCoverageSummary }) {
  return (
    <section data-testid="scheme-coverage" style={bandStyle}>
      <Metric label="Rooms" value={coverage.totalRooms} />
      <Metric label="Primary" value={coverage.primaryRooms} />
      <Metric label="Standard" value={coverage.standardRooms} />
      <Metric label="Light" value={coverage.lightRooms} />
      <Metric label="Warnings" value={coverage.warningCount} />
      <Metric label="Fails" value={coverage.failCount} />
    </section>
  );
}

export function SchemeBudgetStyleSummary({ viewModel }: { viewModel: SchemePageViewModel }) {
  return (
    <section data-testid="scheme-budget-style" style={twoColumnStyle}>
      <div>
        <h2 style={sectionTitleStyle}>Budget</h2>
        <p style={mutedStyle}>{viewModel.budget.band} / {viewModel.budget.currency}</p>
        <p style={mutedStyle}>{viewModel.budget.notes.join(" ")}</p>
      </div>
      <div>
        <h2 style={sectionTitleStyle}>Style</h2>
        <p style={mutedStyle}>{viewModel.style.displayName}</p>
        <p style={mutedStyle}>{viewModel.style.tags.join(", ")}</p>
      </div>
    </section>
  );
}

export function RoomSchemeCard({ room }: { room: SchemePageRoomCard }) {
  return (
    <article data-testid={`scheme-room-card-${room.roomId}`} style={cardStyle}>
      <div style={roomHeaderStyle}>
        <div>
          <p style={eyebrowStyle}>{room.presentationDepth}</p>
          <h3 style={roomTitleStyle}>{room.roomLabel}</h3>
        </div>
        <span>{room.roomType}</span>
      </div>
      <p>{room.summary}</p>
      <h4 style={sectionTitleStyle}>Moves</h4>
      <ul>
        {room.keyMoves.map((move) => (
          <li key={move}>{move}</li>
        ))}
      </ul>
      <p data-testid={`scheme-room-trace-${room.roomId}`} style={mutedStyle}>
        {room.trace.geometryHash.slice(0, 18)}
      </p>
      <p style={mutedStyle}>Anchors: {room.anchorRefs.join(", ") || "none"}</p>
      {room.layoutIntentRefs?.length ? (
        <p style={mutedStyle}>Layout: {room.layoutIntentRefs.join(", ")}</p>
      ) : null}
      {room.warnings.length > 0 ? (
        <ul data-testid={`scheme-room-warnings-${room.roomId}`} style={warningListStyle}>
          {room.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

export function SchemeWarningsPanel({ warnings }: { warnings: SchemePageWarning[] }) {
  return (
    <section data-testid="scheme-warnings" style={bandStyle}>
      <h2 style={sectionTitleStyle}>Warnings</h2>
      {warnings.length === 0 ? (
        <p style={mutedStyle}>No warnings.</p>
      ) : (
        <ul>
          {warnings.map((warning) => (
            <li key={warning.warningId}>{warning.message}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function SchemeTracePanel({ viewModel }: { viewModel: SchemePageViewModel }) {
  return (
    <section data-testid="scheme-trace-panel" style={bandStyle}>
      <h2 style={sectionTitleStyle}>Trace</h2>
      <dl style={traceGridStyle}>
        <dt>homeId</dt>
        <dd>{viewModel.trace.homeId}</dd>
        <dt>floorplanRevisionId</dt>
        <dd>{viewModel.trace.floorplanRevisionId}</dd>
        <dt>sceneContractId</dt>
        <dd>{viewModel.trace.sceneContractId}</dd>
        <dt>geometryHash</dt>
        <dd>{viewModel.trace.geometryHash}</dd>
        <dt>layoutIntentHash</dt>
        <dd>{viewModel.trace.layoutIntentHash ?? "none"}</dd>
      </dl>
    </section>
  );
}

export function DevJsonPanel({ value }: { value: unknown }) {
  return (
    <section data-testid="scheme-debug-json" style={bandStyle}>
      <h2 style={sectionTitleStyle}>Debug JSON</h2>
      <pre style={jsonStyle}>{JSON.stringify(value, null, 2)}</pre>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div style={metricStyle}>
      <span style={eyebrowStyle}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const shellStyle = {
  display: "grid",
  gap: 16,
  padding: 24,
  fontFamily: "Arial, sans-serif",
  color: "#202124"
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  borderBottom: "1px solid #ddd",
  paddingBottom: 16
};

const titleStyle = {
  margin: "4px 0",
  fontSize: 28
};

const roomTitleStyle = {
  margin: "4px 0",
  fontSize: 18
};

const sectionTitleStyle = {
  margin: "0 0 8px",
  fontSize: 14
};

const eyebrowStyle = {
  margin: 0,
  fontSize: 12,
  textTransform: "uppercase" as const,
  color: "#6b7280"
};

const mutedStyle = {
  margin: 0,
  color: "#5f6368"
};

const statusStyle = {
  alignSelf: "flex-start",
  border: "1px solid #ddd",
  borderRadius: 6,
  padding: "6px 10px"
};

const bandStyle = {
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: 16,
  background: "#fff"
};

const twoColumnStyle = {
  ...bandStyle,
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 16
};

const roomGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 16
};

const cardStyle = {
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: 16,
  background: "#fff"
};

const roomHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12
};

const sectionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16
};

const metricBandStyle = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 12,
  marginBottom: 12
};

const statusGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12
};

const renderRoomStatusStyle = {
  display: "grid",
  gap: 8,
  border: "1px solid #eee",
  borderRadius: 8,
  padding: 12
};

const warningListStyle = {
  color: "#9a3412"
};

const warningTextStyle = {
  ...mutedStyle,
  color: "#9a3412"
};

const traceGridStyle = {
  display: "grid",
  gridTemplateColumns: "max-content 1fr",
  gap: "6px 12px"
};

const jsonStyle = {
  maxHeight: 360,
  overflow: "auto",
  padding: 12,
  background: "#f6f7f8"
};

const metricStyle = {
  display: "inline-grid",
  gap: 4,
  minWidth: 96,
  marginRight: 16
};
