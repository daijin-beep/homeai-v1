# homeAI Hermes Workflow Rollout Plan

## Phase 0 — read-only WeChat control

Goal: verify Hermes receives WeChat commands and can inspect repo safely.

Allowed:
- status
- plan
- review packet creation

Forbidden:
- code changes
- PR creation
- merge

Success: 5 read-only commands complete without unexpected file changes.

## Phase 1 — cross-review only

Goal: let Codex and Claude Code review each other without code mutation.

Allowed:
- diff summaries
- review reports
- test runs

Forbidden:
- merge
- fix passes unless explicitly requested

Success: 3 PRs reviewed with clear blocking/non-blocking issues.

## Phase 2 — low-risk implementation + auto merge

Goal: allow R0/R1 autonomous merge.

Allowed:
- docs
- tests
- isolated debug fields

Required:
- premerge gate
- cross-review or Hermes review
- final WeChat report

Success: 2 R0/R1 PRs auto-merged without rollback.

## Phase 3 — R2 autonomous merge

Goal: allow medium-risk implementation after cross-review.

Required:
- opposite-agent review approve
- deterministic gates pass
- no red-zone diff

Success: 3 R2 PRs auto-merged without regression.

## Phase 4 — R3 GPT-gated autonomous merge

Goal: allow high-risk merge only after GPT gate approves.

Required:
- task card
- cross-review
- GPT gate approve
- deterministic gates
- merge report

Success: first R3 PR merged only after GPT approval packet.
