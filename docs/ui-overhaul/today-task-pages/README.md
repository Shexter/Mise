# Today task pages and the illustrated cuisine chooser — native evidence

Captures from the change `separate-today-views-and-illustrate-cuisine-chooser`, taken while implementing it. They are evidence of what was inspected, not a record of owner acceptance.

## Provenance

| Fact | Value |
| --- | --- |
| Date | 8 September 2026, 14:22–14:43 local |
| Platform | Android emulator only |
| Device | Pixel 10a AVD, `emulator-5554` |
| OS | Android 17 |
| Screen | 1080 × 2424 px, 420 dpi → **411 × 923 dp**, the acceptance phone |
| Build | `com.mise.app` 1.0.0, debuggable debug build, JS from the local Metro dev server on port 8081 |
| Data | The owner's real local database. Nothing was reset, replaced or seeded. |
| Capture | `adb exec-out screencap -p`; images 09 onward are downscaled to 45% for size |

Two device settings were changed during the pass and both were restored afterwards: `font_scale` (2.0, then back to 1.0) and `wm density` (540 for a 320 dp width, then `wm density reset` back to 420). The app's own theme was switched to Midnight Organic and back to Organic through Settings.

## What each capture shows

| File | State |
| --- | --- |
| `01-meal-plan-day-light.png` | Meal plan, Day view, light. Task selector, one week pager, one day rail. |
| `02-calories-first-viewport-light.png` | Calories, light. Energy and all four nutrient summaries above the fold at 411 dp, normal text. |
| `03-day-week-menu.png` | The compact Day/Week menu open. |
| `04-meal-plan-week-light.png` | Week view. Still exactly one date rail. |
| `05-chooser-light.png` | The chooser against the selected concept: heading, purpose line, search, meal pills, illustrated cuisine rail with All and an overflow control, divider, `Recipes for your plan`, substantial thumbnails, `Preview for dinner`. |
| `06-chooser-cuisine-selected.png` | Japanese selected — ring, coloured label, filtered results, and the labelled saved-recipe exclusion with `Show saved recipes`. |
| `07-chooser-empty-combination.png` | Italian + breakfast. The empty combination is named, the cuisine survives the meal-type change, and `Clear filters` is offered. |
| `08-meal-plan-dark.png` | Meal plan in Midnight Organic. |
| `09-calories-dark.png` | Calories in Midnight Organic. |
| `10-calories-200-percent-text.png` | Calories at 200% text. Meter rows stack; no value is clipped. |
| `11-meal-plan-200-percent-text-before-fix.png` | **Defect, since fixed.** `Breakfast` broke mid-word in the meal-slot row's fixed column, and the recipe title truncated. |
| `12-chooser-200-percent-text.png` | The chooser at 200% text. Meal pills wrap; the cuisine label wrapped mid-word here, which is also fixed. |
| `13-chooser-dark.png` | The chooser in Midnight Organic, after the rail fixes. |
| `14-chooser-search-keyboard.png` | Searching with the keyboard up: authored and saved results both filter, saved ones labelled as the person's own. |
| `15-meal-plan-future-week.png` | The plan on next Tuesday, reached with the week pager. Future planning is allowed. |
| `16-calories-keeps-logged-date.png` | Switching to Calories while the plan sits on 15 September: the logged date is still 8 September. |
| `17-calories-history-date.png` | A history date on Calories, with real logged values and a `Today` reset. |
| `18-meal-plan-320dp-before-fix.png` | **Defect, since fixed.** At 320 dp the recipe title truncated to `Pan-seare / d salmon …`. |
| `19-meal-plan-320dp-after-fix.png` | The same row at 320 dp after the fix: the meal type takes its own line and the title is whole. |
| `20-chooser-320dp.png` | The chooser at 320 dp: pills wrap, rows wrap, the action sits under the metadata. |
| `21-calories-confirmation-light.png` | Confirmation pass, light theme, after every fix. |
| `24-recipe-preview.png` | The preview a row opens into: portions, computed nutrition with fibre disclosed as unknown, and the dated final action. No `Check before you schedule` block, correctly — this install has recorded no dietary rules and has never answered the appliance question, so nothing is claimed missing. |
| `22-planner-save-returns-to-plan.png` | A recipe scheduled into next Tuesday's dinner returns to **Meal plan on that date**, not to the picker, with the rail count and Up next updated. |
| `23-synthetic-fixture-removed.png` | The same slot removed again. The owner's plan is exactly as it was before this pass. |

## Defects found and fixed in this pass

1. **`Maximum update depth exceeded` on first render of Meal plan.** The day rail reported freshly-built target arrays on every layout, and the week array itself was rebuilt per render. Fixed by memoising the week and by only reporting measured positions when they actually change.
2. **A sentence beginning mid-phrase.** The chooser's empty state read `today's breakfast is still selected.` Rewritten.
3. **A persistent scrollbar under the cuisine labels** read as a progress bar. Removed; the overflow button and the peeking tile carry discoverability.
4. **`Dinner ideas` looked like body text**, not an action. Given the action colour.
5. **The meal-slot row did not reflow.** Its fixed meal-type column broke `Breakfast` mid-word at 200% text and truncated the recipe title at 320 dp. It now stacks above 1.3× text or below 360 dp, following the same pattern `Meter` already used.

A sixth, older defect was fixed on the way: the drag-to-day hit test compared a gesture's window coordinates against rail-local ones, so a drop almost never matched a day. Targets are now measured in window coordinates and re-measured as a lift begins.

## Not verified, and why

- **Physical device.** None was attached. Gestures, refresh rate and performance are emulator-only here.
- **TalkBack and focus recovery.** TalkBack is installed on this AVD but was not driven; screen-reader traversal and post-edit focus need a real pass.
- **Drag placement on device.** `adb input` cannot reliably produce a long-press-then-drag, and the attempt was swallowed by the system gesture. The corrected hit test is unverified natively. Every drag operation has a labelled tap equivalent, which is what the tests cover.
- **Reduced motion.** No new motion path was added by this change; the sheet and existing components already honour it. Not re-exercised.
- **iOS.** No simulator build of Mise exists on this machine and building one was out of scope for this pass. iOS navigation, safe areas, Dynamic Type, VoiceOver and Back are unverified.
- **A failed saved-recipe read.** Its distinct error and Retry state is covered by tests; it was not forced natively, which would have meant breaking the owner's database.
- **The meal-logging return.** The planner save return *was* exercised natively (captures 22 and 23: scheduled into an empty future slot, verified, then removed, leaving the plan as found). The meal-log return was not: logging a meal on this install would decrement the owner's real pantry estimates, and undoing that is best-effort. Its route contract is covered by tests.
- **Authored dish and cuisine artwork on screen.** Nothing is promoted, so every capture shows the procedural plate and the labelled cuisine fallback — which is the correct pre-acceptance state, and is itself the evidence that the chooser is complete and truthful with zero accepted artwork. Native captures of the artwork itself have to follow promotion.


## 13 September 2026 — artwork accepted and promoted

Timothy Lauw accepted all fifteen candidates. Five cuisine assets and the ten
`planner-*` dish assets were promoted; the seven starter dish assets kept their
original 2 September review date. `art:list`: **167 shipped, 0 ready to make,
0 blocked, no inconsistent slots** (`dish 17/17`, `cuisine 5/5`).

Re-inspected on the same Pixel 10a AVD, 411 dp, light theme, with a scheduled
meal added as a fixture and removed again afterwards:

| File | State |
| --- | --- |
| `25-chooser-with-accepted-artwork.png` | The chooser with real artwork. `All` is still the drawn persimmon bowl, labels are still text under the tiles. |
| `26-cuisine-rail-at-control-size.png` | The rail magnified. At the intended 64 dp the subjects read clearly and the ivory paper sits against the app's own ground rather than looking pasted on. The concern recorded on 8 September — that the food would be too small inside the circle — did not materialise, and no crop was needed. |
| `27-dish-art-resolves-by-stable-id.png` | Six recipe rows, each title resolving to its own painting. No cross-wiring. |

All five consumer surfaces were confirmed showing authored art: picker rows,
preview hero (120 dp), agenda row (44 dp), Up next (32 dp) and the cooking
guide. That was the point of the stable-ID resolver — promotion alone would have
shipped bytes nothing rendered.

### The day rail now reveals the day it is about

The observation recorded above on 13 September — the rail opening at offset zero
and clipping the selected day — is fixed. `WeekDayRail` brings the selected tile
fully into view: centred where the week allows it, flush to an end where it does
not, so the first and last days of a week stay reachable rather than centred
into empty space.

A week the rail has not shown before is *placed* rather than slid to, because
all seven tiles changed and animating between two unrelated sets reads as drift;
changing day inside the week already on screen animates, because that is one
thing moving. Reduce Motion takes the cut in both cases.

The offset itself is pure and unit-tested in `src/components/planner/dayRailScroll.ts`
— every day of the week, at three viewport widths, ends up fully inside the
viewport. Two coordinate systems stay deliberately separate here: a drop is
hit-tested in **window** coordinates because that is what a gesture reports, and
a scroll offset is a **content** coordinate because that is what `scrollTo`
consumes. Mixing them is what made drag placement miss in the first place.

| File | State |
| --- | --- |
| `28-day-rail-reveals-selected-day.png` | 411 dp, Sunday 13 September. Today is fully visible and flush to the right end; it was a clipped sliver before. |
| `29-day-rail-320dp.png` | The same at 320 dp, where the rail scrolls further still. The offset follows the measured viewport, never a device check. |

Week paging was checked in the same round: moving to 31 August – 6 September
placed the new week with Sunday 6 revealed.

## Verification run alongside this pass

| Check | Result |
| --- | --- |
| `npm run typecheck` | passed |
| `npx vitest run` (full suite) | **1952 passed, 1 skipped**, 171 files passed, 1 skipped |
| Focused: `today-task-pages`, `cuisine-chooser`, `planner-recipe-visuals`, `cuisine-asset-staging`, `illustration-registries`, `planner-ui`, `food-visuals`, `dish-visuals` | 8 files, **234 passed** |
| `openspec validate --strict separate-today-views-and-illustrate-cuisine-chooser` | valid |
| `openspec validate --strict lead-with-weekly-meal-planning` | valid |
| `openspec validate --strict guide-into-first-prep-plan` | valid |
| `git diff --check` | clean |
| `npm run art:list` | 152 shipped, 15 ready to make, **0 blocked on UI**, no inconsistent slots; `dish 7/17`, `cuisine 0/5` |
| Gold-master reproduction | `sha256:9b7ad077379ee607378932fda394a9a9b85d3d4dbaa0dc7ffc889434c8043e7a`, byte-identical |

The suite was 1899 before this change's tests were added and 1952 after; every one of the pre-existing tests that referenced Today's single-scroll composition was updated to the two-page contract rather than deleted.
