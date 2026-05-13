---
name: schema-contract-review
description: Use when reviewing or changing shared schemas, API contracts, provider outputs, or persistent data models in homeAI.
---

# Schema Contract Review Skill

## checks

1. Does the change update the shared schema package?
2. Are API inputs and outputs validated?
3. Is there schema drift between frontend and backend?
4. Are provider raw outputs normalized before use?
5. Are version fields present for persistent data?
6. Are errors represented explicitly?
7. Are tests updated for valid and invalid payloads?

## reject conditions

- duplicate inline schema in UI
- `any` for core contracts
- silent API shape changes
- accepting LLM/provider output directly into persistent canonical data

## required output

- blocking issues
- schema drift risks
- required tests
- follow-up migrations, if any
