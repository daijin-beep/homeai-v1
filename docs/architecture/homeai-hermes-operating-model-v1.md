# homeAI Hermes Operating Model V1

## Executive decision

homeAI will use Hermes as the WeChat-facing orchestration layer.

The new model is:

```text
WeChat
→ Hermes intake / routing / status / merge gate
→ Codex or Claude Code implementation
→ Opposite-agent review
→ Hermes deterministic gates
→ GPT Pro architecture gate for R3
→ AI executes merge if allowed
→ WeChat final report
```

## Why this model

The previous model made GPT review every code change. That is safe but slow and creates founder bottleneck.

The new model uses:

- Codex for bounded implementation and test-heavy work.
- Claude Code for codebase comprehension, review, PR handoff, UX/copy-sensitive work.
- GPT Pro for architecture and high-risk gates only.
- Hermes for orchestration, records, deterministic checks, and merge execution.

## Autonomous merge principle

Autonomous merge is allowed, but only after policy gates pass.

This avoids requiring the owner to make technical code decisions while still preventing unsafe merges.

## Risk gates

```text
R0/R1/R2: automatic merge after cross-review and deterministic gates.
R3: automatic merge only after GPT architecture gate approves.
```

## Non-negotiable constraints

- Space Truth is root.
- Contract-first, not prompt-first.
- LLMs and image models are providers, not truth sources.
- Confirmed geometry cannot be mutated downstream.
- Every valid room must remain covered.
- Render traceability is required.
- Failed renders cannot enter gallery.
- No real provider, network, secrets, or payment changes without explicit task card and gate.

## Operating documents

```text
AGENTS.md
CLAUDE.md
CODEX.md
.hermes/workflows/00_HOMEAI_HERMES_OPERATING_ARCHITECTURE.md
.hermes/workflows/03_AUTOMATED_MERGE_POLICY.md
.hermes/skills/homeai-*
```

## Rollout

1. Install docs and skills.
2. Run WeChat read-only status.
3. Run R0 docs-only PR and auto-merge.
4. Run R1 test-only Codex implementation + Claude review + auto-merge.
5. Run R2 runtime bugfix + cross-review + auto-merge.
6. Run R3 GPT-gated PR only after the above is stable.
