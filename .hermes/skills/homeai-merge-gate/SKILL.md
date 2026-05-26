---
name: homeai-merge-gate
description: Use before any homeAI PR merge. Enforces deterministic tests, cross-review, GPT gate where required, no secrets/network/real-provider violations, and Space Truth safety.
---

# homeAI Merge Gate

## Required sequence

1. Confirm task card and risk tier.
2. Confirm implementation report exists as a PR comment or committed report.
3. Confirm opposite-agent cross-review exists as a PR comment or committed report.
4. Confirm GPT gate if R3.
5. Run deterministic checks after final changes.
6. Check GitHub PR checks; missing/zero/pending/skipped/failing checks block merge.
7. Check red-zone diff.
8. Check shared contracts/API semantics; R3/GPT required unless GPT explicitly downgraded.
9. Check secrets and unauthorized network calls.
10. Check real provider status.
11. Confirm the same agent did not both implement and approve.
12. Decide merge or block.
13. If merge allowed, execute `gh pr merge`.

## Automatic R3 inputs

Classify as R3 unless GPT Pro explicitly downgrades:

```text
packages/contracts/src/**
packages/floorplan-parser/**
packages/geometry/**
packages/scene/**
packages/render-verifier/**
packages/ads-runtime/**
apps/web/app/p1/**
apps/web/app/api/** involving beta / space / render / provider / payment / auth
provider / network / secret / payment / auth changes
merge policy / CI / branch safety / agent workflow / automated merge changes
```

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
