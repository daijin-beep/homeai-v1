# ADS Recovery PR Review Gate

## Current PR Handling

Old ADS PR #2 has been closed as superseded and must not be merged.

The current ADS recovery merge candidate is PR #10:

```text
https://github.com/daijin-beep/homeai-v1/pull/10
```

The recovery branch is:

```text
ads/rebased-batch03-06-verifier-debug-bakeoff-gated-provider
```

The reviewed recovery PR title is:

```text
ads: stack recovery + Batch 03-06 rebased on canonical main (D-036)
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
- bakeoff remains mock or stub only
- provider gate remains blocked
- scope tests pass

## Batch 14 Trace Source Alignment

`RenderTrace.sourceModule` now includes the canonical `render_verifier_l1`
source module in `@homeai/contracts`.

ADS recovery code that still emits `render_verifier_mock` for L1 verifier
reports should treat that as temporary compatibility debt. Future ADS verifier
reports should use `render_verifier_l1` rather than adding package-local source
module strings.

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

## Encoding Guard

This document must remain readable in GitHub raw view with ordinary physical line breaks.

- Store the file as UTF-8 text without a byte order mark.
- Use ordinary LF newline bytes only.
- Do not include carriage return bytes.
- Do not serialize this document as escaped newline text.
- Do not collapse this document into one physical line.
- Do not include zero-width, bidi, line-separator, paragraph-separator, or other format control characters.
- Keep headings, bullets, and code fences on separate physical lines.

## Exact Raw Review Guard

Reviewers must be able to fetch this exact file from a commit raw URL and see multiline Markdown.

- The first line must be `# ADS Recovery PR Review Gate`.
- The second physical line must be blank.
- The third physical line must be `## Current PR Handling`.
- The raw file must have more than thirty physical LF bytes.
- The raw file must end with an LF byte.
- The raw file must not contain non-ASCII bytes.
