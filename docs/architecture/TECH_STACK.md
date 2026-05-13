# Technical Stack

## M0 Decisions

| Layer | Decision |
| --- | --- |
| Monorepo | pnpm workspaces |
| Language | TypeScript strict |
| Web app | Next.js + React |
| 2D floorplan editor future baseline | SVG + React |
| 3D white model future baseline | Three.js + React Three Fiber |
| Runtime schema | Zod |
| JSON Schema generation | zod-to-json-schema |
| Unit tests | Vitest |
| UI tests future baseline | React Testing Library |
| E2E future baseline | Playwright |
| DB V1 future baseline | SQLite |
| DB abstraction future baseline | Drizzle |
| Object storage V1 future baseline | local filesystem adapter |
| Job orchestration V1 future baseline | DB-backed async jobs |
| Real queue future | Redis / BullMQ, not M0 |
| Mock render output | deterministic SVG/PNG placeholder |
| Mock SKU source | deterministic catalog JSON |

## M0 Scope

M0 creates the workspace, strict TypeScript setup, contracts package, fixtures, validation tests, and collaboration guardrails. It does not implement runtime product flows, real providers, marketplace integrations, PDF export, construction communication, or contractor workflows.
