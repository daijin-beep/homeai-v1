# Codex Task Template

## Goal

Implement:

`[specific task]`

## Context

Read first:

- `AGENTS.md`
- `docs/architecture/SYSTEM_ARCHITECTURE.md`
- `docs/architecture/DATA_CONTRACTS.md`
- `docs/ai/code_review.md`

## Constraints

- Do not bypass shared schemas.
- Do not let LLM providers write final geometry.
- Do not mutate confirmed floorplan geometry outside Space Truth Engine.
- Do not hardcode provider outputs in UI.
- Use provider interfaces.
- Keep V1 scope.
- Do not add PDF or construction communication.
- Add or update tests.
- Handle error boundaries.

## Done when

- Code compiles.
- Shared schema is updated if needed.
- Relevant tests pass.
- Error states are handled.
- V1 scope remains clean.
- Final summary includes changed files, commands run, tests run, known limitations, follow-up risks, and deviations.
