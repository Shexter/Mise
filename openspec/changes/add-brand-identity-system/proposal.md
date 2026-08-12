## Why

Mise has a sound functional design system, but it does not yet have a documented
brand identity or a platform-ready icon family. The current assets and warm
tokens are a useful start, but they cannot yet ensure that the app feels
recognisable, calm, and intentional across the launcher, onboarding, capture,
empty states, and App Store surfaces.

This is the right time to establish that system before isolated illustrations,
polish passes, and replacement icons create visual drift. The owner-supplied
Organic redesign and logo exploration now adds concrete palette, type,
composition, positioning, and state-treatment candidates that need a durable
disposition. The change advances decision 1's broad "everything in its place"
identity, decision 4's Asian-pantry edge, decision 5's local-first trust story,
decision 15's honest presentation of uncertain values, and decision 58's rule
that pantry supports the larger meal flow rather than becoming the whole brand.

## What Changes

- Define Mise's visual identity: brand promise, personality, naming and
  pronunciation treatment, colour roles, typography hierarchy, photography and
  illustration boundaries, and content voice.
- Preserve the supplied Organic clickable prototype, token system, and logo
  exploration under `docs/brand-explorations/organic-redesign/`. Treat them as
  visual and copy evidence, not as authority for current screen behavior.
- Ship three user-selectable colour themes through one semantic token system:
  **Organic** (the default), **Utility**, and **Cool Organic**. Organic retains
  the supplied cream, sand, terracotta, and sage colour family with reduced
  yellow temperature; Utility preserves the current production palette; Cool
  Organic preserves the cooler stone-and-juniper alternative.
- Establish “Cook from what you have, tracked as you go.” as the preferred
  product-promise candidate and pair it with precise local-first trust copy that
  does not misrepresent provider network requests.
- Define the three macro dots as a functional processing treatment for food
  analysis, never as generic decoration, and preserve plain-language status,
  reduced-motion, and recovery behavior.
- Adopt the supplied PNG collection as the icon source of truth. Use `2.png`
  as the lighter dark iOS variant and `7.png` as the pure-dark iOS variant;
  retain the other supplied PNGs as named alternatives. Do not recreate artwork
  in Figma, Icon Composer, or generated layers.
- Managed Expo delivers those two iOS appearance variants directly through
  `ios.icon.light` and `ios.icon.dark`. Tinted is deliberately not supplied.
- Refresh app-level tokens and shared primitives only after the identity is
  approved. Screens inherit the system rather than each choosing a new style.
- Standardise keyboard-safe text entry so a focused field, its label, and its
  value remain visible on Android and iOS, including inside sheets.
- Define a small, reusable state-illustration language for only high-value empty
  and recovery states. It excludes mascots, medical imagery, and generic
  decoration.
- Add a visual-regression and real-device review matrix across iOS and Android,
  including accessibility, high-contrast appearance modes, and home-screen
  icon behavior.

## Capabilities

### New Capabilities

- `brand-identity-system`: A durable Mise visual identity and a governed system
  of tokens, components, content voice, and approved illustrative roles.
- `cross-platform-app-icon`: A supplied, owner-approved PNG icon collection
  that yields reliable Expo/iOS light and dark icon variants and Android
  launcher assets without vector reconstruction or Apple-specific tooling.

### Modified Capabilities

None. This adds visual-system and app-icon behavior; no archived main specs
exist to modify.

## Non-goals

- Rebrand Mise, change its product promise, add accounts, or introduce a
  server.
- Copy the prototype's screen map, Anthropic-only setup, calorie calculation,
  navigation, widgets, store listing, or marketing scope into the current app.
- Fork screen components or product behavior by theme. Themes replace semantic
  visual values only; they do not create three implementations of a screen.
- Apply Liquid Glass effects, Figma reconstruction, Icon Composer assets, or
  imitate iOS on Android.
- Add a mascot, body-evaluating imagery, nutrition claims, a custom camera, or
  decorative motion that slows capture and logging.
- Build marketing campaigns, social templates, a website, search, or a recipe
  library.

## Impact

- Adds the repository-owned exploration under
  `docs/brand-explorations/organic-redesign/` and updates
  `docs/brand-system.md` as the concise authority over that raw material.
- Affects `src/constants/theme.ts`, a small local theme-preference boundary,
  Settings, shared components, onboarding/capture/pantry surfaces, `assets/`,
  `app.config.ts`, and the Android/iOS build asset paths.
- Uses the checked-in PNG collection as the source and records the selected
  production file before replacing Expo and Android asset paths.
- Adds one local appearance preference. It adds no account data, APIs,
  credentials, analytics, or runtime network requests.
