# V1 Beta Release Gate

This document records the deterministic release gate for the stacked Codex V1 Beta batches.

## Scope

- The release gate is based on `@homeai/v1-beta-fixtures`.
- The gate uses deterministic local fixtures only.
- The gate does not consume Claude Track B ADS runtime internals.
- The gate does not call render snapshot or human review API routes.
- The gate does not enable real providers, provider SDKs, network calls, or live commerce.
- The gate does not mutate confirmed geometry or Space Truth.
- The gate does not add PDF export or construction workflows.

## Command

Run the focused release gate:

```bash
corepack pnpm release:beta:check
```

The full batch gate remains:

```bash
corepack pnpm typecheck
corepack pnpm test
corepack pnpm exec vitest run tests/scope
git diff --check
```

## Required Checks

- Fixture harness schema is valid.
- Fixture harness guardrails are all deterministic and local.
- Render status covers every Scheme Page room.
- CreativeRenderSpec fixtures cover every Scheme Page room.
- Render gallery fixture has no failed or missing room coverage.
- VerifiedSku admission yields local fixture SKUs.
- Soft Decor GPS Lite covers every Scheme Page room.
- Conversion intent includes only mock conversion actions and `payment_started_mock` events.
- Hard stop count is zero.

## Stacking

Batch 24 is stacked on `codex/batch23-beta-fixture-harness`.

Open this branch against `codex/batch23-beta-fixture-harness` unless all earlier stacked batches have already merged.
