## Context

Mise has a compact warm token system, a raster launcher icon, and existing Expo
icon paths. The supplied `assets/brand/icon-concepts/` PNG collection is the
chosen source of truth. A later owner-supplied ZIP contains a complete Organic
web design system, a clickable app prototype, and nine rounds of logo and
positioning exploration. Its three bundled brand PNGs match the existing
repository files byte-for-byte. The user explicitly does not want Figma, Canva
layer separation, SVG reconstruction, masks, or Apple Icon Composer work.

The prototype predates current product work and includes stale functional
assumptions such as Anthropic-only setup and an earlier screen map. Its visual
and copy ideas are useful; its behavior is not authoritative.

## Goals / Non-Goals

**Goals:**

- Use `2.png` and `7.png` as the current lighter-dark and pure-dark iOS icon
  variants.
- Preserve every supplied PNG unchanged with a descriptive filename.
- Preserve the useful non-duplicated ZIP source in the repository with clear
  provenance and an authority boundary.
- Export only the raster assets required by the current Expo iOS and Android
  configuration, then verify them on real launcher surfaces.
- Keep app visual-system work token-led and component-led.
- Reconcile the Organic direction with the current mobile system before an
  exact palette or font-family change reaches production.

**Non-Goals:**

- No Figma file, editable construction master, generated layers, vectors,
  `.iconcomposer` source, or bespoke iOS tinted/clear variants beyond the two
  supplied light and dark PNGs.
- No regenerated geometry, recolouring, or retouching of the supplied icon
  artwork.
- No wholesale port of the web prototype, its CSS classes, its behavior, or its
  generated design-document runtime into the React Native app.

## Decisions

### 1. Supplied PNGs are the source of truth

The supplied files remain under `assets/brand/icon-concepts/`. The owner
chooses one exact file as the production icon. Other files remain approved
alternatives, not inputs to a reconstruction workflow. The production asset is
only resized or placed into the existing Expo asset slots; its composition and
pixels are not redesigned.

The ZIP's spoon, steam, monogram, and alternate lockup sketches remain
historical exploration. They do not supersede the selected glass-bowl icon.

### 2. Expo delivers two supplied iOS PNG variants

The managed Expo configuration sets `ios.icon.light` to `2.png` and
`ios.icon.dark` to `7.png`. Tinted is omitted. This provides the two approved
appearance treatments without Figma, Icon Composer, or a native Xcode project.

### 3. Android uses supplied `1.png`

Original `1.png` supplies Android's regular launcher icon and adaptive
foreground. Pixel Minimal-mode testing rejected the legacy monochrome asset
because it rendered as an unrelated chevron-like glyph. Do not configure it;
use Android's full-colour fallback until a purpose-built monochrome Mise export
is approved. The full-square source must pass circular and squircle launcher
review before it is accepted as the Android production icon.

### 4. Review happens on launchers, not in a design tool

Review the selected PNG at actual home-screen size on iOS and Android, then in
Android circular and squircle launchers and themed icon mode where available.
Record the exact selected source filename, build, device, and outcome. If it is
weak, select another supplied PNG; do not redraw it to solve the issue.

### 5. Keyboard-safe layout is a shared interaction rule

`Screen` and `Sheet` own keyboard avoidance rather than each form making a
platform-specific guess. On Android they must resize their usable area when the
keyboard appears; on iOS they retain padding-based avoidance. Scrollable forms
must keep a focused value, label, and submit path reachable. Responsive option
controls must preserve whole labels rather than squeezing words into stacked
letters.

### 6. The Organic ZIP is a repository-owned reference, not app authority

Preserve `Mise.dc.html`, `Mise Logo.dc.html`, `support.js`, and the associated
`_ds/` source under `docs/brand-explorations/organic-redesign/`. Repoint image
references to the existing `assets/brand/icon-concepts/` files instead of
checking in duplicate PNGs. Omit the stale Git snapshot and generated duplicate
uploads. Document checksums and provenance in the exploration README.

For conflicts, authority order is: `docs/product-decisions.md` and accepted
OpenSpec requirements, current React Native behavior, then the prototype. This
lets future reviewers inspect the brainstorming without accidentally reviving
old onboarding, provider, or navigation behavior.

### 7. Three themes share one semantic system; Organic is the default

The owner clarified that “too warm” meant lower the temperature of the Organic
palette, not replace its colour scheme with green. Mise therefore ships three
named choices through the existing semantic roles:

- **Organic** — default. Cream `#F3EDE4`, sand `#EBE3D8`, warm ink `#211F1D`,
  terracotta action `#A95A35`, softened paprika `#A45239`, wheat `#B68A43`, and
  sage/olive `#74825F`. These stay in the supplied hue family while removing
  some yellow from the large surfaces.
- **Utility** — the current production putty `#EDEAE4`, white surface, near-black
  ink, paprika, wheat, and olive system. Its primary action remains ink.
- **Cool Organic** — stone `#F2F1EC`, near-white `#FAFAF7`, soft charcoal
  `#202522`, juniper action `#4F7067`, muted clay `#B96F4F`, wheat `#A98236`,
  and olive `#6C7B52`.

Every palette supplies the same `ground`, `surface`, `ink`, `muted`, `line`,
`action`, `onAction`, `paprika`, `wheat`, and `olive` roles. Screen code never
checks a theme name. Shared action components consume `action`; factual macro
components retain their macro roles. Camera evidence remains faithful and uses
its governed overlay roles.

The preference is local and synchronous at startup so module-level React Native
styles resolve against the selected palette before they are created. Changing
the preference writes the small local value and reloads the Expo application;
this avoids refactoring every static `StyleSheet` into parallel theme-aware
screen code. An absent, malformed, or unavailable preference falls back to
Organic. No main data migration is needed.

This gate favours a reversible, evidence-backed token migration over an
immediate wholesale reskin. It also keeps the ZIP's brainstorming status
honest.

### 8. Carry forward the Organic composition language across themes

The portable direction is left-aligned asymmetry, generous negative space,
soft circular accents, over-rounded feature containers, and restrained pill
controls. Geometry stays consistent when a person changes theme; only semantic
visual values change. Shared primitives in `src/components/` own the resulting
geometry. Touch targets, large-text layout, keyboard safety, and
platform-native behavior take priority over matching the HTML prototype.

Lucide remains the icon vocabulary where already used; a heavier rounded stroke
may be adopted only through a shared icon wrapper or shared constant. Washed
photography is limited to editorial or marketing imagery. Camera evidence,
receipts, and meal photographs under review retain faithful colour and contrast.

### 9. Positioning has promise, trust, and literal tiers

Use “Cook from what you have, tracked as you go.” as the preferred product
promise candidate. It describes the pantry-to-meal loop without making pantry
the whole product. Use “On your phone. Nowhere else.” only as a compact trust
line beside precise explanation of local storage, no Mise account, and no Mise
server. Copy must still disclose that provider-backed analysis sends selected
content to the configured provider. It must not claim that all data or images
never leave the phone.

Store titles, screenshot captions, and marketing descriptions may use literal
capture → pantry → dinner → privacy sequencing later, but they remain outside
this app-system implementation.

### 10. Macro dots are a processing state, not a logo ornament

The paprika, wheat, and olive dots may replace a generic spinner for active food
analysis in capture and receipt flows. The treatment always includes a visible
status label, accessible busy semantics, a static reduced-motion form, and the
underlying operation's existing timeout or recovery action. Do not add the dots
as a decorative divider, app-icon alteration, or proof of progress when no
operation is active.

### 11. The empty-pantry idea becomes a brief, not unreviewed artwork

The accepted brief is a single half-empty shelf, warm ground, ink outline, one
olive or sage accent, generous negative space, meaningful alt text, and copy
that names the real next actions. Finished artwork still requires the same
asset and accessibility review as every other approved illustration role.

## Risks / Trade-offs

- [The chosen PNG is weak at small size] → Test it before replacing production
  asset paths and select another supplied PNG if necessary.
- [Android mask or themed rendering is weak] → Keep the previous Android asset
  until a supplied alternative or the monochrome PNG passes device review.
- [Keyboard hides an active value] → Correct the shared Screen/Sheet layout and
  verify manual entry, meal review, and hidden-ingredient entry on Android and iOS.
- [The team later needs a tinted iOS variant] → Create a new explicitly
  approved change; do not add authoring tooling indirectly to this one.
- [The Organic system overwhelms data-dense screens] → Review it on Today,
  Pantry, capture/review, recipes, onboarding, and Settings before accepting
  exact fonts, radii, or values.
- [A privacy headline overpromises] → Pair it with precise provider-boundary
  copy and reject “nothing leaves your phone” in contexts where analysis can
  send content to a configured provider.
- [The prototype regresses current behavior] → Treat it only as a visual/copy
  reference and validate all implementation against current screens and specs.
- [Macro-dot motion becomes decoration or hides a stalled operation] → Keep a
  text status, reduced-motion state, and the existing recovery boundary.

## Migration Plan

1. Preserve the Organic exploration source and document its authority boundary.
2. Record the three-theme owner decision in `docs/brand-system.md`, with
   reduced-warmth Organic as the default.
3. Record `2.png` and `7.png` as the approved iOS variants and `1.png` as the
   Android regular icon.
4. Configure the supplied PNGs in the existing Expo iOS and Android asset slots
   without deleting the previous files until review passes.
5. Update `app.config.ts` only after the output paths and device checks pass.
6. Add local preference selection, resolve the palette before static styles are
   created, and reload after a Settings change. Migrate shared action primitives
   to the semantic action role before reviewing individual screens.
7. Record iOS and Android launcher and accessibility results in the owner
   checklist.
8. Roll back visual-system work by restoring the prior semantic token values
   and font loading. Roll back icon work by restoring the previous raster paths.

## Open Questions

- Do the two supplied PNGs pass the owner’s iOS and Android launcher review?
