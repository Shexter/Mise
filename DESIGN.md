# Design System

<!-- impeccable:design-schema 1 -->

## Direction

**Market Instrument** translates the directness of produce-crate labels, wholesale market tickets, and kitchen order rails into a precise native interface. It should feel authored for food routines: fast to scan with occupied hands, confident around uncertain data, and materially connected to groceries without becoming rustic decoration.

This replaces the soft-organic baseline for the experiment. It is not a reskin of wellness cards and it is not a literal vintage label collage.

## Mode and Scene

Mise is an **Operate** interface used in short, repeated kitchen and shopping moments. Hierarchy and correction speed outrank spectacle. Brand expression appears in decisive typography, ruled structures, honest labels, restrained material cues, and one authored transition per important state change.

## Visual World

- Warm uncoated-paper grounds paired with aubergine-black ink.
- Persimmon marks primary action and time-sensitive attention.
- Leaf green communicates available or on-track states; cornflower blue carries analytical comparison.
- Broad fields, hairline rules, and open list structures replace default card stacks.
- Large display numerals and short titles can use condensed, label-like proportions; body copy remains calm and highly legible.
- Registration marks, stamps, and label geometry are allowed only when they clarify grouping or state. They never become decorative noise.

## Typography

- Display moments use the existing Fraunces family only where its expressive numerals remain useful during the transition. The intended durable direction is a distinctive condensed display face, subject to adding a properly licensed font asset.
- Archivo remains the legible interface family for body, controls, captions, and dense data.
- Hierarchy is earned with scale, weight, width, and placement. Do not add eyebrow text above headings.
- Numeric data uses tabular figures. Dynamic content must reflow at larger accessibility sizes.

## Color Roles

The semantic contract in `src/constants/themePalettes.ts` remains authoritative: `ground`, `surface`, `ink`, `muted`, `line`, `action`, `onAction`, food accents, and chart roles. The experiment may change their resolved values and add semantic roles, but components never introduce local hex values.

- `ground`: warm paper, not yellow beige.
- `surface`: a lighter label stock or ink-tinted structural field.
- `ink`: aubergine-black rather than pure black.
- `action`: persimmon, reserved for actions and selected state.
- Status and chart colors must maintain their distinct meaning across every theme.

## Shape, Rule, and Depth

- Use rules and spacing before containers.
- Cards are reserved for content that behaves as one movable or tappable object. Do not nest cards.
- Default containers become squarer and more editorial, while controls retain ergonomic rounding.
- Elevation is rare. A wide soft shadow may identify a lifted sheet or floating action; bordered cards do not also receive a shadow.
- Pills are reserved for compact selectable controls and status tags.

## Components

- **Screen headers:** decisive title, optional aligned utilities, clear separation into the next task region.
- **Day rail:** a structured strip with an obvious selected segment and restrained evidence marks.
- **Primary metric:** asymmetric figure-plus-context composition; never a generic metric card.
- **Lists:** ruled rows with stable leading/trailing columns and strong typographic alignment.
- **Buttons:** filled persimmon primary, ink/surface secondary, text-like ghost. Labels name the action.
- **Fields:** visible label, strong focus/error rule, comfortable native input behavior.
- **Navigation:** native tab/navigation behavior with Market Instrument color and typography. Preserve system Back and safe areas.
- **Empty and recovery states:** useful next action first. Illustration is optional and must belong to one reusable asset system.

## Motion

- Motion explains a changed object or state; it does not decorate screen arrival.
- The primary authored moment is a short registration-like settle when a log or capture becomes confirmed: content aligns into place rather than bouncing.
- Respect Reduce Motion with a crossfade or immediate state change.
- Keep navigation, sheets, keyboard, and system gestures platform-native.

## Platform Adaptation

- Android uses Material navigation and 48 dp touch targets; iOS preserves system navigation, edge-swipe Back, and 44 pt touch targets.
- Compact widths use the current four-destination bottom navigation. Expanded layouts must restructure rather than stretch.
- Safe-area and keyboard insets remain non-negotiable.
- The bolder visual layer may not replace platform controls with web-shaped imitations.

## Accessibility

- Body and placeholder text meet 4.5:1 contrast; large display text meets 3:1.
- Selection and status never rely on color alone.
- Screen-reader labels name actions and uncertain states plainly.
- Large text, long ingredient names, and localized copy must wrap without hiding actions or values.
- Every motion path has a reduced-motion equivalent.

## Anti-References

- Soft beige wellness minimalism.
- Generic SaaS cards, nested cards, and rounded-square icon tiles.
- Purple-to-blue gradients, glassmorphism, decorative blur, and gradient text.
- Rustic chalkboards, faux handwriting, gingham, or literal produce-crate cosplay.
- Clinical dashboard density that implies false precision.
- Mascots, body-evaluating imagery, medical authority, or invented health claims.

## Quality Bar

The direction must remain recognizable across Today, Pantry, Shop, Settings, onboarding, capture/review, sheets, loading, empty, error, and disabled states. A bold Today screen beside untouched generic forms is incomplete. Verification requires representative Android and iOS size classes where available, plus typecheck and focused UI tests; browser rendering is reference-only for this native app.
