# Cuisine chooser asset pilot

Generated on 8 September 2026 through Mise's existing Draw Things pipeline. These are staging candidates, not shipped or owner-approved assets.

The selected composition is [the chooser concept](./ui%20for%20choosing%20meal%20and%20cuisine%20plan.png). Its flat filter pictures become Mise's existing hand-painted illustrations. Labels, All, selection borders, arrows, and navigation remain native or vector.

## Candidates

| Cuisine | Subject | Seed | Files |
| --- | --- | --- | --- |
| Chinese | Sage-green noodle bowl with red chopsticks | 908224016 | `.art-staging/cuisine/chinese.{raw.png,webp,json}` |
| Japanese | Salmon nigiri beside a nori roll | 3806635343 | `.art-staging/cuisine/japanese.{raw.png,webp,json}` |
| Italian | Cream bowl of spaghetti with tomato sauce and basil | 305655836 | `.art-staging/cuisine/italian.{raw.png,webp,json}` |
| Mediterranean | White bowl of olives, feta and lemon with oregano | 1457116002 | `.art-staging/cuisine/mediterranean.{raw.png,webp,json}` |
| International | Cream bowl of grains, greens and roasted vegetables | 3703636 | `.art-staging/cuisine/international.{raw.png,webp,json}` |

The set is now the five cuisines the reviewed `PLANNER_CATALOGUE` records, which is the release vocabulary the owner approved on 8 September 2026. Korean, Thai and Vietnamese appear in the concept and are deliberately absent: no reviewed recipe carries those labels, and a picture may not create coverage the collection does not have.

[Contact sheet](../../../.art-staging/cuisine-contact-sheet.png): alphabetical, left to right — Chinese, International, Italian, Japanese, Mediterranean. Staging is gitignored, so these links refer to this workstation's generated files.

Exact subject phrases live in `assets/illustration-briefs.json`, under `sets.cuisine.subjects`. The generated JSON sidecars record the exact assembled prompts and output checksums.

## Recipe and reproduction

- Draw Things CLI: `1.20260430.0`.
- Model: `flux_2_klein_4b_q8p.ckpt`.
- Model SHA-256: `430ba0f94ee0851a7f95c1383527f931afa6219898a51c5aa8e37979e9e4c86a`.
- Workflow: `2.0.0`; cuisine suffix is byte-identical to the existing dish suffix.
- Render: 1024 × 1024, four steps, CFG 1, existing sampler config, offline generation.
- Review copy: 512 × 512 WebP, quality 90. Paper and shadow remain intact.
- Gold-master reproduction passed: `9b7ad077379ee607378932fda394a9a9b85d3d4dbaa0dc7ffc889434c8043e7a`.

Commands run:

```sh
npm run art:make -- --verify-gold
npm run art:make -- --set cuisine --only chinese,japanese --ignore-blocked
```

The owner requested starting asset generation alongside planning. `--ignore-blocked` was used only for the first two-cuisine pilot, while the rail did not exist.

The rail now exists (`src/components/planner/CuisineRail.tsx`, consumed by `app/plan/picker.tsx`), so the set is `consumerWired: true` and the remaining three cuisines were generated through the ordinary queue:

```sh
npm run art:make -- --verify-gold
npm run art:make -- --set cuisine
```

Declaring the consumer removes the *blocked-on-UI* gate. It does not remove the gate that matters: nothing is promoted, the manifest records no cuisine asset, `assets/illustrations/cuisine/` does not exist, and `CUISINE_ILLUSTRATIONS` is empty. The rail renders a labelled fallback tile for every cuisine, so the chooser is complete and truthful with zero accepted artwork — promotion stays a separate, named human decision.

## Inspection

All five candidates visibly preserve ivory paper, fine ink, muted food colour, three-quarter composition, and grounding shadows. Neither contains readable text or a generated selection ring. These illustrate cuisine filters, not specific recipes.

The contact-sheet command emitted existing ImageMagick Freetype/empty-label warnings. It exited successfully; the sheet was opened and both images were visible. No visual acceptance of the future native controls is claimed.

Before shipping, implement the cuisine consumer, schema, typed registry, and parity tests. Review at the actual native control size in light and dark themes. Obtain a real human reviewer before promotion.

## Verification

- `npm run typecheck`: passed.
- `npm test -- cuisine-asset-staging illustration-registries food-visuals`: 3 files, 86 tests passed.
- Strict OpenSpec validation for `separate-today-views-and-illustrate-cuisine-chooser`: passed.
- `git diff --check`: passed.
- `art:list`: 152 shipped, ten planner dish slots unshipped, two cuisine slots blocked on UI, no inconsistent slots.
- Unwired cuisine promotion was tested to reject before modifying the manifest or copying an asset.

The full app test suite and new native UI checks were not run in this planning/pilot pass. Claude's earlier 1,853-test report remains historical evidence.

Claude's ten planner dish candidates already exist in `.art-staging/dish/`. They need stable-ID consumer wiring and an expanded authored-ID guard, not blanket regeneration. See the [OpenSpec design](../../../openspec/changes/separate-today-views-and-illustrate-cuisine-chooser/design.md).


## Planner dish candidates reviewed against their recipes (task 6.6)

Reviewed 8 September 2026 by reading each candidate beside its recipe's ingredient list in `src/logic/plannerCatalogue.ts`. The rule being checked is the one the brief states: **a dish picture is a claim about that dish, so it may not invent an ingredient the recipe does not list.** Omitting a listed ingredient is not a defect; depicting an unlisted one is.

| Candidate | Depicts | Verdict |
| --- | --- | --- |
| `planner-overnight-oats-banana-peanut` | Oats, banana slices, a spoonful of peanut butter | Consistent |
| `planner-miso-tofu-morning-soup` | Broth, tofu cubes, shiitake, bok choy | Consistent |
| `planner-savoury-oat-porridge-shiitake` | Oat porridge, shiitake slices, ginger batons, cilantro | Consistent; the crossed ginger batons read ambiguously at full size and are worth a human look |
| `planner-smashed-cucumber-tofu-salad` | Cucumber, tofu, dark dressing, cilantro, sesame | Consistent |
| `planner-ginger-chicken-bok-choy` | Sliced chicken, greens, dark sauce | Consistent; shiitake is not visible, which is an omission rather than an invention |
| `planner-garlic-shrimp-tomato` | Shrimp, tomato, lime wedge, cilantro, oil | Consistent |
| `planner-pork-belly-bok-choy-braise` | Braised pork cubes, green stalks | Consistent; the stalks read as bok choy stems, and no other green is listed |
| `planner-miso-glazed-salmon` | Glazed salmon fillet, green stalks, sesame seeds | Consistent; same ambiguity between bok choy stems and spring onion, which is not listed |
| `planner-braised-tofu-ginger-pork` | Tofu cubes, ground pork, sauce | Consistent |
| `planner-chicken-thigh-tomato-parmesan` | Browned chicken thighs, tomatoes, grated parmesan, in a pan | Consistent |

**Nothing was re-rolled.** No candidate depicts an ingredient outside its recipe, so every existing sidecar, seed and checksum is preserved exactly as generated. The two ambiguous greens and the porridge's ginger batons are recorded for the human reviewer rather than pre-emptively regenerated; re-rolling a valid candidate would discard a reproducible provenance record to chase a preference nobody has expressed.

## What still gates promotion

1. **Named human visual acceptance** of the five cuisine candidates and the ten planner dish candidates, at the sizes they actually render at. Not done; task 6.7 remains open.
2. Review in both supported themes and at large text.
3. `--promote ... --reviewer "<a real person>"`, then the parity checks in `test/illustration-registries.test.ts` and `npm run art:list`.

One observation for that review, from the rail's implementation: the tile is a 64 dp circle and the source art is a centred subject on generous negative space, so the food occupies roughly the middle 60% of the tile. The frame deliberately does not zoom in, because cropping toward the subject risks cutting the food and the paper edge is part of the approved style. If the subject reads too small on the device, the fix is a larger tile rather than a tighter crop.