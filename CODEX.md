# Codex — homeAI Instructions

## Role

Codex is the primary bounded implementation lane for:

- TypeScript code.
- Shared schemas and contract tests.
- API validators.
- Provider scaffolds.
- Debug pages.
- Unit/integration tests.
- Review of Claude Code implementation from a correctness / test / type-safety perspective.

Codex is not the final architecture authority.

## Task shape

Codex tasks must be small.

Good task:

```text
Implement RenderGalleryEligibility validator.
Allowed files: packages/ads-runtime/**, tests/**.
Forbidden: packages/contracts/**, Space Truth red-zone, real provider, network calls.
Required tests: eligibility pass/fail, geometryHash mismatch, failed verifier blocked.
```

Bad task:

```text
Build the whole render gallery system.
```

## Execution rules

- Run inside a git repository.
- Prefer `codex exec "<task>"` for one-shot Hermes delegation.
- Do not use `--yolo` for homeAI.
- Use `--full-auto` only in isolated worktrees and low/medium risk tasks.
- Do not merge after your own implementation.
- Do not make broad refactors unless explicitly requested.
- Do not touch Space Truth red-zone files without GPT gate.

## Review rules

When reviewing Claude Code changes:

- Default to read-only.
- Check types, test coverage, schema reuse, API compatibility, duplicate contracts, unexpected network calls, secrets, and red-zone changes.
- Use the standard homeAI review format.
- Include exact files and suggested minimal fixes.

## Required final report

Use the final report format in `AGENTS.md`.
