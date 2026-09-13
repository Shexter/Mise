## Why

Mise's occasional “What's for dinner?” decision does not provide the repeatable routine requested in the supplied screenshot: choose meals, schedule the week, fit portions to personal goals, and shop for that plan. Make proactive meal planning the lead experience while retaining dinner suggestions as an easy fallback for spontaneous cooking.

## What Changes

- Plan for a grocery haul: users choose the meals they want to eat, then Mise produces the ingredients to buy. Existing pantry stock never gates recipe selection or scheduling; checking what is already owned is an optional list-reduction step. “What's for dinner?” retains its pantry-led purpose.
- Reorganize Today around a persistent meal schedule with Today and Week views. Retain the four destinations Today, Pantry, Shop, and Settings, plus the shared Add action; avoid another competing dashboard or tab. Reconciled by the follow-up change `separate-today-views-and-illustrate-cuisine-chooser`: those two views become a compact Day/Week control inside Today's `Meal plan` subpage, beside a `Calories` subpage. Only this change's home-ordering and picker-appearance language is superseded; its scheduling, grocery, batch, onboarding and acceptance requirements remain this change's own work and are not re-checked from the follow-up.
- Specify the mobile UI end to end: screen layouts and wireframes, recipe/date/portion sheets, grocery-haul states, cooking handoff, native navigation, large-text/dark-theme behavior and computer-use acceptance evidence. The Mobile UI brief in design.md extends the existing visual identity.
- Offer a local recipe/template picker for breakfast, lunch, and dinner, with cuisine filters, saved recipes, repeat meals, and reusable week templates. Seven choices per meal is illustrative, not a quota.
- Assign meals to dated slots, move by drag or accessible tap actions, copy, replace, skip, and reopen the schedule after restart. Support partial weeks and explicitly shared batch portions.
- Preview portion adjustments against the person's existing calorie and macro targets. Update ingredients, estimated nutrition, and grocery requirements from the same accepted recipe snapshot; disclose unknown nutrition and unmet goals.
- Produce a consolidated, reviewable grocery list in Shop from scheduled cooking quantities. Keep ingredient provenance and distinguish recipe requirements from uncertain pantry coverage.
- Make first-run meal planning possible without a stocked pantry, body metrics, or API key. Persist the first scheduled meal and land the user in its week.
- Preserve “What's for dinner?” at one tap from Today and empty dinner slots, its existing route, and ordinary cook/log behavior. A chosen suggestion can also fill a slot after explicit confirmation.

## Capabilities

### New Capabilities

- `weekly-meal-planning`: Persistent dated slots, templates, batch allocations, editing, and planned-versus-eaten lifecycle.
- `meal-plan-recipes`: Local meal-type and cuisine selection with versioned, quantity-aware recipe snapshots.
- `meal-plan-nutrition`: Goal comparison and bounded, reviewable portion adjustment with truthful completeness.
- `planner-first-home`: Schedule-led Today/Week navigation and dinner fallback.

### Modified Capabilities

- `shopping-list`: Scheduled demand, quantity aggregation, coverage review, and conservative reconciliation in the existing list; update Today hierarchy.
- `onboarding-ux`: Planning-first kitchen path and durable handoff while preserving calorie-first and skip paths.

## Impact

- Affects `app/(tabs)/index.tsx`, `app/(tabs)/shop.tsx`, onboarding, recipe detail, `app/dinner.tsx`, shared meal review, `src/logic/mealPrep*`, recipe/nutrition/shopping logic, stores, types, and database queries/export/reset.
- Adds forward-only SQLite migrations for plans, slot and recipe snapshots, batch allocations, and per-source shopping quantities. Reuse the current query-module boundary exported through `src/db/queries.ts`; no server or provider dependency for core planning.
- Implements decisions **4, 5, 9–11, 15, 24–25, 38, 43, 51–52, 60–61, 63, 65, 79–80, 128, 141, 155**. Proposes superseding **42**'s meal-planning/library deferral and **58**'s calorie-first hierarchy. Narrows **33/156** to the dinner fallback, while introducing a curated planning picker. Decisions **36, 123–130** remain dinner-engine rules; the planner uses separate models and explicit portion choices, not new suggestion-weight presets.
- `guide-into-first-prep-plan` is currently 0/17 tasks. This proposal takes ownership of its plan persistence and handoff, replacing its single-plan storage and Pantry-banner direction. Its camera-led intake and illustration polish remain separable; it must not be applied unchanged alongside this change. Reconcile that proposal at implementation start.
- This is planning only. Assumptions in design.md are author-selected planning defaults as requested, not claims of user research or accepted product-ledger entries. Ledger and PRODUCT updates are implementation tasks.

## Non-goals

- Removing dinner suggestions, calorie logging, pantry management, receipt workflows, or calorie-first setup.
- Automatically logging scheduled food, consuming pantry stock on scheduling, or interpreting bought groceries as eaten food.
- Exact macro optimization, medical advice, new target formulas, automatic ingredient substitutions, or guaranteed nutrition outcomes.
- Grocery ordering, price promises, accounts/sync, external calendars, automatic notifications, a social recipe feed, or new recipe-provider integrations.
- A mandatory 21-recipe launch catalogue, generated recipe/nutrition facts, or requiring completion of every meal slot.
