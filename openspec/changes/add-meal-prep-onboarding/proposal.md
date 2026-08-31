# Add meal-prep onboarding

## Why

Mise onboarding currently starts by collecting data for calorie targets. That is
useful for calorie tracking, but it does not give a meal-prep-focused person an
early, practical result. They need a fast path from the tools and ingredients
they already own to one credible first cooking plan.

The current flow also cannot represent a person who wants meal prep without a
body-data profile. Asking for that data only to unlock pantry planning would
create false intent and conflict with the product's local-first, trust-first
direction.

## What changes

- Add a first-run intent screen with two independently selectable visual cards:
  **Track my calories** and **Meal prep**. A person can choose either or both.
- Preserve the existing calorie profile path when calorie tracking is selected.
  Meal-prep-only onboarding must not require body measurements or a calorie
  target.
- Add an optional meal-prep branch for appliance selection. It records owned
  cooking tools locally and always supports a no-appliance/no-cook outcome.
- Add a guided first-pantry step with common starter ingredients plus existing
  manual and capture entry routes. Nothing becomes pantry inventory until the
  person confirms it.
- Produce an initial meal-prep recommendation only from confirmed ingredients,
  declared appliances, and any stated dietary rules. The result includes a
  recipe summary and appliance-specific cooking guide.
- Keep the prep branch skippable and resumable from the app after onboarding.
- Store cooking setup separately from the existing required nutrition profile,
  using a new forward-only local migration.

The intended visual flow is represented by `docs/ui-overhaul/01` through `04`.
Those images guide hierarchy and interaction; they do not override product
decisions, data contracts, or accessibility requirements.

## Dependencies

- Existing onboarding and profile persistence.
- Existing canonical-item matching and pantry inventory contracts (Decisions
  25-31).
- Existing capture and review routes for photo, barcode, and manual pantry
  intake.
- Existing dinner-decision and recipe-to-review work (Decisions 33-40).

## Non-goals

- Adding voice pantry intake. That remains `add-voice-pantry-intake`.
- Generating food illustrations or adding generated food-image assets. That
  remains `add-visual-food-identity-system` and is deferred until the native UI
  is accepted.
- Requiring an API key, cloud provider, or calorie profile to finish meal-prep
  onboarding.
- Automatically adding inferred ingredients, quantities, or appliance ownership
  without review.
- Building a recipe marketplace, a complete meal planner, or nutritional
  tracking from the first prep plan.

## Impact

- New capability: `meal-prep-onboarding`.
- Onboarding routing and completion rules must support calorie-only,
  meal-prep-only, and combined paths.
- A new local cooking-preferences persistence model and migration are required.
- Recipe recommendation contracts need explicit appliance requirements and
  structured cooking-guide steps.
- Pantry, recipe, and settings surfaces need resumable access to cooking setup.

## Decision alignment

This proposal follows Decisions 5 and 15 (local-first and no false precision),
Decisions 23-24 (progressive first-run setup), Decisions 25-31 (canonical
identity and pantry contracts), and Decisions 33-40 (dinner decisions and
recipe follow-through).
