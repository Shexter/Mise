## Context

The `Pantry` tab previously hosted 4 distinct domains: `Stock`, `Recipes`, `Shop`, and `Receipts`. This design decouples shopping and receipts into a dedicated `Shop` tab in `app/(tabs)/_layout.tsx`, turning the app into a clear 4-tab product: `Today`, `Pantry`, `Shop`, `Settings`.

## Goals / Non-Goals

**Goals:**
- Create `app/(tabs)/shop.tsx` as the dedicated home for the grocery haul checklist (`ShoppingListSection.tsx`), nearby store checks (`/shops`), and receipt imports (`/receipt-history`).
- Simplify `app/(tabs)/pantry.tsx` to 2 clear segments: `Stock` (Kitchen Inventory by storage location) and `Recipes` (Saved Recipe collection).
- Add the `Shop` tab to `app/(tabs)/_layout.tsx` with a shopping icon (`shopping-bag`).

**Non-Goals:**
- Changing database queries, shopping list data formats, or receipt extraction models.

## Decisions

### Decision 1: Tab bar configuration
* **Approach**:
  1. `Today` (`Feather: sun`)
  2. `Pantry` (`Feather: archive` or `package`)
  3. `Shop` (`Feather: shopping-bag`)
  4. `Settings` (`Feather: settings`)
* **Rationale**: Standard 4-tab bottom navigation with balanced spacing and clear icon visual weight.

### Decision 2: Structure of the `Shop` tab
* **Approach**:
  - Main view: `ShoppingListSection.tsx` (To-buy & History).
  - Header actions:
    - `camera` $\rightarrow$ Scan printed receipt (`/receipt-capture` or receipt intake).
    - `map-pin` $\rightarrow$ Check nearby stores (`/shops`).
    - `clock` or `file-text` $\rightarrow$ Receipt history (`/receipt-history`).

### Decision 3: Structure of the `Pantry` tab
* **Approach**:
  - Segments: `Stock` vs. `Recipes`.
  - Header actions:
    - For `Stock`: Locations (`/locations`), Nutrient Search (`/nutrient-search`), Camera (`/pantry-capture`), Add Item (`+`).
    - For `Recipes`: Save Recipe (`/recipe-intake`).

## Risks / Trade-offs

- [Risk] Existing tests expecting 4 subsections in Pantry.
  → **Mitigation**: Update `test/pantry-subsections.test.ts` to reflect the 2-segment Pantry and new Shop tab.

## Modules Touched

- `app/(tabs)/_layout.tsx`
- `app/(tabs)/shop.tsx`
- `app/(tabs)/pantry.tsx`
- `test/pantry-subsections.test.ts`
- `test/shopping-list-ui.test.ts`
