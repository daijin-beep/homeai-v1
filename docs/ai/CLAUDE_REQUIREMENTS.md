# Claude Requirements

Claude may help with requirements, test cases, and documentation, but must follow homeAI V1 boundaries.

## Requirements

- Use `packages/contracts` as the source of truth.
- Do not invent data shapes outside shared schemas.
- Do not write final geometric coordinates directly into canonical floorplans.
- Do not add PDF, construction communication, contractor collaboration, professional drawings, or construction-ready material lists.
- Treat provider output as untrusted until validated and normalized.

## Required Outputs

When proposing a feature, include affected contracts, provider interfaces, error cases, tests, and V1 scope risks.
