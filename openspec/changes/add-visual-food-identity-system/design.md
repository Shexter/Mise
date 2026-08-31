## Context

Mise has a rich canonical ingredient catalogue and supports user-captured photos for pantry stock and meals. However, non-photographed items currently lack a cohesive visual language.

See `proposal.md` for motivation.

## Goals / Non-Goals

**Goals:**
- Provide instant, zero-latency visual rendering for all food items across Pantry and Recipes.
- Enforce strict 4-tier visual precedence (User Photo $\rightarrow$ Product Image $\rightarrow$ Curated Illustration $\rightarrow$ Category Badge).
- Maintain 100% offline functionality without runtime cloud image API calls.
- Structure Draw Things CLI output into a clean, auditable static asset pack (`assets/food/`).

**Non-Goals:**
- Running on-device neural diffusion models or runtime cloud generative APIs inside the mobile app.
- Treating generic illustrations as proof of physical expiration or exact portion weight.

## Decisions

### 1. Build-Time Studio Generation (Draw Things CLI) vs Runtime Rendering
- **Decision**: All canonical food illustrations are generated at build-time using Draw Things CLI on Apple Silicon, human-reviewed for style consistency, optimized (WebP/PNG), and bundled in `assets/food/`.
- **Status**: Not yet exercised. No pipeline has run and the pack is empty; `assets/food/manifest.schema.json` defines the provenance record each future asset must carry, and `test/food-visuals.test.ts` verifies every declared checksum against the bytes on disk. Provenance is a factual record of what produced a file, so an unshipped ingredient is a supported state and an invented entry is not.
- **Rationale**: Keeps the mobile app instant (0ms render time), offline-first, battery-friendly, and free from AI hallucinations.

### 2. Four-Tier Resolver Pipeline (`src/media/foodVisuals.ts`)
- **Decision**: The resolver evaluates in strict order:
  ```typescript
  export function resolveFoodVisual(item: {
    photoUri?: string | null;
    productImageUrl?: string | null;
    canonicalId?: string | null;
    category?: FoodCategory | null;
  }): ResolvedFoodVisual
  ```
- **Fallback Guarantee**: An unrecognized or custom item always safely resolves to its category vector badge so the UI never displays missing image states.

### 3. Accessible UI Component (`src/components/FoodVisual.tsx`)
- **Decision**: Standardize all food imagery into a shared component handling border radius, sizing presets (`sm`, `md`, `lg`, `hero`, or a raw number), image-failure fallback, and accessible labeling.
- **Redundant announcements**: A food visual always sits beside the food's name — adjacent text, or an already-labelled pressable parent. So the component is **decorative by default**, hidden from assistive tech unless a caller passes an explicit `alt` that says something the surrounding text does not. No current surface passes one.
- **Failure identity**: The component tracks *which* image identities failed, not merely that one did, so a replaced photo is attempted rather than inheriting the previous URI's failure, and two broken tiers settle on the badge instead of handing the image back and forth.

### 4. Dish Visuals (`src/media/dishVisuals.ts`, `src/components/DishVisual.tsx`)
- **Decision**: A dish gets its own mark rather than the first ingredient's art: a plate seen from above, its well divided into wedges by the food classes its ingredients belong to, drawn with `react-native-svg` from a pure geometry model (the `NutritionChart` pattern).
- **Rationale**: Borrowing an ingredient's picture states something false — a stir-fry is not a chicken breast. Composition is derived from data already on the device, so the mark is distinctive per dish without asserting anything.
- **Counting, not weighing**: Shares come from ingredient counts, because quantities arrive in mixed units (g, ml, count) and weighting across them is meaningless. This also bounds every wedge at 1/n, so no share degenerates into an invisible sliver.
- **Honest empty state**: An ingredient that resolves to no food class contributes no wedge, and a dish with nothing resolved renders an empty plate.
- **Plating angle**: Derived from a stable hash of the dish name, so the same dish always plates identically and two dishes of equal composition still read apart. It carries no meaning.

## Implementation Seams

- `assets/food/`: Curated asset pack and `manifest.json`.
- `src/media/foodVisuals.ts`: Resolution logic and precedence engine.
- `src/components/FoodVisual.tsx`: Reusable React Native component.
- `app/(tabs)/pantry.tsx`: Pantry item row integration.
- `src/components/pantry/`: Pantry sub-components.

## Risks / Trade-offs

- [Risk] Large asset sizes could inflate app bundle size.
  $\rightarrow$ **Mitigation**: Optimize all static assets using WebP format (typically <15KB per item) and limit the core bundled pack to top staples, with future optional downloadable packs.
- [Risk] Mismatched cultural ingredient representations.
  $\rightarrow$ **Mitigation**: Specific human review for Asian pantry essentials (miso, mirin, doubanjiang, bok choy, tofu varieties) ensuring authenticity.
