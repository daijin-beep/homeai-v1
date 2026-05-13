# P1 Batch 03/04 Regression Audit

Date: 2026-05-13

Scope: regression audit for P1 Canvas Normal Mode and Advanced Settings + Re-entry UX. This document records current coverage and remaining gaps before Batch 05 hardening. It does not change production behavior.

## Batch 03 Coverage

| Behavior | Coverage |
|---|---|
| Canvas route loads draft from API | Covered by `tests/frontend/p1-canvas-ui.test.tsx`: draft load renders the SVG stage and fixture data. |
| UI avoids direct service/repository/store imports | Covered by UI source scan test and Batch 05 scope scan. |
| mm / px / cm transforms | Covered by `tests/frontend/p1-transform-utils.test.ts`. |
| Wall add / delete / resize / endpoint drag | Covered by Canvas UI tests. |
| Door add / delete / direction change | Covered by Canvas UI tests. |
| Window add / delete / type change | Covered by Canvas UI tests. |
| Bay window topology preservation | Covered by Canvas UI tests asserting walls remain unchanged. |
| Balcony add / delete / open-closed toggle | Covered by Canvas UI tests. |
| Room type change | Covered by Canvas UI tests asserting room geometry is preserved. |
| Validation display | Covered for unclosed boundary, orphan opening, detached balcony, and advanced value ranges. |
| Confirm flow | Covered for invalid confirm and valid confirm returning `geometryHash` plus `sceneContractId`. |

## Batch 04 Coverage

| Behavior | Coverage |
|---|---|
| Advanced settings default off | Covered by Canvas UI tests. |
| Advanced settings reset on remount | Covered by Canvas UI tests. |
| Advanced values persist when panel hidden | Covered for wall thickness; floor height and door dimensions are covered by direct operation persistence tests. |
| Wall thickness input persists as mm | Covered by Canvas UI tests. |
| Free wall creates segment operations | Covered by Canvas UI tests. |
| Arc-like input converts to deterministic polyline | Covered by transform utility tests and Canvas operation tests. |
| Floor height persists | Covered by Canvas UI tests and draft pipeline tests. |
| Door width / height persists | Covered by Canvas UI tests. |
| Re-entry notice appears after first edit | Covered by Canvas UI tests. |
| Re-entry notice is dismissible | Covered by Canvas UI tests. |
| Hash changed / unchanged summary | Covered by Canvas UI tests. |
| Scope scan excludes forbidden modules | Covered by Batch 05 release gate scope test. |

## Remaining Gaps Addressed In Batch 05

1. E2E-style P1 correction flows across API/services were not yet grouped in a single release-gate suite.
2. Keyboard shortcuts were not implemented in Batch 03/04.
3. Boundary recompute was available in the API but not automatically triggered by wall operations.
4. Debug payload did not expose compact scene contract metadata such as `sceneContractId`.
5. Persistence planning existed only as repository interfaces, not as a database mapping document.

## Current Risk

Risk is medium-low for internal testing after Batch 05 because the main write boundary is already API-only and the geometry invariants have tests. The remaining risk is mostly UX reliability and future storage migration, not Space Truth ownership.
