## 1. Brand foundation and visual audit

- [x] 1.1 Inventory current `assets/`, `app.config.ts`, `src/constants/theme.ts`,
      shared components, and primary screens. Capture a baseline review board
      for Today, empty Pantry, capture/review, saved recipe, and Settings.
- [x] 1.1a Preserve the non-duplicated Organic redesign and logo source under
      `docs/brand-explorations/organic-redesign/`; repoint its image references
      to the matching repository PNGs and document provenance and authority.
- [x] 1.1b Reconcile the ZIP against current product decisions and behavior.
      Record the portable ideas, stale functional assumptions, exact font and
      palette conflict, and concepts that remain historical exploration.
- [x] 1.2 Write `docs/brand-system.md` with the approved Mise north star,
      pronunciation treatment, personality, promise, anti-patterns, content
      voice, and a concise do/don't gallery. Reference decisions 1, 4, 15, and 58.
- [x] 1.3 Define semantic colour, typography, spacing, shape, elevation,
      iconography, and state-feedback roles. Include contrast targets and rules
      for uncertain, destructive, pending, and disabled states.
- [x] 1.4 Map each existing `theme.ts` token and shared component to a semantic
      role. Identify gaps and duplication before changing any visual value.
- [x] 1.5 Define the state-illustration system: approved roles, subject,
      palette, line weight, framing, alt text, motion behavior, and component
      contract. Exclude mascots and body-evaluating imagery.
- [x] 1.6 Define the positioning hierarchy in `docs/brand-system.md`: preferred
      product-promise candidate, factual local-first proof, provider-boundary
      guardrail, and literal store-copy tier.
- [x] 1.7 Record the first side-by-side outcome: keep Organic's expressive type,
      rounded geometry, and botanical character; reject its cream/sand dominance
      and default orange action; reject production as too cold for the final
      direction. Neither displayed palette is approved as-is.
- [x] 1.7a Record the owner decision from the three-way review: ship Organic,
      Utility, and Cool Organic as selectable themes; make Organic the default;
      and lower Organic's yellow temperature without replacing its cream,
      sand, terracotta, and sage colour family.

## 2. Supplied icon approval

- [x] 2.1 Catalogue the supplied PNG icon collection under
      `assets/brand/icon-concepts/` with stable descriptive filenames.
- [x] 2.2 Record `2.png` as the lighter-dark iOS icon and `7.png` as the
      pure-dark iOS icon. Do not create Figma, SVG, mask, or Icon Composer
      source files.
- [x] 2.3 Review both selected PNGs at actual launcher size and inside circular
      and rounded-square Android enclosure guides. Record the outcome and any
      rejected alternative in `docs/brand-system.md`.

## 3. Cross-platform PNG delivery

- [x] 3.1 Configure `2.png` for the current Expo default/iOS light icon and
      splash icon, and `7.png` for iOS dark, without deleting prior files until
      visual review accepts them.
- [x] 3.2 Configure `1.png` as Android's regular and adaptive foreground icon.
      Validate it against the documented 66/108 safe zone and verify circular
      and squircle masks. Do not configure the legacy monochrome asset: Pixel
      Minimal mode rendered it as an unrelated glyph. Use the full-colour
      fallback until a purpose-built monochrome export is approved.
- [x] 3.3 Update `app.config.ts` so `ios.icon.light` uses `2.png` and
      `ios.icon.dark` uses `7.png`; omit tinted. Confirm the Android paths point
      to accepted raster exports.

## 4. Shared app visual system

- [x] 4.1 Define the three complete palettes and select reduced-warmth Organic by
      default in `src/constants/theme.ts`. Keep one stable semantic token API;
      do not copy raw values into screens or branch screen code by theme.
- [x] 4.1a Persist one validated local theme id through a synchronous startup
      preference boundary. Fall back to Organic when storage is unavailable or
      malformed; changing it must reload the application so static React Native
      styles are recreated coherently.
- [x] 4.1b Add an Appearance group in Settings with Organic, Utility, and Cool
      Organic choices, clear descriptions, selected-state accessibility, and a
      truthful reload boundary.
- [x] 4.1c Move primary buttons, FABs, active tabs, and selected date/choice
      treatments to semantic `action` / `onAction` roles while keeping macro
      and destructive meanings independent.
- [x] 4.1d Add pure palette tests and static integration guards proving Organic
      is the default, all themes expose identical roles, invalid preferences
      fall back safely, and screens never contain theme-name branches.
- [x] 4.2 Refresh shared components in `src/components/` to consume the semantic
      roles for cards, fields, buttons, sheets, tabs, toast states, and icons.
      Give `Screen` and `Sheet` one keyboard-safe contract on Android and iOS;
      controls must preserve readable labels at narrow widths.
- [x] 4.2a Apply the reported keyboard and unit-control correction: Android
      screens and sheets use height-based keyboard avoidance, and meal-editor
      units use full-width, non-wrapping segmented rows.
- [x] 4.2b Add one shared three-macro-dot processing treatment for active meal
      and receipt analysis. Include a visible status label, accessible busy
      semantics, static reduced-motion behavior, and existing recovery paths.
      do not use it as a divider or logo ornament.
- [x] 4.3 Apply the approved system to Today, Pantry, capture/review, saved
      recipes, onboarding, and Settings. Preserve the existing task flow and
      platform-native capture controls. Verify manual entry, meal review, and
      hidden-ingredient entry keep their focused values above the keyboard.
- [x] 4.4 Add only the approved illustration components to their named empty or
      recovery states. Provide meaningful accessibility labels and no decorative
      animation when reduced motion is enabled. Start with the half-empty-shelf
      brief for empty Pantry. Keep camera, receipt, and meal evidence faithful.
      any washed-photography treatment is editorial only.
- [x] 4.5 Add lintable or testable guardrails for off-token colours, typography,
      spacing, and inaccessible image-only state messages where practical.

## 5. Verification and rollout

- [x] 5.1 Add focused tests for token/component contracts and asset path
      configuration. Run `npm run typecheck`, `npm test`, and `git diff --check`.
- [x] 5.2 Build a fresh Android preview APK. Inspect the icon in launcher,
      settings, share sheet, notifications where available, and circular and
      squircle launchers. Test themed icons with system tint enabled.
- [ ] 5.3 On a current Apple simulator and device, inspect both selected PNG
      variants in the launcher, Settings, share sheet, and notifications where
      available.
- [ ] 5.4 Run the premium interaction pass with large text, high contrast,
      reduced motion, VoiceOver, and TalkBack. Confirm brand changes never hide
      an uncertain value, error, action, save confirmation, or focused text
      field. Confirm privacy copy accurately distinguishes on-device storage
      from configured-provider analysis requests.
- [x] 5.5 Compare the final review board with the baseline. Record accepted
      differences and device observations in `docs/owner-app-test-checklist.md`
      and `docs/brand-system.md`.
