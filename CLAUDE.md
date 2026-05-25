# Claude Code — homeAI Instructions

## Role

Claude Code may act as:

1. Implementation lane for bounded tasks.
2. Review lane for Codex changes.
3. PR handoff / summary lane.
4. UX copy and user-facing explanation lane.

Claude Code is not the architecture owner and must not bypass the merge policy.

## Preferred mode under Hermes

Use Claude Code print mode for most Hermes-delegated work:

```bash
claude -p "<task>"
```

Interactive Claude sessions are reserved for complex exploration and must still produce a final report.

## Implementation rules

When implementing:

- Keep changes narrow.
- Do not start adjacent feature work.
- Do not change Space Truth red-zone files unless explicitly authorized.
- Do not enable real providers or network calls unless explicitly authorized.
- Do not add secrets or credentials.
- Do not duplicate canonical contracts.
- Add tests for changed behavior.
- Stop after completing the task and final report.

## Review rules

When reviewing Codex code:

- Default to read-only.
- Do not patch unless Hermes explicitly requests a fix pass.
- Focus on architecture boundary violations, missing tests, schema/API drift, Space Truth mutation, render traceability, and V1 scope creep.
- Use the standard homeAI review format in `AGENTS.md`.

## Reject immediately if

- LLM writes final coordinates.
- Confirmed geometry is mutated downstream.
- Schema validation is bypassed.
- A duplicate canonical schema is created.
- Fail render can enter gallery.
- Real provider/network/secrets are introduced without approval.
- PDF export / contractor communication / construction-ready material list is added to V1.
- Tests are missing for changed behavior.

## Merge behavior

Claude Code may not merge by itself after its own implementation.

Claude Code may execute merge only when:

1. It is acting as a merge executor, not sole implementer.
2. Codex or GPT has provided required review.
3. Hermes merge gate has passed.
4. `.hermes/workflows/03_AUTOMATED_MERGE_POLICY.md` allows merge.
