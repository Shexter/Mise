# Incumbent native baseline — before the weekly planner

Task 1.4 of `openspec/changes/lead-with-weekly-meal-planning`. This folder is
**device evidence of what Mise does today**, captured before any planner code
exists, so the switch of Today's hierarchy can be judged against something real
rather than against the older concept boards in the sibling folders.

Nothing here shows a planner. Every screen is the incumbent app.

## Capture provenance

| Field | Value |
| --- | --- |
| Captured | 2026-09-07, 20:24–20:34 local |
| Build | `app-release.apk`, built 2026-09-02 01:08 from commit `5814bf2` |
| Build identity confirmed in-app | Settings footer reads `Mise 1.0.0 · source 5814bf2eacf2` |
| Working tree at capture | `5814bf2` plus three uncommitted art files (`assets/food/manifest.json`, `assets/food/pork-belly.webp`, `assets/illustration-briefs.json`) — none of which affect these screens |
| Device | Android emulator, AVD `Pixel_10a`, `sdk_gphone16k_arm64` |
| OS | Android 17 (SDK 37) |
| Screen | 1080 × 2424 px at 420 dpi = **411 × 923 logical dp** |
| Fixtures | The app's own **Settings → Load complete demo dataset** (57 meals over 28 days, 24 pantry items, 4 saved recipes, 5 shopping rows, body-composition data). Synthetic throughout; no real household data. |
| Capture method | `adb exec-out screencap` driven by `adb shell input tap/swipe` |

### What this is not

- **It is not a development client.** `expo-dev-client` is not a dependency of
  this project; `eas.json` declares a `development` profile but no such build
  exists locally. The persistent session the Mobile UI brief asks for at
  implementation time was therefore approximated with a **release APK built
  from HEAD**, which is adequate for a *before* baseline and is not adequate for
  the brief's interactive review pass (no Fast Refresh, no fixture injection, no
  element tree).
- **It is not iOS evidence.** iOS 26.3 simulators are installed on this machine
  (iPhone 17 Pro and others, all shut down) but no Mise iOS build exists in
  DerivedData, and building one was out of this task's write scope. **iOS
  baseline: not captured.**
- **It is not physical-device evidence.** Emulator only. Gesture feel, drag
  performance and real screen-reader behaviour remain unverified.
- **It is not screen-reader evidence.** TalkBack was not exercised.
- **It does not include first-run onboarding.** Reaching the starting-point
  screen requires wiping the install, which was out of scope here. The `Plan my
  meals` / calorie-first fork therefore has **no baseline capture**; the
  concept boards in `../onboarding/` and `../connected-illustrations/` remain
  the only references, and they are concepts, not device captures.

## Contents

| # | File | Surface | Notes |
| --- | --- | --- | --- |
| 00 | [pantry-mealprep-banner-pre-demo](00-pantry-mealprep-banner-pre-demo.png) | Pantry → Stock | The **Set up your meal prep plan** banner, captured *before* the demo reset. It is gated on `mealPrepStatus === 'deferred'` at `app/(tabs)/pantry.tsx:213`. |
| 01 | [today-top](01-today-top.png) | Today, first viewport | Calorie hero owns the first screen. |
| 02 | [today-mid](02-today-mid.png) | Today, scrolled to bottom | `What's for dinner?` card, Recent meals, See all meals. |
| 03 | [shop-tobuy-top](03-shop-tobuy-top.png) | Shop → To buy | Scan-a-receipt hero, Receipt history, Grocery haul header. |
| 04 | [shop-source-expanded](04-shop-source-expanded.png) | Shop row expanded | Mark purchased / Later / Remove / Edit. |
| 05 | [shop-tobuy-rows](05-shop-tobuy-rows.png) | Shop → To buy, scrolled | Category groups: Condiments, Pantry staples, Produce. |
| 06 | [shop-history](06-shop-history.png) | Shop → History | Purchased row with **Restore**. |
| 07 | [pantry-stock](07-pantry-stock.png) | Pantry → Stock | Location filter chips, illustrated rows, expiry language. |
| 08 | [pantry-recipes](08-pantry-recipes.png) | Pantry → Recipes | The saved-recipe list, four demo recipes. |
| 09 | [recipe-detail-top](09-recipe-detail-top.png) | Recipe detail | Kitchen coverage, Ingredients, Method, Cook & Log Meal. |
| 10 | [recipe-detail-lower](10-recipe-detail-lower.png) | Recipe detail, scrolled | Full method visible. |
| 11 | [cook-and-log-review](11-cook-and-log-review.png) | Review, entered from a recipe | **The nutrition defect, on device.** See below. |
| 12 | [dinner-loading](12-dinner-loading.png) | What's for dinner, loading | Skeleton plus "Finding ideas from your pantry…". |
| 13 | [dinner-settled](13-dinner-settled.png) | What's for dinner, settled | A suggestion with `~460 kcal · Estimated`, macro chips, `2/2 on hand`. |
| 14 | [add-sheet](14-add-sheet.png) | Shared Add action | Five illustrated rows plus Enter by hand. |
| 15 | [today-dark](15-today-dark.png) | Today, Midnight Organic | The existing dark palette. |
| 16 | [shop-dark](16-shop-dark.png) | Shop, Midnight Organic | |
| 17 | [today-dark-largetext](17-today-dark-largetext.png) | Today, dark, `font_scale 1.8` | Macro rows reflow; see the overlap note below. |
| 18 | [shop-stale-after-demo-load](18-shop-stale-after-demo-load.png) | Shop, immediately after a demo reset | Shows `0 items to pick up` / "Your list is clear" while five rows existed in the database. |

## What the baseline establishes

These are observations from the captures and from the code they exercise. They
are recorded because tasks later in this change depend on them being true.

### 1. Today's hierarchy is calorie-first, and dinner is below the fold

The first viewport is title, date, week strip, `REMAINING 470 kcal` in Fraunces,
daily target and consumed (01). The macro rows follow. Only after all of that
does `What's for dinner?` appear, as a tinted card, followed by Recent meals
(02). `design.md` describes the incumbent as having "a dinner CTA in Today",
which is accurate but understates the position: **the dinner entry point is not
reachable without scrolling at 411 dp**. Task 7.1's claim that the schedule
"replaces the dinner hero" is therefore a replacement of the *calorie* hero's
prominence more than of a dinner hero — the oversized figure is what occupies
the first viewport today, and the Mobile UI brief already says it moves below
the schedule.

### 2. Cooking a saved recipe produces item rows that claim zero macros

Capture 11 is the review screen reached by **Cook & Log Meal** from the
`Miso tofu rice bowl` demo recipe. It shows:

- header `TOTAL —` and `P — · C — · F —` — correctly **unknown**
- dish row `1 serving · P — · C — · F —` — correctly **unknown**
- ingredient rows `Firm tofu 400 g · P 0 · C 0 · F 0` with a calorie value of
  `0`, and the same for `Jasmine rice` and `Miso`

So the incumbent is honest at the total level and **states zero at the item
level**, which is a claim the data does not support. This matches
`mealFromRecipe` in `src/logic/recipe.ts:57`, which hardcodes
`kcalPerServing: 0` and an empty `missing` list before handing off to
`mealFromSuggestion`. Task 5.1's "remove zero-nutrition assumptions from this
path" is now confirmed on device rather than inferred from the source.

### 3. The dinner engine already applies the two constraints the planner must not inherit

Capture 13 shows, above the card, "**1 idea was dropped for not using what needs
using first.**" and on the card "**2/2 on hand**". These are the use-first
constraint and the pantry-coverage gate that design decision 2 says planner
selection must not reuse. They are live, visible, and phrased as product copy,
so the planner picker cannot reuse this surface's eligibility logic without
also inheriting its explanations.

### 4. Saved recipes carry no yield and no nutrition

Recipe detail (09, 10) shows source link, kitchen coverage, ingredients with
amounts, method and one primary action. There is **no portions/yield field and
no nutrition anywhere**, which matches the `Recipe` interface in `src/types.ts`.
The picker in task 6.1 is specified to show "portions" and "estimated
nutrition"; for saved recipes both must come from somewhere new, and the honest
default is *unknown*, not a guess.

`Miso tofu rice bowl` also demonstrates the ingredient/instruction disagreement
the design predicted: its method says "sear in pan with a touch of **oil**" and
"dress the bowl with **steamed greens**", and neither oil nor greens is in its
ingredient list. Its rice is stated as `1 cup`, a volume for a dry staple.

### 5. Shop's structure already carries most of what the grocery review needs

`Grocery haul` with a `To buy` / `History` segmented control, category group
headers, per-row provenance text (`Added manually`, `Running low in your
pantry`), an expandable row with `Mark purchased / Later / Remove / Edit`, and
`Restore` on purchased rows (03–06). Plan sources described in task 6.6 slot
into this shape; the disclosure line is the natural place for
"required for 3 meals".

### 6. Shop did not refresh after an in-app database reset

After **Load complete demo dataset**, Today refreshed but Shop still read
`0 items to pick up · Your list is clear` (18) even though the reset had just
written five shopping rows. A force-stop and relaunch showed all of them (03).
`app/(tabs)/index.tsx` explicitly calls `useDayStore.getState().refresh()` after
the reset; nothing equivalent runs for the shopping list. Small on its own, but
tasks 4.4 and 6.6 add plan-derived rows to this same screen and require a
`Plan changed — review groceries` state to appear reliably, so the refresh path
into Shop should be treated as load-bearing rather than assumed.

### 7. Large text reflows, but the shared Add button overlaps content

At `font_scale 1.8` (17) the macro rows reflow from a single line into
label-and-value above a full-width bar, which is the behaviour the brief wants.
The central Add FAB, however, is drawn over the `Carbs 205 / 225g` row.
Scrolling clears it, so nothing is unreachable, but the planner's state-specific
main action lands in the same bottom region and task 6.9's large-text check
should confirm the action is not the thing sitting under the FAB.

### 8. The dark palette is a named theme, not a system toggle

`Settings → Theme` offers six named palettes — Organic, Utility, Cool Organic,
Soft Studio, Misted Mint, **Midnight Organic** — and switching reloads the app
("Mise reloads once so every screen changes together"). Dark is therefore a
chosen palette rather than an OS-following mode. Planner surfaces must use
semantic tokens so all six work, and the brief's "light/dark" acceptance case
means at least Organic and Midnight Organic.

## Mobile UI brief → existing routes and components

The brief's surface table mapped onto what exists today. "New" means no such
surface exists at HEAD; the route and component columns then name the intended
host, not something already built.

| Brief surface | Exists today? | Route / entry | Components and logic in play |
| --- | --- | --- | --- |
| First visit | Yes, different content | `app/onboarding/welcome.tsx` → `app/index.tsx` gate | `src/components/onboarding/`, `StepShell`, `src/logic/onboardingStages.ts`, `onboardingGuards.ts`, `useOnboardingStore` |
| Today (agenda) | **New hierarchy** in an existing route | `app/(tabs)/index.tsx` | Today/Week switch and slot rows are new. Reuse `DateStrip`, `DayRail`, `MealRow`, `Card`, `Type`, `DailyTargetSummary`, `useDayStore` |
| Week | **New** | New view inside `app/(tabs)/index.tsx` (no fifth tab — `app/(tabs)/_layout.tsx` keeps four plus Add) | `DayRail` already exists for the day rail; day sections and slot rows are new |
| Recipe picker | **New** | New full screen; nearest sibling is `app/recipes.tsx` (a 28-line shell over the Pantry → Recipes list) | `src/components/recipes/`, `DishVisual`, `FoodVisual`, `Pill`, `src/logic/mealPrepTemplates.ts`, `mealPrepMatching.ts`, `dietaryService.ts` |
| Recipe preview | Partly — `app/recipe/[id].tsx` is the closest, but it previews a *saved* recipe with no yield, no nutrition and a Cook action rather than a schedule action | `app/recipe/[id].tsx` for saved recipes; new screen for template snapshots | Reuse its Kitchen coverage / Ingredients / Method sections and `coverageForRecipe` in `src/logic/recipe.ts` |
| Portion adjustment | **New** | New sheet | `Sheet`, `Stepper`, `MacroBars`, `Meter`, `src/logic/scaling.ts`, `macros.ts`, `nutrition.ts` |
| Grocery review in Shop | **New** state on an existing screen | `app/(tabs)/shop.tsx` | `src/logic/shoppingList.ts`, `shopService.ts`, `src/db/queries/shopping.ts`, existing category grouping and source disclosure |
| Active Shop | Yes | `app/(tabs)/shop.tsx` | As captured in 03–06; `app/receipt-capture.tsx` / `receipt-review.tsx` keep receipt entry |
| Scheduled meal (cooking guide) | Partly — `app/onboarding/first-plan.tsx` renders a guide, but only inside onboarding and only for an in-memory plan | New route reusing that presentation | `TechniqueIllustration`, `resolveTechnique()`, `CookingGuideStep`, `DishVisual` |
| Meal review | Yes | `app/review.tsx` (750 lines) and `app/meal/[id].tsx` | `src/components/review/`, `src/components/meals/`, `CollapsibleEditorRow`, `src/logic/mealEdit.ts`, `depletionService.ts`. **Inspect its save transaction before extending it**, per design decision 7 |
| Dinner fallback | Yes | `app/dinner.tsx` (503 lines) | `src/components/suggestions/`, `src/logic/suggest.ts`, `suggestionService.ts`, `dishScore.ts` |

### Visual authority the planner inherits unchanged

Confirmed present in the captures, so no new brand work is needed or permitted:

- Archivo for headings and body; Fraunces reserved for numeric emphasis (the
  `470` in 01, the meal calories in 02, the `~460 kcal` in 13)
- Warm ground, strong ink, terracotta action tint, sage secondary — all from
  `src/constants/theme.ts` and `src/constants/themePalettes.ts`
- Open ruled rows for the macro list, rounded cards for grouped content
- Restrained illustrated food (`FoodVisual` in 07, `DishVisual`, the technique
  and appliance sets in 14)
- Four tabs plus one central Add, and **no second floating action button**

The planner adds no font, no palette, and no image dependency. Where the brief
names a new control, it is composed from `Button`, `Card`, `Pill`, `Sheet`,
`Stepper`, `Type` and the existing tokens.

## Acceptance status for task 1.4

| Requirement | Status |
| --- | --- |
| Incumbent Today / Shop / recipe baseline captured natively | **Done** (Android emulator, build identity verified in-app) |
| Synthetic fixtures used | **Done** (the app's own demo dataset) |
| Persistent development-client session | **Not met.** No `expo-dev-client` in the project; a release APK from HEAD was used instead. The brief's persistent dev-client session remains required at implementation time and is a separate gate. |
| Brief's screens mapped to existing routes/components | **Done** (table above) |
| Global visual identity unchanged | **Done** — this task wrote documentation and screenshots only; no `src/`, `app/`, theme or asset file was modified |
| iOS baseline | **Not captured** |
| Physical-device and screen-reader evidence | **Not captured** |
