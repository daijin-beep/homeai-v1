---
name: homeai-merge-gate
description: Use before any homeAI PR merge. Enforces deterministic tests, cross-review, GPT gate where required, no secrets/network/real-provider violations, and Space Truth safety.
---

# homeAI Merge Gate

## Required sequence

1. Confirm task card and risk tier.
2. Confirm implementation report.
3. Confirm cross-review report.
4. Confirm GPT gate if R3.
5. Run deterministic checks after final changes.
6. Check red-zone diff.
7. Check secrets and unauthorized network calls.
8. Check real provider status.
9. Decide merge or block.
10. If merge allowed, execute `gh pr merge`.

## Block conditions

See `.hermes/workflows/03_AUTOMATED_MERGE_POLICY.md`.

## Output required

```md
# homeAI Merge Gate Report

## Decision
merge / block

## PR
...

## Risk tier
...

## Gate results
| Gate | Result |
|---|---|
| typecheck | |
| full tests | |
| scope tests | |
| cross-review | |
| GPT gate | |
| red-zone diff | |
| secrets scan | |
| network scan | |
| real provider status | |

## Merge command
...

## Final report sent to WeChat
yes / no
```
