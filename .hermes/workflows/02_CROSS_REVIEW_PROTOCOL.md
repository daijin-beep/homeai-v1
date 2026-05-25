# homeAI Cross-Review Protocol

## Rule

No agent may be the sole implementer and sole reviewer of its own code.

## Standard lanes

```text
Codex implements → Claude Code reviews → Hermes gates → AI merge if green.
Claude Code implements → Codex reviews → Hermes gates → AI merge if green.
R3 task → implementation → opposite review → GPT gate → Hermes gates → AI merge if green.
```

## Codex implementation lane

Use for:

- TypeScript implementation.
- Schema validators.
- API handlers.
- Debug pages.
- Tests.
- Provider scaffolds.

Review by Claude Code for:

- Module boundaries.
- Architectural leakage.
- Readability.
- UX impact.
- Scope creep.

## Claude implementation lane

Use for:

- PR handoff cleanup.
- Complex codebase reading.
- UX copy / user-facing explanations.
- Refactors where readability is primary.

Review by Codex for:

- TypeScript correctness.
- Tests.
- Schema reuse.
- Accidental runtime breakage.
- Network/secrets scans.

## Review packet input

Hermes must provide reviewer with:

```text
Task card
Branch
Base branch
Changed files
Diff summary
Test output
Implementation final report
Risk tier
Known constraints
```

## Review output

Reviewer must use the standard homeAI review format from `AGENTS.md`.

## Conflict resolution

If Codex and Claude disagree:

```text
1. Hermes summarizes disagreement.
2. If risk is R0-R1, Hermes may request one minimal fix pass.
3. If risk is R2, Hermes may request one more review pass.
4. If risk is R3 or unresolved, Hermes must escalate to GPT gate.
```
