# Design: Swipe Meal Decision — UI Standards (`add-swipe-meal-decision-ui`)

## Context

See `proposal.md — Why` for motivation. This document focuses exclusively on the *how* of implementing the visual layer — token structure, component anatomy decisions, and the specific implementation choices that defend the design specs against AI-default regression.

The parent change (`add-swipe-meal-decision`) specifies gesture mechanics and state logic. This design owns every pixel — colour, typography, shadow, motion, and accessibility implementation.

All colour, spacing, and font values MUST be added to `src/constants/theme.ts` before use. No literal `#` hex, raw `rgba()`, or hardcoded `fontFamily` strings inside component files.

---

## Goals / Non-Goals

**Goals (design-level)**:
- Establish a non-negotiable token vocabulary in `theme.ts` that all swipe components reference.
- Define the exact component layer stack order for `MealSwipeCard`.
- Specify the Reanimated 4 derived value chain for overlay opacity and rotation.
- Choose the shadow implementation strategy (layered `boxShadow` vs `elevation`).
- Specify the bottom sheet library approach for `MealDetailSheet`.
- Prevent drift: any developer can reproduce the visual intent without UX review.

**Non-Goals (design-level)**:
- Does not specify gesture threshold logic (owned by `add-swipe-meal-decision`).
- Does not specify state reducer or calorie classification logic (owned by `add-swipe-meal-decision`).
- Does not add new SQL queries or database migrations.

---

## Decisions

### 1. Token Strategy — Extend `theme.ts` with Swipe-Specific Tokens

**Choice**: Add a namespaced block to `src/constants/theme.ts`:

```ts
export const swipeTokens = {
  card: {
    borderRadius: 20,
    shadowAmbientColor: 'rgba(0,0,0,0.06)',
    shadowKeyColor: 'rgba(0,0,0,0.14)',
    shadowAmbientRadius: 8,
    shadowKeyRadius: 20,
    shadowKeyOffsetY: 6,
  },
  overlay: {
    cookColor: colors.success,        // #27AE60 or theme equivalent
    passColor: colors.roseMuted,      // #C0392B-muted or theme equivalent
    stampFontWeight: '800' as const,
    stampLetterSpacing: 0.14,
    stampFontSize: 36,
    stampRotationDeg: 15,
  },
  badge: {
    exactFitBg: colors.success,
    fitsBudgetBg: colors.teal,
    overBudgetBg: colors.roseMuted,
    estimatedBg: colors.amber,
    textColor: colors.white,
    borderRadius: 8,
    paddingH: 8,
    paddingV: 4,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  motion: {
    exitDurationMs: 300,
    exitRotationDeg: 15,
    scaleFrom: 0.95,
    scaleTo: 1.0,
    springStiffness: 220,
    springDamping: 22,
    reducedFadeDurationMs: 150,
  },
  a11y: {
    minTouchTargetDp: 44,
    focusRingWidth: 2,
    focusRingColor: colors.primary,
  },
} as const;
```

**Why over inline values**: Token discipline prevents any single component from silently introducing a one-off hex colour. The Hallmark anti-slop principle applies: every value must be traceable to a named token.

**Alternative considered**: Separate theme file per component. Rejected — Mise already has a single `theme.ts` as the source of truth per project conventions.

---

### 2. `MealSwipeCard` Layer Stack

The card is composed of the following ordered layers (back to front):

1. **Background fill** — `colors.surface` (card white/off-white from theme), border-radius `swipeTokens.card.borderRadius`.
2. **Shadow** — implemented as two `View` elements with `style.shadowColor` on iOS and `elevation` on Android. Two separate shadow Views (ambient + key) produce the depth vocabulary without relying on non-cross-platform `boxShadow`.
3. **Content area** — absolute-positioned inside the card:
   - Top row: Cuisine Pill (left) + Prep Speed Indicator (right)
   - Middle: Dish name (display weight) + macro chip row
   - Bottom row: Calorie Fit Badge (left) + Pantry Count Badge (right)
4. **Overlay layer** — `position: absolute, inset: 0`, `pointerEvents: 'none'`. Contains:
   - COOK stamp (top-left, transformed `rotate(-15deg)`)
   - PASS stamp (top-right, transformed `rotate(15deg)`)
   - Both stamps driven by `Animated.View` opacity derived values.

**Why absolute overlay**: Avoids layout re-computation on every gesture frame. Opacity-only animation on the overlay layer is a GPU-composited operation — no JS thread involvement.

---

### 3. Gesture Overlay Opacity — Reanimated 4 Derived Values

```ts
// Inside MealSwipeCard — driven by parent's translateX shared value
const cookOpacity = useDerivedValue(() =>
  interpolate(translateX.value, [0, cardWidth * 0.35], [0, 1], Extrapolation.CLAMP)
);
const passOpacity = useDerivedValue(() =>
  interpolate(translateX.value, [0, -(cardWidth * 0.35)], [0, 1], Extrapolation.CLAMP)
);
```

`translateX` is passed as a shared value prop from `MealSwipeDeck`. This keeps both the overlay and the gesture handler on the UI thread — zero JS bridge involvement during swipe.

---

### 4. Shadow Implementation — Cross-Platform Dual Layer

React Native's shadow props only work on iOS. For Android we use `elevation`. Both are applied through a utility `cardShadowStyle(elevation: number)` helper in `src/constants/theme.ts`:

```ts
export function cardShadowStyle(level: 1 | 2 | 3) {
  return Platform.select({
    ios: {
      shadowColor: swipeTokens.card.shadowKeyColor,
      shadowOffset: { width: 0, height: level * 2 },
      shadowOpacity: 0.12 + level * 0.04,
      shadowRadius: level * 6,
    },
    android: { elevation: level * 4 },
  });
}
```

Top card uses `level: 3`, background peeking card uses `level: 1`. This is the observable depth vocabulary required by `swipe-card-ui` spec.

---

### 5. `MealDetailSheet` — `@gorhom/bottom-sheet` (already in project)

The project does not yet confirm whether `@gorhom/bottom-sheet` is installed. Two strategies:

- **If available**: Use `BottomSheet` with `snapPoints={['50%', '90%']}`. Sheet renders in a portal above all other content.
- **If not available**: Implement with Reanimated 4 `useAnimatedStyle` + `Gesture.Pan()` on the sheet drag handle. Snaps to 50% and 90% via spring animation. This avoids a new dependency.

**Decision**: Check for `@gorhom/bottom-sheet` in `package.json` at implementation time. If present, use it. If not, build the gesture-driven variant using existing Reanimated 4 to avoid adding a dependency.

The footer ("Cook it" button) is rendered as an absolutely-positioned View at `bottom: 0` within the sheet container, elevated above the scroll content with `zIndex: 1`.

---

### 6. Macro Chip Row — Layout Strategy

Three chips in a flex row with `flexDirection: 'row'` and `gap: 8`. Each chip is a `View` with border-radius 12, a coloured dot (12 × 12 circle), the value, and the macro label. They scale naturally — no fixed width — so long macronutrient labels (carbohydrates would be "Carbs") never truncate.

**Typography purity**: Chip labels use `fontWeight: '600'`, not italic. Value uses `fontWeight: '700'`. Neither uses system-default font — both use `fontFamily: theme.fonts.mono` (or body) depending on the project's font token.

---

### 7. Empty Deck State — Illustration Strategy

No real illustrations are added (no new image assets). The empty state uses:
- A large Unicode food emoji (🍽️) at ~64 sp as the hero visual element.
- A bold headline: "All caught up" or "That's everything for now."
- A 14 sp muted sub-label: "We'll refresh when you come back."
- Two buttons: primary "Refresh" + secondary "Log manually" text link.

**Why emoji over SVG asset**: Avoids introducing new binary assets. Consistent with the project's lightweight, local-first posture.

---

## Risks / Trade-offs

- **[Risk]** The dual-shadow approach on Android (`elevation`) flattens shadow directionality compared to iOS multi-layer shadows.
  - **Mitigation**: Accepted trade-off; Android's Material elevation model is the correct semantic equivalent. Do not try to replicate iOS shadow physics on Android.

- **[Risk]** Stamp font weight 800 may not be available if the project's bundled font does not include that weight.
  - **Mitigation**: Fall back to `fontWeight: '700'` if weight 800 is unavailable; confirm available weights in `theme.ts` at implementation time.

- **[Risk]** `@gorhom/bottom-sheet` may not be in `package.json`; the custom gesture sheet adds implementation complexity.
  - **Mitigation**: The gesture-driven variant is fully specified — `Gesture.Pan()` on the handle + `useAnimatedStyle` spring snap. It does not require a new dependency.

- **[Risk]** Accessibility `accessibilityLabel` on swipeable cards may be ignored by TalkBack/VoiceOver if the gesture handler intercepts events first.
  - **Mitigation**: The alternative button bar (per `swipe-accessibility` spec) is the primary a11y path. The card's `accessibilityLabel` is supplementary for users who can still use swipe with a screen reader.

---

## Migration Plan

No database migrations. No existing screen is deleted — `app/dinner.tsx` receives the new components additively. The swipe deck is a new mounting point; the existing list view can be toggled as a fallback during rollout.

---

## Open Questions

- Which font family and weights are currently bundled in the project? Confirm from `theme.ts` before using `fontWeight: '800'` — may need weight fallback.
- Is `@gorhom/bottom-sheet` in `package.json`? This determines whether to use it or build the custom pan-gesture sheet. Confirm at implementation start.
