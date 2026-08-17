# Global Quick Input sheet + More/Settings hub

**Screenshots:** `quick-input-sheet.jpg, more-settings-hub.jpg`
**Cronometer tier:** free

## What it does

Tapping the central "+" tab from anywhere opens a 9-action bottom sheet:
Suggest Food, Add Food, Scan Food, Add Biometric, Add Note, New Fast, Add
Exercise, Photo Log, Voice Log. The More tab is the settings/hub screen:
Account, Profile, Targets, **Fasting**, Display, Connect Apps & Devices,
Sharing, Referrals, Support, About.

## UI pattern observed

The "+" sheet is the single global entry point for every kind of logging —
one tap from any tab reaches all nine capture types, rather than each tab
having its own local add button. More is a plain settings list, chevron
rows to sub-screens.

## Implied data model

"New Fast" implies a fasting-window timer/state machine (start time, target
duration, active/complete). "Add Note" implies a freeform text log entry
type distinct from a food/biometric/exercise entry. "Voice Log" implies
speech-to-text food entry as a capture method alongside photo/barcode/text.

## Gap-check against Mise

- **Already have:** Photo Log ≈ Mise's photo capture; Scan Food ≈ barcode
  capture; Add Food ≈ manual entry; Add Biometric ≈ weight logging exists
  per the Diary screen's "Weight" row.
- **Missing entirely:** **Fasting** (a full feature — timer, history,
  streaks in most fasting apps — not present anywhere in Mise's specs or
  decision ledger), **Voice Log** (no speech-to-text capture path exists),
  **Add Note** (freeform log entry unconnected to food/biometric).
- **Structural gap, not a feature gap:** Mise's capture entry points are
  scattered per-screen (barcode review, receipt review, meal capture) per
  `add-unified-capture`, rather than one global "+" reaching every capture
  type from anywhere. Worth checking whether `add-unified-capture`
  already intends this and it's just not built yet, vs. a genuinely new
  idea.

## Verdict

**Adopt (Voice Log)** — cheap, fits the existing vision-capture pipeline
(swap image input for a transcript), and closes an accessibility gap photo
capture doesn't cover (hands-full moments, eating out).

**Reject (Fasting)** — a fasting timer is a genuinely separate product
surface (streaks, windows, reminders) with no connection to pantry
depletion or meal logging; it would be scope creep unless the user
specifically wants Mise to grow into that space.

**Adapt (global quick-add entry point)** — worth checking against
`add-unified-capture`'s existing scope before treating as new; if it's not
already the plan, a single global "+" is a real UX improvement over
scattered per-screen add buttons.

**Linked OpenSpec change:** `none yet` for Voice Log; check
`add-unified-capture` before proposing the global entry-point change.
