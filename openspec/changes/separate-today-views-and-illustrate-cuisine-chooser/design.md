## Context

See `proposal.md` for scope. This design builds on the dirty worktree, not just committed base `5814bf2`.

### Claude handoff aligned with current evidence

| Handoff item | Current evidence | Consequence |
| --- | --- | --- |
| Planner flow implemented | `app/plan/`, `src/components/planner/`, schedule/grocery queries and store exist | Reuse operations, snapshots, batch accounting, and review integration |
| Calories placed below planning | `app/(tabs)/index.tsx` renders `PlannerHome` before calorie hero and `DailyTargetSummary` | Split the content into task pages |
| Duplicate day rails | `docs/ui-overhaul/planner-native/09-week-view.png` shows both rails | Give each page one date navigator |
| 1,853 passing tests reported | Claude's final message, 8 September at 17:10 UTC | Historical report; do not present as a fresh full-suite run |
| Native walkthrough | Existing screenshots inspected; files show planner/chooser/Shop states | Baseline evidence only, not acceptance of this design |
| Dark theme unverified | Explicitly disclosed in Claude's final message | Retain dark-theme native gate |
| Ten new dish images staged | Ten `planner-*` candidates have raw PNG, WebP, and sidecars; inventory reports dish 7/17 shipped | Reuse candidates after review; do not regenerate by default |
| Artwork can be promoted | Planner uses `DishVisual` without catalogue IDs; registry tests permit only old templates | Promotion alone is insufficient; build stable-ID rendering and update the bounded-ID guard |
| Demo receipt error | Claude traced a seeded nonexistent receipt URI; not independently reproduced here | Record separately; do not erase real data to get screenshots |

The current Today read model supports energy, protein, carbohydrate, fat, and fibre. The micronutrient spec describes canonical data, not a complete daily vitamin dashboard. This change moves existing summaries; it does not invent missing per-meal micronutrient totals.

## Goals / Non-Goals

**Goals:** Preserve the existing planner's invariants while making its task and calorie tracking independently reachable. Match the selected chooser composition using the current food illustration system.

**Non-goals:** Replace databases, redo planner calculations, expand provider behavior, add new health metrics, or replace the global design system.

## Decisions

### 1. Two task pages within the existing Today destination

Use exactly `Meal plan | Calories`. Keep the selector outside the page scroll content so it remains reachable. Use tab semantics and an announced selected state.

```text
Today destination
  Meal plan | Calories       persistent task selector
  Meal plan                  Calories
    plan date / week           logged date / history
    one planning day rail      one logged-date strip
    next meal + agenda         compact energy summary
    Day/Week view menu         fibre + protein/carbs/fat
    groceries / dinner         logged meals + analytics
```

Extract Calories content from `app/(tabs)/index.tsx` into a focused component, such as `src/components/today/CaloriesPage.tsx`. Keep `PlannerHome` as the planning container. The selector is shared; scroll position belongs to each page. Store scroll offsets by page/date, restoring a same-date revisit and starting at the top after an explicit new-date selection.

Do not keep hidden interactive trees accessible. Preserve drafts in the existing store rather than relying on both trees staying mounted. Switching pages must not commit, cancel, or replace a draft. Resolve any active modal through its existing Save/Cancel behavior before switching the underlying task.

Alternative considered: three peer tabs for Today, Week, and Calories. Rejected because Today and Week are two views of one task; Calories is a different task. Use a compact Day/Week menu within Meal plan instead of stacking two segmented controls.

### 2. Separate planning dates from logged dates

`dayStore.selectDate()` rejects future dates. The current Today callback sends the same date to that store and the planner, so future planning cannot safely derive its heading from `dayStore.selectedDate`.

Use `mealScheduleStore.selectedDate` for Meal plan and `dayStore.selectedDate` for Calories. Each visible heading, rail, query, and action uses its page's date. Preserve those dates independently when switching pages. A future plan must never silently show today's meals under tomorrow's heading.

Keep the existing logged-date following policy: ordinary returns can resume today, while an explicit history visit persists within that visit. Scope `resumeFollowing()` to actual navigation lifecycle, not to every subtab render. Planner focus reloads the intended week without discarding pending changes. Ignore late loads for a previously selected week.

Calendar controls are page-specific: Meal plan permits future dates; Calories retains the existing history constraint. Future planned dates never enable future meal logging.

### 3. Explicit return navigation outranks the default tab

Ordinary-entry policy, approved by the owner: persist a small local `meal-plan | calories` preference, initially Meal plan. Explicit routes override it.

| Arrival | Page | Date/context |
| --- | --- | --- |
| First ordinary Today entry | Meal plan | Current planning day |
| Later ordinary entry | Last chosen tab | Existing date-following policy for that task |
| Manual/review meal save | Calories | Actual saved meal date, with highlight |
| Planner recipe save | Meal plan | Scheduled date and prior Day/Week view |
| First scheduled meal from onboarding | Meal plan | Saved week's Week view |
| Analytics/history return | Calories | Inspected logged date |
| Cancel recipe preview | Picker | Search, cuisine, meal type, date, scroll retained |

Use explicit `todayPage`, date, and planner-view presentation parameters. Preserve old `savedMealId` and `plannerView=week` links as compatibility inputs. Consume transient parameters once; changing tabs later must not replay them. `PlannerHome` currently reads `initialView` only in `useState`; replace that one-time initialization where a live handoff needs to change the view.

The central Add action retains its existing meaning. “Choose lunch” schedules an intention; it must not become a second generic meal-log action.

#### Caller map

Every existing route into Today, and what it must resolve to. `todayPage` is the new transient parameter; `savedMealId` and `plannerView` are the pre-existing ones and stay accepted.

| Caller | Sends | Page | Date it lands on |
| --- | --- | --- | --- |
| `app/review.tsx` save | `savedMealId`, `todayPage=calories` | Calories | `dayStore` is already moved to `stored.localDate` by `addMeal`/`updateMeal`; the route does not re-select it |
| `app/manual.tsx` save | `savedMealId`, `todayPage=calories` | Calories | same |
| `app/dinner.tsx` cook-and-log | `savedMealId`, `todayPage=calories` | Calories | same |
| `app/plan/recipe.tsx` schedule | `todayPage=meal-plan`, `date` | Meal plan | the scheduled date, selected in `mealScheduleStore` |
| `app/onboarding/first-schedule.tsx` first plan | `plannerView=week`, `todayPage=meal-plan` | Meal plan, Week | the saved week |
| `app/onboarding/first-schedule.tsx` skip, `first-plan.tsx`, `results.tsx`, `appliances.tsx`, `energy.tsx`, `starter-pantry.tsx`, `(tabs)/settings.tsx`, `(tabs)/pantry.tsx` | nothing | stored preference, Meal plan on a fresh install | each page's own existing date policy |
| `app/analytics.tsx` back | nothing | whichever page is already selected, which is Calories because that is where it was opened from | the inspected logged date, which `dayStore` still holds because a history pick clears `following` |
| `app/plan/recipe.tsx` cancel, `app/plan/meal.tsx` back | nothing | the picker or plan page below, still mounted with its own state | unchanged |

Rules the resolver holds to. An unrecognised `todayPage` value is ignored rather than treated as a page. A `date` that is not a valid local date is ignored. Every transient parameter is cleared once it has been applied, so a later manual page switch is not undone by a replay. Only a manual selection writes the stored preference; a routed one does not, so logging a meal does not silently make Calories the default for someone who plans.

### 4. Calories first viewport

Order content as date context, compact energy summary, and fibre/macros; place the meal contribution rail and logged-meal history below. Setup/demo banners cannot precede the summaries. Keep existing analytics drill-down and dinner-gap actions.

At normal text size on the 411 dp baseline phone, the energy summary and all four supported nutrient summaries must be visible without scrolling. At 320 dp and 200% text, allow reflow and vertical scrolling within Calories rather than clipping values. The task selector and nutrient heading remain directly reachable without traversing planning content.

Preserve no-target, no-meals, loading, partial, and all-unknown states. Use known subtotals with explicit incomplete coverage. Do not present a partial day's remaining calorie estimate as a complete total. No target is not a zero target.

### 5. Translate the selected chooser faithfully

Authority: `docs/ui-overhaul/new-planner-concept/ui for choosing meal and cuisine plan.png`. The attached wordmark crop is contextual reference, not authorization to generate a new logo. Keep existing fonts/tokens; do not apply the stale global “Market Instrument” replacement direction from `DESIGN.md` to these surfaces.

Preserve the concept's hierarchy: contextual heading, short purpose line, search, Breakfast/Lunch/Dinner controls, horizontal illustrated cuisine rail, divider, recipe rows with substantial thumbnails. At narrow widths, wrap row content and put its action below the metadata. Do not compress long recipe names to fit a decorative crop.

Use `Recipes for your plan`, not `Recommended for your week`: the catalogue has no personalized recommendation ranking. Use `Preview for lunch` on a picker row. The preview's final button can say `Add to Tuesday's lunch`, after portions, conflicts, and requirements are reviewed.

Derive the heading and action from the current selected meal type, not the incoming route's original meal type. In replace mode, lock the original slot's meal type; use the separate Move operation for a different slot. This prevents replacing one slot while displaying another as the target.

Search and cuisine filtering must have one explicit scope. Authored recipes use their real tags. Saved recipes without cuisine metadata appear under a clearly labelled saved section when All is selected; they do not masquerade as cuisine matches. Under a cuisine filter, offer `Show saved recipes` to clear the cuisine filter while retaining search and date. Never infer cuisine from a title or illustration.

Empty, loading, and failed saved-recipe reads are distinct. A failed read needs Retry; it must not read as an empty collection. Clear filters preserves the target date and meal slot. Changing meal type retains the cuisine selection; zero matches explain the combination and offer recovery.

### 6. Cuisine controls and release coverage

Use labelled circular illustration tiles with selection expressed by a native border, label treatment, and accessible state. Keep All as a vector/native control. Keep labels outside generated pixels. Keep navigation arrows, ticks, borders, and the central Add vector-based.

Approved shipping vocabulary follows the reviewed collection: Chinese, Japanese, Korean, Italian, Mediterranean, and International. Korean joined after nine reviewed Korean recipes entered the catalogue on 13 September 2026; it was not inferred from the reference artwork. These choices have uneven availability by meal type, so show truthful empty states or counts. Do not fabricate Thai or Vietnamese matches to mimic the reference. Broader cuisine coverage remains a separate recipe-authoring decision, not an inferred authorization.

Create stable lowercase cuisine IDs mapped explicitly to existing catalogue labels. Saved recipes with unfamiliar labels keep a neutral labelled fallback. Do not turn the artwork registry into the cuisine source of truth.

### 7. Keep cuisine art and dish art separate

Cuisine art is a reusable filter symbol. A sushi illustration can label Japanese without claiming the selected recipe is sushi. Dish art claims a specific authored recipe and must depict only its actual ingredients.

The owner requested generation during planning, so the only implementation started here is the blocked cuisine inventory and subject briefs. Chinese/Japanese use the exact existing dish suffix; no model, renderer, shared suffix, or workflow-version change is needed.

Pipeline prerequisites before shipping:

1. Add `cuisine` to the illustration manifest schema's key, set, and filename constraints.
2. Add a typed cuisine registry with static `require()` literals and a labelled failure fallback.
3. Build the cuisine rail consumer before declaring `consumerWired: true`.
4. Add manifest/file/registry/ID parity checks and prevent promotion while required destinations are missing.
5. Generate the remaining approved subjects through `art:make`, using derived seeds and provenance sidecars.
6. Review candidates at the intended control size, light/dark backgrounds, and large text.
7. Promote only named, accepted assets through the pipeline with an actual human reviewer; verify checksums and native rendering.

Raw PNGs remain 1024 square. Review WebPs remain 512 square, quality 90. Preserve ivory paper and grounding shadows. The native circular frame must not crop away the food or simulate transparent source artwork. If the paper tile conflicts with a dark background, adjust the native frame treatment rather than removing paper pixels.

For the ten existing planner dish candidates, extend valid IDs to the union of `STARTER_MEAL_PREP_TEMPLATES` and `PLANNER_CATALOGUE`. Add a shared planner recipe visual resolver using source kind and stable source ID. Catalogue art must never be selected by free-text title. Photos retain precedence; failed photos or bundled art must reach a useful fallback. Pass known ingredient food classes to procedural rendering so it does not default to an empty ring when the snapshot contains usable ingredients.

`DishVisual` currently ignores the curated dish registry. Add a dedicated wrapper or explicit authored-ID path; promotion cannot substitute for this work. Include picker, preview, planned-meal detail, agenda rows, and Up next in the consumer audit.

### 8. Align active planning documents without erasing Claude's work

Before UI implementation, append a superseding entry for decision 199's vertical ordering and link this change from the predecessor. Update only conflicting Today layout and picker appearance language. Keep the predecessor's persistence, grocery, batch, onboarding, and acceptance requirements.

`guide-into-first-prep-plan` retains any separable onboarding work. Do not reimplement its bridge or mark either predecessor complete from this follow-up. The new task list names concrete integration tests rather than accepting checked boxes as proof.

## Risks / Trade-offs

- [Tab restoration surprises existing users] → Explicit task-return routes override preference; first use still leads with planning.
- [Planning dates leak into actual intake] → Page-owned dates, tests for future-week selection, and no future logging relaxation.
- [Beautiful but empty cuisine filters] → Derive content coverage from real recipes; separate content expansion from illustration availability.
- [Promoted dish art still shows rings] → Stable-ID consumer integration and native evidence across all planner surfaces.
- [Old style documents conflict with selected concept] → Scope visual authority to this change and the existing illustration recipe; do not silently rewrite global design documents.
- [Two active OpenSpec changes conflict] → Reconcile only overlapping requirements before apply; preserve earlier unresolved proof gates.
- [Micronutrient language implies features not implemented] → Calories includes current supported summaries; daily vitamin/mineral totals need a separate evidence-backed change.

## Migration Plan

No database migration is planned. A local preference is optional presentation state and must not alter meal records. If persistence requirements change, append a forward-only migration; never edit an existing migration.

Implement the page split first, then the chooser and artwork integration. Preserve all existing dirty changes. A UI rollback restores the previous composition without deleting schedule, grocery, or meal data. Release only after the named native checks; publication is outside this request.

## Owner decisions

Both open questions were answered on 8 September 2026 and their Wayfinder tickets are resolved in `.scratch/today-calories-cuisine/issues/`.

- **Cuisine breadth.** The release covers the six cuisines recorded in the reviewed `PLANNER_CATALOGUE` — Chinese, Japanese, Korean, Italian, Mediterranean, and International. Korean joined on 13 September 2026 when nine reviewed recipes began carrying that label. Thai and Vietnamese stay out until reviewed recipes carry those labels.
- **Ordinary entry.** Today restores the last manually selected subpage; a first entry with no stored preference opens Meal plan. Explicit route intent always outranks the preference and is consumed once.

Both were previously recorded as recommendations. They are now recorded decisions, and the requirements below read as approved rather than proposed.
