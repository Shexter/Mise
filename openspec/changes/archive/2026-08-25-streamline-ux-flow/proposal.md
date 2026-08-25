## Why

Mise's core userflows currently suffer from cognitive overload, multi-step friction, and disjointed information architecture:
1. **Meal Logging Friction:** Logging a meal requires navigating through multiple disjointed inputs (venue selection, meal type, serving batch multipliers, hidden ingredient checkboxes) before saving.
2. **Pantry Over-segmentation:** The Pantry screen forces users to navigate across 4 nested subsections (`Stock`, `Recipes`, `Shop`, `Receipts`) with changing top-bar action buttons and nested segmented controls.
3. **Cold-Start Onboarding Wall:** Users without an API key face broken-feeling skeleton states and silent fallbacks rather than a smooth onboarding preview with instant test data or manual-first flows.

This change streamlines the userflow to make food logging fast (1-2 taps), simplifies Pantry navigation, and provides seamless cold-start guidance.

## What Changes

- **Streamlined Meal Review Flow:** Consolidate meal type, venue (Home vs. Out), and batch multiplier into a unified, responsive horizontal chip bar on the meal review screen so users can log a meal in under 3 seconds.
- **Unified & Decluttered Pantry Navigation:** Simplify the Pantry interface by keeping the primary view focused on Kitchen Stock while making Recipes, Grocery Haul, and Receipt History clean, contextual secondary destinations.
- **Improved Cold-Start / No-Key Guidance:** Provide an immediate "Try with Demo Kitchen Data" banner and graceful manual input fallback when no Gemini/Claude API key is configured, ensuring zero blank or frozen screen states.
- **Quick-Access Actions:** Standardize top-bar actions and entry points across screens to eliminate modal blindness.

## Capabilities

### New Capabilities
- `streamlined-meal-intake`: A consolidated, low-friction review and intake flow for photo and manual meal logging.
- `cold-start-guidance`: First-run and no-key discovery mechanism with instant demo data loading and clear manual entry paths.

### Modified Capabilities
- `shopping-list`: Reconcile grocery haul entry points so the list is easily accessible without being buried in a 4-way sub-segment.

## Non-goals

- No removal of core local-first and SQLite storage guarantees.
- No introduction of server-side accounts or user logins.
- No changes to nutritional calculation formulas or depletion algorithms.

## Impact

- `app/(tabs)/pantry.tsx` & `src/components/pantry/`: Simplified navigation structure and header action consistency.
- `app/review.tsx` & `src/components/review/`: Reorganized into one consolidated review sheet with quick chip selectors.
- `app/onboarding/` & `app/(tabs)/settings.tsx`: Enhanced onboarding guidance and keyless demo data activation.
- `test/`: Updated UI contract and interaction tests.
