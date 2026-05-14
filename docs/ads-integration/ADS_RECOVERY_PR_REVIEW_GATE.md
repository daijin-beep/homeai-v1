# ADS Recovery PR Review Gate

## Required PR Handling

Old ADS PR #2 must be closed as superseded and must not be merged.

The expected recovery branch is:

```text
ads/rebased-batch03-06-verifier-debug-bakeoff-gated-provider
```

The expected recovery PR title is:

```text
ADS Recovery: Runtime-only render pipeline scaffold
```

## Review Gate

Before ADS runtime work is treated as mergeable, review must confirm:

- no duplicate canonical schemas outside `@homeai/contracts`
- no Space Truth write path
- no real provider enabled by default
- no network calls by default
- verifier not-evaluable checks are not mapped to pass
- human review rejects duplicate decisions
- human review rejects `geometryHash` drift
- bakeoff remains mock/stub only
- provider gate remains blocked
- scope tests pass

## Codex Batch 12 Boundary

Codex Batch 12 does not modify ADS runtime, verifier, render-debug, render snapshot API, render human review API, image adapter registry, bakeoff harness, human review queue, or real provider gate.

Codex Batch 12 only freezes producer-side `CreativeRenderSpec` semantics and documents the ADS consumer boundary.

## Merge Blockers

Block the ADS recovery PR if any of these are present:

- provider output mutates Space Truth
- failed verification is mapped to pass
- real providers run without an explicit gate
- runtime code imports private producer helpers instead of shared contracts
- gallery admission bypasses verification status
- any recovery change rewrites Batch 12 frozen field names
