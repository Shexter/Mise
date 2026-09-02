## 1. Asset Manifest and Category Fallbacks

- [x] 1.1 Define category fallback vector icons and styling tokens in `src/media/foodVisuals.ts` for every `FoodClass` the app models, plus `other`.
- [x] 1.2 Establish the `assets/food/manifest.json` schema (`manifest.schema.json`) mapping canonical ingredient IDs to curated asset files with verified provenance.
- [x] 1.3 Add the initial core set of curated illustrations for common staples and Asian pantry essentials into `assets/food/`.
  - Delivered by `connect-generated-illustrations` once the owner cleared the `Art direction follows the implemented app` gate through native visual review. 116 reviewed illustrations were promoted with full provenance; tier 4 remains the fallback for an ingredient without exact art and for an image that fails to load. Placeholder swatches from the first implementation pass remain in `docs/brand-explorations/food-visual-placeholders/`, deliberately outside the production pack.

## 2. Core Resolver and UI Component

- [x] 2.1 Implement the 4-tier `resolveFoodVisual` resolver function in `src/media/foodVisuals.ts` with unit tests for every precedence step.
- [x] 2.2 Build the `<FoodVisual />` component in `src/components/FoodVisual.tsx` supporting standard sizes (`sm`, `md`, `lg`, `hero`), theme backgrounds, and accessibility attributes.
- [x] 2.3 Add unit tests verifying accessibility behaviour, fallback rendering, and image-failure handling.

## 3. Surface Integration

- [x] 3.1 Integrate `<FoodVisual />` into Pantry list rows and grouped items in `app/(tabs)/pantry.tsx`.
- [x] 3.2 Integrate `<FoodVisual />` into Starter Pantry onboarding cards in `app/onboarding/starter-pantry.tsx`.
- [x] 3.3 Integrate `<FoodVisual />` into Recipe suggestion cards, recipe detail, meal detail, and the first-plan onboarding screen.

## 4. Dish Visuals

- [x] 4.1 Build the dish composition and plate geometry model in `src/media/dishVisuals.ts` with unit tests.
- [x] 4.2 Build the `<DishVisual />` component in `src/components/DishVisual.tsx` over `react-native-svg`.
- [x] 4.3 Render dishes as plates on the dinner suggestion cards, the first-plan onboarding header, and saved recipes.

## 5. Verification and Polish

- [x] 5.1 Verify offline rendering, dark/light theme switching, and screen-reader accessibility on the Pixel 10a emulator.
  - The native review that unblocked 1.3. Continued in `connect-generated-illustrations` task 6.2, which re-inspects the same surfaces with the promoted pack in place.
- [x] 5.2 Run test suite (`npm test`), type check, and strict OpenSpec validation.
