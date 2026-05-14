# Real Provider Spike Gate — Blocked Report

## Status

🔒 **BLOCKED.** Real provider invocation is disabled by default.

The recovery task card §10 lists every gate that must pass before any
real (non-mock, non-stub) image provider may be invoked. As of this
commit none of the cost / license / data-retention / credential gates
are clear, and no `realProviderEnabled=true` runtime flag exists. The
disabled scaffold (`DisabledRealProviderAdapter`) throws on every call.

## Gate matrix

The matrix is evaluated programmatically by
`evaluateRealProviderSpikeGate({ ... })` in
`packages/ads-runtime/src/policy/real-provider-spike-gate.ts`. Every
row must read **PASS** for the scaffold's `generate()` to even reach a
"gate passed but adapter not present" rejection; current status is
**BLOCKED**.

| Gate id | Description | Current status | Owner / action needed |
|---|---|---|---|
| `policy_status` | `RenderProviderPolicy.status` is `allowed_for_spike` or `allowed_for_production` | FAIL (default policies are `blocked` or `allowed_for_mock`/`allowed_for_bakeoff`) | Kim signs ADS-OI-006 + creates a new spike policy |
| `commercial_use_documented` | `policy.commercialUseStatus` ∈ `allowed` \| `restricted` | FAIL (default `unknown`) | Kim / legal — fill in Cost & Compliance Settings → 版权策略 |
| `data_retention_documented` | `policy.dataRetentionStatus` ∈ `acceptable` \| `restricted` | FAIL (default `unknown`) | Kim / legal |
| `copyright_risk_known` | `policy.copyrightRisk` ≠ `unknown` | FAIL (default `unknown`) | Kim / legal (ADS-OI-007) |
| `max_cost_set` | `policy.maxEstimatedCostCentsPerCandidate` ≥ 0 | PASS (numeric defaults exist) but needs Kim's real-value review |
| `timeout_set` | `policy.timeoutMs` > 0 | PASS |
| `retry_limit_set` | `policy.maxAttemptsPerJob` > 0 | PASS |
| `creative_render_spec_freeze` | `CreativeRenderSpec` freeze ref supplied | DEFERRED (Codex Batch 09 compiler is live but a named freeze ref / ADS-OI-001 decision is still proposed) |
| `render_verifier_l1` | `@homeai/render-verifier` L1 baseline implemented | PASS (this branch, commit 3) |
| `fail_render_blocked_from_gallery` | gallery admission refuses fail-status reports | PASS (`evaluateGalleryEligibility` rejects fail-status reports → `blocked_failed_verification`) |
| `provider_trace_implemented` | canonical `RenderTrace` populated on every candidate | PASS (mock + stub adapters populate it) |
| `secrets_not_committed` | no provider credentials in repo | PASS (no provider integration code exists yet; CI lint can re-check on real provider PR) |
| `real_provider_enabled_flag` | runtime flag `realProviderEnabled === true` | FAIL (default `false`) |

## What's allowed today

Only the mock + stub adapters in `@homeai/ads-runtime/src/adapters/` may
run. They never call the network and always populate a canonical
`RenderTrace` with `networkCalls: false`. The bakeoff harness only
schedules providers whose policy is `allowed_for_mock` or
`allowed_for_bakeoff`.

## What's needed to unblock

1. **Kim Decision Log entries** for ADS-OI-006 (cost / timeout /
   provider allowlist) and ADS-OI-007 (commercial-use / copyright).
2. **Cost & Compliance Settings** Notion page filled in: 单户渲染成本上限,
   超时阈值, allowed providers, 版权策略.
3. **GPT Pro design** for the real-provider adapter shape (env-based
   credentials, request shaping, response normalization to canonical
   `RenderCandidate`, latency / cost reporting populated on `RenderTrace`).
4. **CreativeRenderSpec freeze** — ADS-OI-001 decision recorded, a
   versioned freeze ref attached to the policy.
5. **CI guard** — a scope/scan test that proves no real-provider source
   path can be reached unless `realProviderEnabled === true` AND the
   gate matrix is `allRequiredGatesPassed: true`.

## How to enable the spike (future, not in this commit)

When all of the above land:

1. Add a `policy-real-provider-spike.json` fixture with
   `status: "allowed_for_spike"`, fully-documented commercial /
   retention / copyright fields.
2. Wire the runtime to read `process.env.HOMEAI_ADS_REAL_PROVIDER_ENABLED === "true"`
   and only then pass `realProviderEnabled: true` into the gate input.
3. Replace `DisabledRealProviderAdapter` with the real adapter that
   reads credentials from a secret store, calls the provider, populates
   `RenderTrace.providerCalls` with actual latency / cost, and parses
   the response into a canonical `RenderCandidate`.
4. Add a Decision Log entry stamping the spike's lifecycle.
5. Open a Track A/B joint Open Interface Issue if any new canonical
   field is required.

Until then, **the disabled scaffold remains the only real-provider
surface, and it always throws**.
