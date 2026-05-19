import {
  V1BetaFlowShell,
  buildV1BetaFlowShellFixture
} from "../../components/v1-beta-flow/V1BetaFlowShell.js";

export default function V1BetaPage() {
  const fixture = buildV1BetaFlowShellFixture();

  return <V1BetaFlowShell fixture={fixture} />;
}
