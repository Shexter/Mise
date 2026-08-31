# Proposal: Visual Food Identity System

## Why

Mise connects pantry stock, meal logging, and recipe planning. Currently, non-photographed ingredients rely on plain text or generic placeholder icons, which leaves list views feeling utilitarian and cold.

Rather than calling expensive, slow, and unpredictable cloud generative AI at runtime, Mise uses a **build-time Draw Things CLI creator pipeline on local Apple Silicon hardware** to generate curated, consistent, and hand-reviewed food illustrations. These are bundled as static, lightweight on-device assets that render with zero latency, zero API costs, and 100% offline reliability.

This proposal establishes the 4-tier visual hierarchy, the shared `<FoodVisual />` component, and the asset resolution pipeline across Pantry, Recipes, and Meal logging surfaces.

## What Changes

- **4-Tier Food Visual Hierarchy**:
  1. **User Retained Photo**: If the user photographed the physical item, their real photo always takes top priority.
  2. **Product Package Photo**: If scanned via barcode, the verified package photo is rendered.
  3. **Curated Canonical Illustration**: If non-photographed, a reviewed static illustration from the Draw Things asset pack (e.g. `assets/food/broccoli.webp`) is rendered.
  4. **Category Fallback Badge**: For rare or custom items without exact artwork, an intentional vector category badge (e.g. *Produce*, *Proteins*, *Dairy*, *Condiments*, *Grains*) is rendered so no broken states ever appear.
- **Dish Visuals**: A dish is not an ingredient and cannot borrow one's picture. Dishes render as a plate seen from above, its well divided by the dish's own food-class mix in the same colours those classes carry as ingredient badges. Ingredients are rounded thumbnails; dishes are circles.
- **Zero-Runtime-Cost Architecture**: Shipped as pre-optimized static assets with an asset manifest (`assets/food/manifest.json`). No runtime LLM image calls, no battery drain, and no cloud dependency.
- **Shared `<FoodVisual />` UI Component**: Accessible image component with proper image sizing, fallback handling, screen-reader announcements, and dark/light theme awareness.
- **Pantry & Recipe Integration**: Integrated into Pantry list rows, Recipe suggestion cards, and Starter Pantry selection.

## Current state at implementation

The hierarchy, resolver, component, and every surface integration are built and
tested. **Tier 3 ships empty**: no Draw Things pipeline was ever run, so there is
no reviewed art to bundle, and the `Art direction follows the implemented app`
requirement gates that generation on owner acceptance of the implemented UI
through native visual review. Until then every non-photographed food resolves to
its reviewed category badge — an intentional, complete state rather than a
missing one. `assets/food/README.md` records what a shipped asset must satisfy.

## Capabilities

### New Capabilities
- `visual-food-identity-system`: Local-first, offline visual food asset resolution, `<FoodVisual />` component, and Draw Things asset manifest.

## Non-goals

- Calling runtime cloud AI image generation APIs (DALL-E / Imagen) on the mobile device.
- Inventing visual art as factual evidence for physical package conditions or expiry.
- Blocking app startup or requiring internet connectivity to render food visuals.

## Impact

- New assets in `assets/food/`.
- New manifest and resolver in `src/media/foodVisuals.ts`.
- New UI component in `src/components/FoodVisual.tsx`.
- Integrated across `app/(tabs)/pantry.tsx`, `app/recipe/`, and onboarding components.
