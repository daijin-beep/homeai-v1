# homeAI Automated Merge Policy

## Decision

AI may execute merges for homeAI after the merge gate passes.

The owner does not need to manually inspect code. The owner may still stop or override the process through WeChat, but the default is autonomous merge after green review and green gates.

## Merge authority by risk tier

| Risk | Merge mode | Required before merge |
|---|---|---|
| R0 | Auto merge | Hermes checks pass + GitHub checks present and green |
| R1 | Auto merge | Cross-review or Hermes review + tests pass + GitHub checks present and green |
| R2 | Auto merge | Opposite-agent review approve + deterministic gates pass + GitHub checks present and green |
| R3 | GPT-gated auto merge | Opposite-agent review approve + GPT architecture gate approve + deterministic gates pass + GitHub checks present and green |

## Automatic R3 classification

Classify a PR/task as R3 unless GPT Pro explicitly downgrades it in writing when it changes:

```text
packages/contracts/src/**
packages/floorplan-parser/**
packages/geometry/**
packages/scene/**
packages/render-verifier/**
packages/ads-runtime/**
apps/web/app/p1/**
apps/web/app/api/** involving beta / space / render / provider / payment / auth
any provider / network / secret / payment / auth behavior
any merge policy / CI / branch safety / agent workflow / automated merge behavior
```

R3 requires:

1. Opposite-agent review.
2. Deterministic premerge gate.
3. GPT Pro architecture gate.
4. Merge only after explicit GPT approve.

Same agent may not implement and approve the same PR. Hermes may execute merge only after all required review artifacts exist as PR comments or committed reports.

## Universal merge blockers

Never merge if any of the following is true:

- Tests fail.
- Typecheck fails.
- Scope tests fail.
- GitHub checks are missing, zero, pending, skipped, cancelled, neutral, timed out, action-required, or failing.
- Working tree is dirty.
- Merge conflict exists.
- Reviewer verdict is `request changes` or `reject`.
- GPT gate is required but missing.
- GPT gate verdict is not approve.
- Unauthorized Space Truth red-zone diff exists.
- Shared contracts changed without GPT approval.
- API semantics changed without GPT approval.
- Real provider is enabled without explicit approved task card.
- Unauthorized network calls are introduced.
- Secrets, tokens, credentials, or key names are committed.
- Duplicate canonical schema is created.
- Schema validation is bypassed.
- Confirmed geometry can be mutated downstream.
- Failed render can enter gallery.
- PR scope differs materially from task card.
- Implementation agent is also the only reviewer.
- Same agent implemented and approved the same PR.
- Required review artifacts are missing from PR comments or committed reports.

## Allowed merge commands

Preferred:

```bash
gh pr merge <PR_NUMBER> --squash --delete-branch
```

Allowed if repository policy requires merge commits:

```bash
gh pr merge <PR_NUMBER> --merge --delete-branch
```

Never use:

```bash
git push --force
git reset --hard origin/main
gh pr merge --admin
```

## Required pre-merge sequence

```text
1. Confirm branch and PR.
2. Confirm task card and risk tier.
3. Confirm implementation final report.
4. Confirm cross-review report.
5. Run deterministic gates after final code changes.
6. Run GPT gate if R3.
7. Assemble merge decision report.
8. If mergeDecision = merge, execute gh pr merge.
9. Report result to WeChat.
```

## Post-merge report

```md
# homeAI Merge Report

## PR
...

## Merge SHA
...

## Risk tier
...

## Reviews
- Implementation agent:
- Review agent:
- GPT gate if required:

## Gates
| Gate | Result |
|---|---|
| typecheck | |
| full tests | |
| scope tests | |
| red-zone diff | |
| network scan | |
| secrets scan | |
| real provider status | |

## Merge decision
merged / blocked

## Reason
...
```
