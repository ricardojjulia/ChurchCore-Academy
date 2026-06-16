# GrowthFrameFilter

The Gradebook GrowthFrameFilter is implemented in `src/lib/gradebook/growthFrameFilter.ts`.

## Purpose

Learner-facing grade displays must frame grades as learning progress. Pastoral-sensitive grades must not imply calling failure, ministry failure, worth, or spiritual fitness.

## Output Rules

The filter returns:

- Assignment title.
- Rounded percentage label, not raw points.
- Primary learning label.
- Context statement.
- Sanitized instructor feedback.
- `showRawScore: false`.

## Pastoral Sensitivity

For `sensitivityTier: "pastoral"`, the primary label is `Pastoral formation review`, and the context states that the grade does not determine calling, worth, or ministry fit.

The filter also rewrites restricted language in feedback, including `failure`, `not called`, `unfit`, and `deficient`.

## Phase 2 Boundary

The filter is ready for approved AI progress explanations later, but Phase 1 does not generate, store, or display AI narratives.
