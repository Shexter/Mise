# Mise UI overhaul concepts

This folder preserves the approved visual concepts from the Impeccable design
experiment on 30 August 2026. It gives product, design, and implementation
agents one stable repository location for the selected screens.

These images are visual references. They are not implemented screens, native
device captures, or proof that the proposed behavior works.

One folder is the exception and says so: `connected-illustrations/` holds native
emulator captures of shipped behaviour, not concepts. See its own README.

## Contents

### App shell

| Order | Screen | Intent |
| --- | --- | --- |
| 1 | [Today with fibre and five-position navigation](app-shell/01-today-fibre-five-position-nav.png) | Accepted Today direction. Fibre is a first-class metric. The center plus opens universal capture. |

The five navigation positions are:

1. Today
2. Pantry
3. Center plus action
4. Shop
5. Settings

The center plus is an action, not another destination. It opens the shared add
surface for meals, receipts, pantry photos, and voice pantry intake.

### Goal-based onboarding

| Order | Screen | Intent |
| --- | --- | --- |
| 1 | [Goal selection](onboarding/01-goal-selection.png) | Select calorie tracking, meal prep, or both with visual toggle cards. |
| 2 | [Appliance selection](onboarding/02-appliance-selection.png) | Select the cooking tools that recipe guidance may use. |
| 3 | [First ingredient scan](onboarding/03-first-ingredient-scan.png) | Add important ingredients already in the kitchen. |
| 4 | [First prep plan](onboarding/04-first-prep-plan.png) | Show one tailored recipe and a tool-aware cooking guide. |

The onboarding branch is conditional:

- Calorie tracking only continues through the existing calorie onboarding.
- Meal prep adds appliance selection, initial pantry intake, and the first prep
  plan.
- Selecting both completes the calorie path and then adds the meal-prep path.
- Skipping pantry setup must never block the rest of the app.

### Voice pantry intake

| Order | Screen | Intent |
| --- | --- | --- |
| 1 | [Add to Mise](voice-pantry/01-add-to-mise.png) | Reach voice intake from the center plus beside meal, receipt, and photo capture. |
| 2 | [Voice setup](voice-pantry/02-voice-setup.png) | Select a storage location and explain the draft-before-save behavior. |
| 3 | [Active listening](voice-pantry/03-listening.png) | Show the live transcript, elapsed time, and stable Pause, Finish, and Cancel controls. |
| 4 | [Batch review](voice-pantry/04-batch-review.png) | Separate clear proposals from items that need review. Unknown amounts remain honest. |
| 5 | [Quick checks](voice-pantry/05-quick-checks.png) | Resolve approximate quantities, existing stock, and ambiguous item states without hidden guesses. |
| 6 | [Confirmed pantry](voice-pantry/06-confirmed-pantry.png) | Confirm the batch, offer Undo, and connect confirmed stock to an optional cooking plan. |

The full behavior contract lives in the
[`add-voice-pantry-intake`](../../openspec/changes/add-voice-pantry-intake/)
OpenSpec change. The key boundary is simple: speech creates a draft. Only an
explicit confirmation changes pantry stock.

## Visual direction

Treat these screens as one visual family:

- Warm cream ground with deep ink text.
- Paprika for the primary action and selected states.
- Sage, mustard, and soft blue for semantic grouping.
- Generous spacing instead of a compact dashboard.
- Expressive display type for major moments and practical sans-serif controls.
- Simple colored two-dimensional food illustrations.
- Clear rules, rows, and sheets instead of nested card stacks.
- Large, direct labels that remain useful while handling food one-handed.

Do not restore the rejected compact layout or the “Mise Local First” badge.
Local-first behavior remains a product requirement, not a decorative label.

## Product details that must survive implementation

- Today keeps Fibre visible beside calories and macronutrients.
- The center plus retains the four add choices shown in the concepts.
- Pantry items created from a photo keep that photo as their row image.
- Voice-created items use the illustration fallback because they have no photo.
- Voice intake preserves approximate and unknown quantities.
- Voice intake never writes stock before batch review and confirmation.
- A confirmed voice batch provides Undo.
- Recipe suggestions use only confirmed pantry stock.
- Appliance-aware guidance uses only appliances the user selected.

## Authority boundary

Use these images for composition, hierarchy, interaction intent, and visual
comparison. Do not use them as the source of behavioral truth.

Authority remains, in order:

1. `docs/product-decisions.md` and accepted OpenSpec requirements.
2. The current React Native implementation and shared components.
3. These UI overhaul concepts.

Meal-prep onboarding still needs its own accepted OpenSpec change before any
production implementation. The voice flow already has a planning package, but
its unchecked tasks do not authorize implementation.

## Known limitations

- The images use synthetic demonstration data.
- They came from image generation, not an iOS Simulator or Android emulator.
- Some concepts use an iPhone frame while others show edge-to-edge UI.
- Native controls, safe areas, Back behavior, and navigation need platform
  adaptation.
- Dark theme, large text, screen readers, tablets, and landscape are not shown.
- “On-device speech” is a desired privacy state, not verified platform support.
- Exact typography, dimensions, and colors still need token and accessibility
  validation before implementation.

## Provenance

- Source thread: `01a05187-71d7-7503-b0cd-b459667eefde`
- Source branch: `experiment/impeccable-design-system`
- Archived: 30 August 2026
- Generator: Codex built-in image generation during the Impeccable experiment

The descriptive filenames and flow order are repository-owned. The original
generated files remain outside the repository so this archive does not depend
on session storage.
