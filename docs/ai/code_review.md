# Code Review Checklist

Lead with blocking issues.

Reject changes that:

- Allow LLMs to write final coordinates.
- Bypass schema validation.
- Duplicate shared schema in UI.
- Mutate confirmed geometry outside Space Truth Engine.
- Allow render output to rewrite walls, windows, or openings.
- Add PDF export to V1.
- Add construction communication to V1.
- Add contractor collaboration to V1.
- Add construction-ready material lists to V1.
- Lack error boundaries for changed behavior.
- Lack tests for changed behavior.

Review for:

- Contract completeness.
- Traceability fields.
- Provider abstraction use.
- Fixture determinism.
- Schema tests for valid and invalid payloads.
