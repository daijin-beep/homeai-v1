# homeAI Task Card Template

```md
# homeAI Task Card

## Task ID
...

## Title
...

## Risk tier
R0 / R1 / R2 / R3

## Goal
...

## Non-goals
- ...

## Implementation agent
Codex / Claude Code

## Review agent
Codex / Claude Code

## GPT gate required
yes / no

## Allowed files
- ...

## Forbidden files
- ...

## Space Truth impact
none / low / medium / high

## Schema/API impact
none / additive / breaking / unknown

## Render pipeline impact
none / low / medium / high

## Required tests
```bash
corepack pnpm typecheck
corepack pnpm test
corepack pnpm vitest tests/scope
```

## Additional targeted tests
- ...

## Acceptance criteria
- ...

## Merge policy
no-merge / auto-merge-if-green / gpt-gated-auto-merge-if-green

## Final report required
Use AGENTS.md final report format.
```
