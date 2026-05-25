---
name: homeai-gpt-gate
description: Use when a homeAI task is R3 or when architecture impact is unclear. Creates a GPT Pro architecture review packet and validates the returned verdict.
---

# homeAI GPT Gate

## When required

- Space Truth red-zone changes.
- Canonical contract changes.
- SceneContract or geometryHash changes.
- Render verifier semantic changes.
- Real provider / network / secrets / cost gate work.
- Merge conflict between Codex and Claude review.
- Any task where Hermes cannot confidently classify risk.

## If Hermes cannot directly call GPT Pro Project

Generate the packet from `.hermes/workflows/04_GPT_PRO_GATE_PACKET.md`, send it through WeChat, and wait for the pasted GPT Pro result.

## Valid approval

A GPT result is merge-approving only if it includes:

```text
Verdict: approve
Merge gate: approved for automated merge
No blocking issues
```

Anything else blocks merge.
