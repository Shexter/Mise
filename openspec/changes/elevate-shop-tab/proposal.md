## Why

The current 3-tab layout (`Today`, `Pantry`, `Settings`) overburdens the `Pantry` tab by cramming 4 completely distinct operational workflows into a single nested segmented control:
1. Current kitchen stock & locations
2. Saved recipe book
3. Grocery haul shopping checklist
4. Receipt scans & financial audit history

This causes modal blindness, dynamic header button flickering, and poor discoverability. Elevating `Shop` (Grocery Haul & Receipts) to a dedicated 4th bottom tab creates a clean mental model (`Today · Pantry · Shop · Settings`), simplifies the Pantry tab into a pure kitchen inventory & recipe view, and anchors grocery shopping and receipt auditing where users naturally expect them.

## What Changes

- Add a dedicated **`Shop`** bottom navigation tab (`app/(tabs)/shop.tsx`) using a shopping cart icon (`shopping-bag` / `shopping-cart`).
- Move the Grocery Haul checklist (`ShoppingListSection.tsx`), nearby store checks (`/shops`), and Receipt Scan / History links into the new `Shop` tab.
- Streamline the `Pantry` tab (`app/(tabs)/pantry.tsx`) to focus on **Kitchen Stock** with a clean secondary segment/toggle for **Saved Recipes** (`Stock · Recipes`), removing the 4-way subsegment labyrinth.
- Update tab bar navigation configuration in `app/(tabs)/_layout.tsx` to 4 tabs: `Today`, `Pantry`, `Shop`, `Settings`.

## Capabilities

### New Capabilities
- `dedicated-shop-tab`: Elevates grocery haul, store detection, and receipt auditing to a primary top-level tab.

### Modified Capabilities
- `shopping-list`: Re-anchors the shopping list to its dedicated tab destination rather than a nested subsegment of Pantry.

## Non-goals

- Altering shopping item schema or grocery list generation algorithms.
- Changing receipt OCR models or sqlite database tables.

## Impact

- `app/(tabs)/_layout.tsx`: Adds `shop` screen to `Tabs`.
- `app/(tabs)/shop.tsx`: New top-level screen for shopping list & receipt tools.
- `app/(tabs)/pantry.tsx`: Streamlined to 2 segments (`Stock` and `Recipes`).
- Tests: Updates tab navigation and screen hierarchy assertions in `test/pantry-subsections.test.ts` and `test/shopping-list-ui.test.ts`.
