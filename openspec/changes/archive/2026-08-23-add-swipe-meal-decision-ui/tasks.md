## 1. Token Foundation

- [x] 1.1 Confirm available font weights in `src/constants/theme.ts`; add `fontWeight: '800'` or document the fallback to `'700'`
- [x] 1.2 Check `package.json` for `@gorhom/bottom-sheet`; record result in a code comment in `MealDetailSheet.tsx` to decide implementation path
- [x] 1.3 Add `swipeTokens` block to `src/constants/theme.ts` — card shadow tokens, overlay tokens (cookColor, passColor, stamp sizing), badge colour tokens (exactFitBg, fitsBudgetBg, overBudgetBg, estimatedBg), motion tokens, and a11y tokens
- [x] 1.4 Add `cardShadowStyle(level: 1 | 2 | 3)` helper function to `src/constants/theme.ts` with `Platform.select` for iOS shadow props vs Android `elevation`
- [x] 1.5 Verify every new token has a corresponding TypeScript `const` type; run `tsc --noEmit` to confirm no type errors in `theme.ts`

## 2. MealSwipeCard Visual Implementation

- [x] 2.1 Scaffold `src/components/suggestions/MealSwipeCard.tsx` — accept `meal`, `translateX` (Reanimated SharedValue), `cardWidth`, `remainingCalories`, `pantryStatus` props
- [x] 2.2 Implement card background layer — `borderRadius: swipeTokens.card.borderRadius`, `cardShadowStyle(3)` on the top card, `cardShadowStyle(1)` on background card
- [x] 2.3 Implement cuisine category pill in the card's top-left — uppercase tracking-widened label, accent background from theme, hidden when cuisine is null
- [x] 2.4 Implement prep speed indicator in card's top-right — clock icon + one of "Quick / Medium / Slow", with colour from `swipeTokens.badge.*` tokens
- [x] 2.5 Implement dish name typography — `fontSize: 22`, `fontWeight: '700'`, 2-line max with ellipsis, no italic
- [x] 2.6 Implement macro chip row — three chips (Protein, Carbs, Fat) with coloured dot, gram value, label; `flexDirection: 'row'`, `gap: 8`, `borderRadius: 12`
- [x] 2.7 Implement calorie fit badge — four visual states (`Exact Fit`, `Fits Budget`, `Over Budget`, `Estimated`), each with the correct `swipeTokens.badge` fill colour, icon, and label; exactly one badge rendered per card
- [x] 2.8 Implement pantry count badge in card's bottom-right — "X/Y on hand" fraction, green-tint when full coverage, amber when < 50% coverage
- [x] 2.9 Implement COOK overlay stamp — `position: absolute`, top-left quadrant, `rotate(-15deg)`, `fontWeight: '800'`, `swipeTokens.overlay.cookColor`, uppercase, `letterSpacing: 0.14 * stampFontSize`; opacity driven by `useDerivedValue` from `translateX`
- [x] 2.10 Implement PASS overlay stamp — mirror of 2.9 in top-right quadrant, `rotate(15deg)`, `swipeTokens.overlay.passColor`; opacity driven by `useDerivedValue` from `translateX` (negative direction)
- [x] 2.11 Verify overlay stamps are clipped to card border radius using `overflow: 'hidden'` on the card root
- [x] 2.12 Add `accessibilityLabel` on card root: dish name + calorie fit summary; add `accessibilityHint`: "Swipe right to cook, swipe left to pass"

## 3. MealSwipeDeck — Container & Overlay Wiring

- [x] 3.1 Pass `translateX` SharedValue as a prop from `MealSwipeDeck.tsx` to each `MealSwipeCard.tsx` so overlay opacity animates on the UI thread
- [x] 3.2 Render top card with `cardShadowStyle(3)` and second card (peek) with `cardShadowStyle(1)` and `scale: swipeTokens.motion.scaleFrom`
- [x] 3.3 Implement background card scale animation — `useAnimatedStyle` driven by a derived value that interpolates from `swipeTokens.motion.scaleFrom` to `swipeTokens.motion.scaleTo` as top card crosses threshold

## 4. Card Motion — Exit, Spring-Back, Undo

- [x] 4.1 Implement exit-right animation — translate card off right edge + rotate to `+swipeTokens.motion.exitRotationDeg`; use `withTiming` with duration `swipeTokens.motion.exitDurationMs`
- [x] 4.2 Implement exit-left animation — mirror of 4.1 with negative rotation and left-edge translation
- [x] 4.3 Implement spring-back animation — `withSpring` with `stiffness: swipeTokens.motion.springStiffness`, `damping: swipeTokens.motion.springDamping`, no overshoot
- [x] 4.4 Implement undo enter animation — card enters from the correct off-screen edge with ±15° initial rotation, springs to 0° at deck centre
- [x] 4.5 Detect `useReducedMotion()`; replace all translation+rotation animations with `withTiming` opacity fade of `swipeTokens.motion.reducedFadeDurationMs`

## 5. Deck State UI

- [x] 5.1 Implement card count indicator below deck — "X meals remaining" / "1 meal remaining" (singular guard); muted secondary text style; updates after each swipe
- [x] 5.2 Implement undo affordance — visible only when undo stack is non-empty (hidden not disabled); minimum touch target `swipeTokens.a11y.minTouchTargetDp × swipeTokens.a11y.minTouchTargetDp`; `accessibilityLabel: "Undo last pass"`
- [x] 5.3 Implement empty deck state — emoji hero (🍽️, 64 sp), bold headline, muted sub-label, "Refresh" primary button, "Log manually" text link; no ghost card outline
- [x] 5.4 Implement reduced-motion button bar (Pass | Info | Cook) — rendered when `useReducedMotion()` is active; each button ≥ 44 dp tall; triggers same logical actions as gesture swipes

## 6. MealDetailSheet Visual Implementation

- [x] 6.1 Determine bottom sheet implementation path from task 1.2 result; scaffold `src/components/suggestions/MealDetailSheet.tsx` accordingly
- [x] 6.2 Implement macro summary panel at top of sheet — calorie total + three macro values with coloured dots; updates in real time when `servingsEaten` stepper changes
- [x] 6.3 Implement ingredient list — all ingredients visible without collapse; green filled circle for on-hand, muted grey circle + "Missing" inline rose label for absent ingredients
- [x] 6.4 Implement recipe steps — numbered list, step numbers at `fontSize: 20, fontWeight: '700'`, body text at `fontSize: 15`; `gap: 16` between step blocks; no divider after last step
- [x] 6.5 Implement pinned footer — "Cook it" primary button (full-width minus horizontal margins, `zIndex: 1`); "Pass" as a secondary text link below or adjacent to it
- [x] 6.6 Verify "Cook it" button is always visible without scrolling at all sheet snap points

## 7. Accessibility Verification

- [x] 7.1 Audit all tappable elements for minimum touch target size (`swipeTokens.a11y.minTouchTargetDp`); add `hitSlop` where visual size is smaller than the minimum
- [x] 7.2 Verify dish name contrast ratio ≥ 3:1 against card background; verify badge text contrast ≥ 4.5:1 against badge fill (use APCA or WCAG tooling)
- [x] 7.3 Add `accessibilityLabel` to all icon-only controls (undo, info); ensure badge icons read their semantic meaning not "image"
- [x] 7.4 Add `focusStyle` / `accessibilityRole` to action buttons; verify focus ring is 2 dp thick, uses `swipeTokens.a11y.focusRingColor`, visible against both element and page backgrounds
- [x] 7.5 Test with TalkBack (Android) or VoiceOver (iOS): confirm card hint reads, badge meanings are announced, and button bar is reachable in reduced-motion mode

## 8. Validation

- [x] 8.1 Run `npx tsc --noEmit` — zero new type errors
- [x] 8.2 Run `npx jest --testPathPattern=swipe` — all swipe-related tests pass
- [x] 8.3 Manual check: swipe a card right → COOK stamp fades in proportionally, exits with rotation arc within 280–320 ms, background card scales from 0.95 to 1.0
- [x] 8.4 Manual check: empty deck renders correctly after all cards are passed; undo button disappears when stack is empty
- [x] 8.5 Manual check with Reduce Motion enabled: crossfade replaces arc exit; button bar is visible and functional
- [x] 8.6 Run `npx openspec validate --change add-swipe-meal-decision-ui` — no validation errors
