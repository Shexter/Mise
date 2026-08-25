## Context

Users currently experience multi-step friction when logging meals, navigating the 4-way segmented Pantry screen, and getting started without an AI API key. This design consolidates the meal review into inline one-tap chips (respecting venue and depletion invariants), streamlines Pantry header actions, and provides safe demo data onboarding.

See `proposal.md` for motivation and specs under `specs/` for detailed requirements.

## Goals / Non-Goals

**Goals:**
- Consolidate meal intake modifiers (Meal Type, Venue, Servings Multiplier) into a clean, horizontal segment bar right on the main review card.
- Strictly uphold Decision 11: non-home venues (Eating Out / Restaurant) disable batch multipliers and prevent pantry depletion.
- Safeguard demo data seeding: allow instant loading for empty databases while requiring confirmation if user data is present.
- Keep the Pantry screen's primary view fast and kitchen-focused with clean secondary navigation for Recipes, Haul, and Receipts.

**Non-Goals:**
- Redesigning the core calorie calculation or database schemas.
- Adding mandatory network accounts.

## Decisions

### Decision 1: Inline review modifier chips with strict venue semantics
* **Approach**: Move meal type, venue, and servings multiplier out of separate bottom sheets directly into inline horizontal segment chips on `app/review.tsx` and `app/manual.tsx`.
* **State Invariants**:
  - Venue `home`: Servings multiplier defaults to $1\times$ with $2\times, 4\times$ options. Pantry depletions apply.
  - Venue `restaurant` / `out`: Servings multiplier locked to $1\times$. Pantry depletions disabled.
* **Rationale**: Users see and toggle all options at a glance and hit "Log Meal" in one tap without invalid state combinations.

### Decision 2: Contextual header actions & Pantry navigation
* **Approach**: Standardize header icons (Locations, Search, Camera, Add) and ensure clean back navigation without changing underlying route structures.

### Decision 3: Cold-start discovery card & data safety
* **Approach**: When no key is set (`maskedKey === null`), show a friendly demo card on Today allowing a safe seed of realistic test data (guarded if existing entries are detected).

## Risks / Trade-offs

- [Risk] Screen space on smaller mobile screens during meal review.
  → **Mitigation**: Use compact wrapping chips and scrollable review containers with verified touch targets and large-text support.

## Modules Touched

- `app/review.tsx`
- `app/manual.tsx`
- `app/(tabs)/index.tsx`
- `app/(tabs)/pantry.tsx`
- `src/components/pantry/`
