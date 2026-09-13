## Why

Today currently places the entire meal planner before calorie and macro tracking, forcing two different daily tasks into one long scroll. The selected cuisine chooser concept needs a focused implementation that preserves Claude's planner foundation and Mise's existing illustration style.

## What Changes

- Add two subpages within Today, labelled exactly **Meal plan | Calories**, as explicitly requested by the owner. Keep the four bottom destinations and central Add action.
- Give each subpage its own scroll position and one date navigator. Place calorie, macro, and fibre summaries at the start of Calories, above the meal history.
- Keep Day/Week planning inside Meal plan. Replace the duplicated date strips with one appropriate planner rail; use a compact Day/Week view control.
- Make planner and logging return destinations explicit. Approved default: remember the last selected subpage; first use opens Meal plan; logging a meal opens Calories.
- Adapt `docs/ui-overhaul/new-planner-concept/ui for choosing meal and cuisine plan.png`: contextual heading, search, meal controls, illustrated cuisine rail, and larger recipe rows with a clear preview action.
- Keep final scheduling in the existing recipe preview. The concept's direct “Add” button must not bypass portion, dietary, equipment, or occupied-slot review.
- Introduce a bounded cuisine illustration set using the locked Draw Things recipe. Start with Chinese and Japanese staging pilots; approved first-release coverage follows the cuisines supported by the reviewed catalogue. Korean joins the original five after nine reviewed Korean recipes entered the collection on 13 September 2026.
- Connect the ten existing staged planner dish candidates through stable catalogue IDs after content review and native acceptance. Preserve photo precedence and procedural fallbacks for unbounded recipes.

## Capabilities

### New Capabilities

- `today-task-pages`: Separate Meal plan and Calories views, date/scroll ownership, task-aware return navigation, and accessible nutrient placement.
- `illustrated-cuisine-chooser`: A contextual, truthful meal/cuisine picker with labelled illustration controls, filter recovery, and explicit preview-before-scheduling.
- `planner-illustration-assets`: Reproducible cuisine candidates and stable-ID planner dish integration with provenance and native review gates.

### Modified Capabilities

None in the current main spec tree. The predecessor's `planner-first-home` and `meal-plan-recipes` capabilities still live in the active `lead-with-weekly-meal-planning` change. Reconcile its home-ordering language before applying this follow-up; do not duplicate its scheduling or grocery contracts here.

## Impact

- UI: `app/(tabs)/index.tsx`, `app/plan/picker.tsx`, planner components, existing logging/planning return callers, and new reusable Today/cuisine/recipe visual components.
- State: reuse `dayStore` and `mealScheduleStore`. Add only a local subpage preference and route presentation state; no new meal or scheduling database is planned.
- Assets: `assets/illustration-briefs.json`, `scripts/asset-inventory.ts`, illustration manifest/schema, typed registries, and illustration parity tests.
- Decisions: supersede decision **199** only where it requires calories below the planner. Retain decisions **9–11**, **15**, **31**, **36**, **65**, **198**, and **200**.
- Dependencies: build on the uncommitted `lead-with-weekly-meal-planning` implementation and preserve its unresolved verification gates. Do not archive or re-check its tasks from this proposal.
- Owner choices, answered 8 September 2026 and resolved in `.scratch/today-calories-cuisine/`: cuisine breadth follows the reviewed catalogue rather than concept artwork, and ordinary entry restores the last selected subpage with Meal plan as the first-use default. The catalogue expansion on 13 September 2026 therefore adds Korean while Thai and Vietnamese remain excluded.

## Non-goals

New bottom tabs; automatic logging or pantry depletion; a new recipe recommendation engine; copying photographic food art from the concept; changing the shared illustration style, fonts, or global brand; new micronutrient calculations; solving the separate demo-receipt runtime defect; deployment or publication.

## Work started with this proposal

The owner also requested asset generation. The cuisine set is registered as **blocked on UI**, with two subject briefs and the existing dish style suffix copied exactly. Only staging pilots are authorized here. The app UI, shipped asset manifests, and existing planner implementation remain untouched by this proposal work.
