import { notFound } from "next/navigation.js";
import {
  SchemeRenderGalleryScenarios,
  buildSchemeRenderGalleryDebugFixture,
  type RenderLifecycleScenario
} from "@homeai/render-pipeline";
import { buildSchemePageViewModelFromSchemeLite } from "@homeai/scheme-page";
import { SchemePagePreview } from "../../../components/scheme-page/SchemePagePreview.js";
import { RoomRenderGallerySection } from "../../../components/scheme-render-gallery/RoomRenderGallerySection.js";

export default function RenderGalleryDebugPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  if (isDevPageDisabledInProduction()) {
    notFound();
  }

  const scenario = scenarioFromSearchParams(searchParams);
  const debug = buildSchemeRenderGalleryDebugFixture(scenario);
  const schemePageViewModel = buildSchemePageViewModelFromSchemeLite(debug.schemeLiteContract);

  return (
    <main style={shellStyle}>
      <section style={panelStyle}>
        <p style={eyebrowStyle}>Contract-only preview</p>
        <h1 style={titleStyle}>Scheme Render Gallery Debug</h1>
        <p>Scenario: {scenario}</p>
      </section>
      <section style={panelStyle}>
        <h2 style={sectionTitleStyle}>Scenario Switcher</h2>
        <div style={linkGridStyle}>
          {SchemeRenderGalleryScenarios.map((candidate) => (
            <a key={candidate} href={`/dev/render-gallery-debug?scenario=${candidate}`}>
              {candidate}
            </a>
          ))}
        </div>
      </section>
      <section style={panelStyle}>
        <h2 style={sectionTitleStyle}>Input Summary</h2>
        <dl style={traceGridStyle}>
          <dt>homeId</dt>
          <dd>{debug.inputSummary.homeId}</dd>
          <dt>floorplanRevisionId</dt>
          <dd>{debug.inputSummary.floorplanRevisionId}</dd>
          <dt>sceneContractId</dt>
          <dd>{debug.inputSummary.sceneContractId}</dd>
          <dt>geometryHash</dt>
          <dd>{debug.inputSummary.geometryHash}</dd>
          <dt>validRoomCount</dt>
          <dd>{debug.inputSummary.validRoomCount}</dd>
        </dl>
      </section>
      <RoomRenderGallerySection gallery={debug.galleryViewModel} />
      <section style={panelStyle}>
        <h2 style={sectionTitleStyle}>Scheme Page Integration</h2>
        <SchemePagePreview
          viewModel={schemePageViewModel}
          renderGalleryViewModel={debug.galleryViewModel}
          showDebug
        />
      </section>
      <section style={panelStyle}>
        <h2 style={sectionTitleStyle}>Scope Guard</h2>
        <dl style={traceGridStyle}>
          {Object.entries(debug.scopeGuard).map(([key, value]) => (
            <div key={key} style={contentsStyle}>
              <dt>{key}</dt>
              <dd>{String(value)}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section style={panelStyle}>
        <h2 style={sectionTitleStyle}>Debug JSON</h2>
        <pre style={jsonStyle}>{JSON.stringify(debug, null, 2)}</pre>
      </section>
    </main>
  );
}

function scenarioFromSearchParams(
  searchParams: Record<string, string | string[] | undefined> | undefined
): RenderLifecycleScenario {
  const rawScenario = Array.isArray(searchParams?.scenario) ? searchParams?.scenario[0] : searchParams?.scenario;
  if (rawScenario !== undefined && SchemeRenderGalleryScenarios.includes(rawScenario as RenderLifecycleScenario)) {
    return rawScenario as RenderLifecycleScenario;
  }
  return "all_pass";
}

function isDevPageDisabledInProduction(): boolean {
  return process.env.NODE_ENV === "production" && process.env.ENABLE_DEV_ROUTES !== "true";
}

const shellStyle = {
  display: "grid",
  gap: 16,
  padding: 24,
  fontFamily: "Arial, sans-serif",
  color: "#202124"
};

const panelStyle = {
  padding: 16,
  border: "1px solid #ddd",
  borderRadius: 8,
  background: "#fff"
};

const titleStyle = {
  margin: "4px 0",
  fontSize: 28
};

const sectionTitleStyle = {
  margin: "0 0 8px",
  fontSize: 16
};

const eyebrowStyle = {
  margin: 0,
  fontSize: 12,
  textTransform: "uppercase" as const,
  color: "#6b7280"
};

const traceGridStyle = {
  display: "grid",
  gridTemplateColumns: "max-content 1fr",
  gap: "6px 12px"
};

const linkGridStyle = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 12
};

const contentsStyle = {
  display: "contents"
};

const jsonStyle = {
  maxHeight: 420,
  overflow: "auto",
  padding: 12,
  background: "#f6f7f8"
};
