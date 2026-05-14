import type {
  RenderCandidateBlockSummary,
  RenderCandidateCardViewModel,
  RoomRenderGalleryViewModel,
  SchemeRenderGalleryViewModel
} from "@homeai/contracts";

export function RoomRenderGallerySection({ gallery }: { gallery: SchemeRenderGalleryViewModel }) {
  return (
    <section data-testid="scheme-render-gallery-section" style={sectionStyle}>
      <div style={sectionHeaderStyle}>
        <div>
          <p style={eyebrowStyle}>Render gallery</p>
          <h2 style={titleStyle}>Room render status</h2>
        </div>
        <span data-testid="scheme-render-gallery-summary-status" style={statusStyle}>
          {gallery.summary.status}
        </span>
      </div>
      <GallerySummary gallery={gallery} />
      <RoomStatusTable rooms={gallery.rooms} />
      <EligibleCandidateGrid rooms={gallery.rooms} />
      <BlockedCandidateList rooms={gallery.rooms} />
      <HumanReviewCandidateList rooms={gallery.rooms} />
    </section>
  );
}

function GallerySummary({ gallery }: { gallery: SchemeRenderGalleryViewModel }) {
  return (
    <div data-testid="scheme-render-gallery-summary" style={metricBandStyle}>
      <Metric label="Rooms" value={gallery.summary.totalRooms} />
      <Metric label="Eligible" value={gallery.summary.eligibleCandidateCount} />
      <Metric label="Blocked" value={gallery.summary.blockedCandidateCount} />
      <Metric label="Review" value={gallery.summary.warningCandidateCount} />
      <Metric label="Missing coverage" value={gallery.summary.roomsMissingCoverage} />
    </div>
  );
}

function RoomStatusTable({ rooms }: { rooms: RoomRenderGalleryViewModel[] }) {
  return (
    <table data-testid="scheme-render-gallery-room-table" style={tableStyle}>
      <thead>
        <tr>
          <th>roomId</th>
          <th>roomDisplayName</th>
          <th>roomType</th>
          <th>renderStatus</th>
          <th>eligibleCandidateCount</th>
          <th>blockedCandidateCount</th>
          <th>warningCandidateCount</th>
          <th>issues</th>
        </tr>
      </thead>
      <tbody>
        {rooms.map((room) => (
          <tr key={room.roomId} data-testid={`scheme-render-gallery-room-${room.roomId}`}>
            <td>{room.roomId}</td>
            <td>{room.roomDisplayName}</td>
            <td>{room.roomType}</td>
            <td>{room.renderStatus}</td>
            <td>{room.eligibleCandidateCount}</td>
            <td>{room.blockedCandidateCount}</td>
            <td>{room.warningCandidateCount}</td>
            <td>{room.issues.join(", ") || "none"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EligibleCandidateGrid({ rooms }: { rooms: RoomRenderGalleryViewModel[] }) {
  const candidates = rooms.flatMap((room) => room.eligibleCandidates);
  return (
    <section data-testid="scheme-render-gallery-eligible-candidates" style={subsectionStyle}>
      <h3 style={subsectionTitleStyle}>Eligible cards</h3>
      {candidates.length === 0 ? (
        <p style={mutedStyle}>No eligible candidates.</p>
      ) : (
        <div style={cardGridStyle}>
          {candidates.map((candidate) => (
            <EligibleCandidateCard key={candidate.renderCandidateId} candidate={candidate} />
          ))}
        </div>
      )}
    </section>
  );
}

function EligibleCandidateCard({ candidate }: { candidate: RenderCandidateCardViewModel }) {
  return (
    <article data-testid={`eligible-render-card-${candidate.renderCandidateId}`} style={candidateCardStyle}>
      <p style={eyebrowStyle}>{candidate.roomId}</p>
      <h4 style={candidateTitleStyle}>{candidate.renderCandidateId}</h4>
      <p style={mutedStyle}>{candidate.imageUrl}</p>
      <p style={mutedStyle}>{candidate.geometryHash.slice(0, 18)}</p>
    </article>
  );
}

function BlockedCandidateList({ rooms }: { rooms: RoomRenderGalleryViewModel[] }) {
  const candidates = rooms.flatMap((room) => room.blockedCandidates);
  return (
    <CandidateList
      testId="scheme-render-gallery-blocked-candidates"
      title="Blocked candidates"
      candidates={candidates}
    />
  );
}

function HumanReviewCandidateList({ rooms }: { rooms: RoomRenderGalleryViewModel[] }) {
  const candidates = rooms.flatMap((room) => room.warningCandidates);
  return (
    <CandidateList
      testId="scheme-render-gallery-review-candidates"
      title="Human review candidates"
      candidates={candidates}
    />
  );
}

function CandidateList({
  testId,
  title,
  candidates
}: {
  testId: string;
  title: string;
  candidates: RenderCandidateBlockSummary[];
}) {
  return (
    <section data-testid={testId} style={subsectionStyle}>
      <h3 style={subsectionTitleStyle}>{title}</h3>
      {candidates.length === 0 ? (
        <p style={mutedStyle}>None.</p>
      ) : (
        <ul>
          {candidates.map((candidate) => (
            <li key={`${candidate.renderCandidateId}-${candidate.status}`}>
              <strong>{candidate.renderCandidateId}</strong> / {candidate.status}: {candidate.reasons.join(", ")}
            </li>
          ))}
        </ul>
      )}
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

const sectionStyle = {
  display: "grid",
  gap: 16,
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: 16,
  background: "#fff"
};

const sectionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16
};

const titleStyle = {
  margin: "4px 0",
  fontSize: 20
};

const subsectionTitleStyle = {
  margin: "0 0 8px",
  fontSize: 14
};

const candidateTitleStyle = {
  margin: "4px 0",
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
  color: "#5f6368",
  overflowWrap: "anywhere" as const
};

const statusStyle = {
  alignSelf: "flex-start",
  border: "1px solid #ddd",
  borderRadius: 6,
  padding: "6px 10px"
};

const metricBandStyle = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 12,
  border: "1px solid #eee",
  borderRadius: 8,
  padding: 12
};

const metricStyle = {
  display: "inline-grid",
  gap: 4,
  minWidth: 120
};

const subsectionStyle = {
  display: "grid",
  gap: 8
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse" as const
};

const cardGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12
};

const candidateCardStyle = {
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: 12
};
