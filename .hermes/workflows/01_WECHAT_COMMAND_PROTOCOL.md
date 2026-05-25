# homeAI WeChat Command Protocol

## Principle

WeChat is the owner-facing interface. Hermes must convert natural-language messages into explicit workflow commands before taking action.

## Commands

### `/homeai status`

Read-only repository status.

Example:

```text
/homeai status
只读检查当前仓库。不要修改文件。运行 git status --short、git branch --show-current、git log --oneline -3。
```

### `/homeai plan`

Create a task card only. No implementation.

Example:

```text
/homeai plan
Topic: DXF Entity Filtering Spike.
Goal: 设计 schema、边界、测试、禁止文件。
Need: decide risk tier and whether GPT gate is required.
```

### `/homeai impl codex`

Run Codex as implementation lane.

Required fields:

```text
Task card:
Branch:
Allowed files:
Forbidden files:
Required tests:
Merge policy:
```

### `/homeai impl claude`

Run Claude Code as implementation lane.

Same required fields as Codex.

### `/homeai review claude`

Claude Code reviews Codex implementation read-only.

### `/homeai review codex`

Codex reviews Claude Code implementation read-only.

### `/homeai gpt-gate`

Hermes prepares a GPT Pro architecture review packet. If Hermes cannot directly call the GPT Pro Project context, it must output a packet for copy-paste into GPT Pro and wait for the pasted result.

### `/homeai premerge`

Run deterministic gate and create merge decision report.

### `/homeai merge`

Execute merge only if `.hermes/workflows/03_AUTOMATED_MERGE_POLICY.md` allows it.

### `/homeai stop`

Stop current task. Do not patch further. Return current state and next recommended action.

## Natural language mapping

| Owner says | Hermes interprets |
|---|---|
| “看一下现在状态” | `/homeai status` |
| “帮我拆任务” | `/homeai plan` |
| “让 Codex 做” | `/homeai impl codex` only after task card exists |
| “让 Claude review” | `/homeai review claude` |
| “没问题就合并” | `/homeai premerge` then `/homeai merge` if allowed |
| “这个影响 Space Truth 吗” | `/homeai gpt-gate` if unclear |

## WeChat response format

Short status updates:

```md
## homeAI status
- Branch: ...
- Task: ...
- Risk: R...
- Current phase: planning / implementation / review / premerge / merged / blocked
- Blocker: none / ...
- Next action: ...
```

Final reports may be longer, but should remain structured.
