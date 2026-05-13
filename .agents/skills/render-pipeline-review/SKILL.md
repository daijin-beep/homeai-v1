---
name: render-pipeline-review
description: Use when implementing or reviewing camera planning, render specs, render batches, render providers, room galleries, or image verification.
---

# Render Pipeline Review Skill

## checks

1. Does every render image bind to projectId, schemeId, roomId, cameraId, sceneContractId, and renderSpecId?
2. Is render generation asynchronous?
3. Can failed tasks be retried individually?
4. Are room-level minimum image counts enforced?
5. Are render constraints explicit?
6. Does verification produce verified/warning/rejected/manual_review_needed?
7. Are rejected images excluded from main soft decor recommendations?
8. Does UI show partial completion states?

## reject conditions

- synchronous full-home render blocking the UI
- render output that mutates geometry
- untraceable images
- missing retry logic
- no verification state

## required output

- traceability gaps
- render constraint gaps
- verification risks
- retry and partial completion risks
