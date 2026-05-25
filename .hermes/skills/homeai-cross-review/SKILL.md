---
name: homeai-cross-review
description: Use when one coding agent implemented a homeAI task and the opposite agent must review it before merge.
---

# homeAI Cross Review

## Rule

Implementation and review must be separated.

```text
Codex implements → Claude Code reviews.
Claude Code implements → Codex reviews.
```

## Input required

- Task card.
- Branch and PR.
- Base branch.
- Changed files.
- Diff summary.
- Test output.
- Implementation report.
- Risk tier.

## Output required

Use standard homeAI review format from `AGENTS.md`.

## Escalate to GPT if

- Risk tier is R3.
- Reviewer and implementer disagree.
- Space Truth impact is unclear.
- Schema/API impact is breaking or unclear.
- Render traceability is unclear.
