# GPT Pro Architecture Gate Packet

Use this when Hermes cannot directly call the existing GPT Pro Project context.

Hermes must generate this packet, send it to the owner through WeChat, and wait for the GPT result to be pasted back.

## Packet template

```md
# GPT Pro Architecture Gate — homeAI

## Request
Review this PR/task for homeAI architecture safety.

## Context
homeAI V1 principles:
- Space Truth is root.
- Downstream modules must not mutate confirmed geometry.
- Contract-first, not prompt-first.
- LLMs and image models are providers, not sources of truth.
- Every valid room must remain covered.
- Render traceability and verifier boundaries are mandatory.

## Task card
[paste task card]

## Risk tier
R0 / R1 / R2 / R3

## Changed files
[paste changed file list]

## Diff summary
[paste Hermes summary]

## Implementation report
[paste Codex/Claude final report]

## Cross-review report
[paste opposite-agent review]

## Deterministic gate results
[paste checks]

## Specific questions
1. Does this preserve Space Truth integrity?
2. Does it mutate confirmed geometry or allow downstream mutation?
3. Does it duplicate or bypass canonical schemas?
4. Does it preserve render traceability?
5. Does it maintain every-valid-room coverage where relevant?
6. Is automated merge acceptable under the current policy?

## Required output format
### Verdict
approve / request changes / reject

### Blocking issues
- ...

### Non-blocking issues
- ...

### Schema/API impact
- ...

### Space truth impact
- ...

### Render pipeline impact
- ...

### Soft decor GPS impact
- ...

### Test gaps
- ...

### Merge gate
approved for automated merge / not approved for automated merge

### Final risk
low / medium / high
```
