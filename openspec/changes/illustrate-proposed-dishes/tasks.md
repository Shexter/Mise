## 1. Art

- [x] 1.1 Add a `dish` set to the briefs, one subject per `STARTER_MEAL_PREP_TEMPLATES` id, with its suffix aliased to the existing ingredient wording and a note forbidding subjects for dishes with no template id.
- [x] 1.2 Add `dish` to `SET_TARGETS`, and add both `action` and `dish` to the manifest schema's set enum — `action` was promoted last change without being added.
- [x] 1.3 Generate the seven to staging and review the contact sheet before promoting.

## 2. Registry

- [x] 2.1 Create `src/media/dishIllustrations.ts` with a template-id-keyed registry and `dishIllustrationFor()` returning `null` for anything unknown.
- [x] 2.2 Extend `test/illustration-registries.test.ts`: manifest parity for the dish set, every dish id is a real template id, and `dishIllustrationFor()` returns `null` for absent, unknown, and empty ids.

## 3. Surface

- [x] 3.1 Render the template's artwork in the first-plan header, falling back to `DishVisual` when there is none.
- [x] 3.2 Leave `DishVisual` untouched on dinner suggestions and saved recipes.

## 4. Documentation

- [x] 4.1 Update `docs/asset-pipeline.md` so "dishes are unbounded" and its one authored exception are stated together, not in two places.
- [x] 4.2 Add the dish set to `assets/illustrations/README.md`.

## 5. Promotion and verification

- [x] 5.1 Promote with a named reviewer, then flip `consumerWired` to `true`.
- [x] 5.2 `openspec validate illustrate-proposed-dishes --strict`, `npm run typecheck`, `npm test`, `npm run art:list`, `git diff --check`.
- [x] 5.3 Native review of the first-plan header, and of one surface that still uses `DishVisual`.
