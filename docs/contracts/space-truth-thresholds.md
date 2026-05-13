# Space Truth Thresholds

Thresholds live in `packages/contracts/src/space-truth-thresholds.ts`.

```ts
export const SPACE_TRUTH_THRESHOLDS = {
  minScoreForScene: 0.8,
  minScoreForCameraPlan: 0.8,
  minScoreForRender: 0.8,
  minScoreForSoftDecorGps: 0.8
} as const;
```

## Blocking Rules

- Scale unknown blocks confirmation.
- Invalid topology blocks confirmation.
- Self-intersecting room polygon blocks confirmation.
- Unknown room type blocks render for that room.

## Warning Rules

- Door swing unknown is warning, not blocking.
- Opening low confidence is warning unless geometry is impossible.
