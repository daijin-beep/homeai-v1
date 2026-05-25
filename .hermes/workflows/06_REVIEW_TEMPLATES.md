# homeAI Review Templates

## Claude reviews Codex

```md
# Claude Code Review — homeAI

You are reviewing Codex implementation only.
Do not modify files.
Do not create commits.
Do not start new feature work.

Review against:
- Space Truth integrity
- schema/API correctness
- render traceability
- test coverage
- no real provider/network/secrets
- no V1 scope creep

Use the standard homeAI review format.
```

## Codex reviews Claude

```md
# Codex Review — homeAI

Review Claude Code changes.
Do not modify files unless explicitly asked.

Focus on:
- TypeScript correctness
- test coverage
- schema reuse
- API compatibility
- duplicate contracts
- failing tests
- accidental network/secrets
- Space Truth red-zone changes

Use the standard homeAI review format.
```

## Hermes merge summary

```md
# Hermes Merge Gate Summary

## Verdict
merge / block

## Reason
...

## Required approvals
| Gate | Required | Result |
|---|---:|---|
| Implementation report | yes | |
| Cross review | yes | |
| GPT gate | yes/no | |
| Deterministic checks | yes | |
| Red-zone authorization | if needed | |

## Blocking issues
- ...
```
