import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  CATEGORY_FALLBACK_TOKENS,
  CURATED_FOOD_ILLUSTRATIONS,
  FOOD_VISUAL_SIZES,
  foodVisualImageKey,
  getCategoryFallbackToken,
  normalizeCanonicalId,
  resolveFoodVisual,
  resolveFoodVisualAccessibility,
  resolveFoodVisualWithFailures,
  resolveSizeDimensions,
  type FoodCategory,
} from "@/media/foodVisuals";
import { FOOD_CLASSES } from "@/types";

const ASSET_DIR = "assets/food";

interface ManifestAsset {
  canonicalId: string;
  displayName: string;
  fileName: string;
  category: string;
  sourceModel: string;
  license: string;
  promptRecipe: string;
  seed: number;
  workflowVersion: string;
  reviewDate: string;
  reviewedBy: string;
  outputChecksum: string;
}

interface ManifestSchema {
  schemaVersion: string;
  description: string;
  assets: Record<string, ManifestAsset>;
}

function readManifest(): ManifestSchema {
  return JSON.parse(readFileSync(join(ASSET_DIR, "manifest.json"), "utf8")) as ManifestSchema;
}

/**
 * Registers an illustration for the duration of one test. Tier 3 ships empty
 * until art direction is accepted, so precedence still has to be provable
 * against the real registry rather than a stubbed copy of it.
 */
function withIllustration(canonicalId: string): void {
  CURATED_FOOD_ILLUSTRATIONS[canonicalId] = { uri: `test://${canonicalId}` };
}

afterEach(() => {
  for (const key of Object.keys(CURATED_FOOD_ILLUSTRATIONS)) {
    delete CURATED_FOOD_ILLUSTRATIONS[key];
  }
});

describe("4-Tier Food Visual Precedence Resolver", () => {
  test("Tier 1: user retained photo outranks every other tier", () => {
    withIllustration("chicken-breast");
    const visual = resolveFoodVisual({
      photoUri: "file:///data/user/photos/chicken.jpg",
      productImageUrl: "https://images.openfoodfacts.org/chicken.jpg",
      canonicalId: "chicken-breast",
      category: "protein",
    });

    expect(visual.kind).toBe("photo");
    expect(visual.uri).toBe("file:///data/user/photos/chicken.jpg");
    expect(visual.source).toBeUndefined();
  });

  test("Tier 2: product package photo wins when no user photo exists", () => {
    withIllustration("soy-sauce-light");
    const visual = resolveFoodVisual({
      photoUri: null,
      productImageUrl: "https://images.openfoodfacts.org/soy-sauce.jpg",
      canonicalId: "soy-sauce-light",
      category: "seasoning",
    });

    expect(visual.kind).toBe("product");
    expect(visual.uri).toBe("https://images.openfoodfacts.org/soy-sauce.jpg");
    expect(visual.source).toBeUndefined();
  });

  test("Tier 1 and 2 ignore blank and whitespace-only URIs", () => {
    const visual = resolveFoodVisual({
      photoUri: "   ",
      productImageUrl: "",
      category: "produce",
    });

    expect(visual.kind).toBe("category");
    expect(visual.category).toBe("produce");
  });

  test("Tier 3: a registered canonical illustration wins over the category badge", () => {
    withIllustration("broccoli");
    const visual = resolveFoodVisual({ canonicalId: "broccoli", category: "produce" });

    expect(visual.kind).toBe("illustration");
    expect(visual.canonicalId).toBe("broccoli");
    expect(visual.source).toBeDefined();
  });

  test("Tier 3 lookup normalises canonical id casing and whitespace", () => {
    withIllustration("bok-choy");
    const visual = resolveFoodVisual({ canonicalId: "  Bok-Choy ", category: "produce" });

    expect(visual.kind).toBe("illustration");
    expect(visual.canonicalId).toBe("bok-choy");
  });

  test("Tier 4: an unshipped canonical ingredient falls back to its category badge", () => {
    const visual = resolveFoodVisual({
      canonicalId: "dragon-fruit-rare-specimen",
      category: "produce",
    });

    expect(visual.kind).toBe("category");
    expect(visual.category).toBe("produce");
    expect(visual.iconName).toBe("sun");
    expect(visual.label).toBe("Produce");
  });

  test("Tier 4: missing or unrecognised category falls back safely to the default token", () => {
    expect(resolveFoodVisual({ canonicalId: "unknown-space-food", category: null }))
      .toMatchObject({ kind: "category", category: "other", iconName: "package", label: "Food" });

    expect(resolveFoodVisual({ category: "artisanal-space-jerky" }))
      .toMatchObject({ kind: "category", category: "other" });
  });

  test("Tier 3 is empty until art direction is accepted, so every food still resolves", () => {
    // The `Art direction follows the implemented app` requirement gates the
    // production pack. Nothing may render broken while the pack is empty.
    expect(Object.keys(CURATED_FOOD_ILLUSTRATIONS)).toHaveLength(0);

    for (const foodClass of FOOD_CLASSES) {
      const visual = resolveFoodVisual({ canonicalId: "anything-at-all", category: foodClass });
      expect(visual.kind, foodClass).toBe("category");
      expect(visual.iconName, foodClass).toBeTruthy();
      expect(visual.label, foodClass).toBeTruthy();
    }
  });
});

describe("Category fallback tokens", () => {
  test("every FoodClass has a distinct, labelled token, plus a default for `other`", () => {
    const categories: FoodCategory[] = [...FOOD_CLASSES, "other"];
    expect(Object.keys(CATEGORY_FALLBACK_TOKENS).sort()).toEqual([...categories].sort());

    for (const category of categories) {
      const token = CATEGORY_FALLBACK_TOKENS[category];
      expect(token.category, category).toBe(category);
      expect(token.label.length, category).toBeGreaterThan(2);
      expect(token.iconName, category).toBeTruthy();
      expect(token.backgroundColor, category).toBeTruthy();
      expect(token.iconColor, category).toBeTruthy();
    }
  });

  test("lookup is case and whitespace insensitive", () => {
    expect(getCategoryFallbackToken("  PRODUCE ").category).toBe("produce");
    expect(getCategoryFallbackToken("Seasoning").category).toBe("seasoning");
  });

  test("free-text aliases resolve onto the app's taxonomy, never a parallel one", () => {
    const aliases: Record<string, FoodCategory> = {
      grains: "staple",
      staples: "staple",
      vegetables: "produce",
      fruit: "produce",
      meat: "protein",
      seafood: "protein",
      spices: "seasoning",
      condiments: "condiment",
      sauces: "condiment",
      beverages: "beverage",
      drinks: "beverage",
    };

    for (const [alias, expected] of Object.entries(aliases)) {
      expect(getCategoryFallbackToken(alias).category, alias).toBe(expected);
    }
  });

  test("resolved category is always one the app actually models", () => {
    const valid = new Set<string>([...FOOD_CLASSES, "other"]);
    const inputs = ["produce", "snacks", "spices", "", "  ", "totally-made-up", null, undefined];

    for (const input of inputs) {
      expect(valid.has(getCategoryFallbackToken(input).category), String(input)).toBe(true);
    }
  });

  test("normalizeCanonicalId rejects blank ids rather than looking them up", () => {
    expect(normalizeCanonicalId(null)).toBeNull();
    expect(normalizeCanonicalId("   ")).toBeNull();
    expect(normalizeCanonicalId(" Jasmine-Rice ")).toBe("jasmine-rice");
  });
});

describe("Image failure handling", () => {
  test("a failed photo drops to the illustration, then to the category badge", () => {
    withIllustration("salmon");
    const item = {
      photoUri: "file:///missing.jpg",
      canonicalId: "salmon",
      category: "protein" as const,
    };

    const first = resolveFoodVisualWithFailures(item, []);
    expect(first.kind).toBe("photo");

    const afterPhotoFails = resolveFoodVisualWithFailures(item, [foodVisualImageKey(first)!]);
    expect(afterPhotoFails.kind).toBe("illustration");

    const afterBothFail = resolveFoodVisualWithFailures(item, [
      foodVisualImageKey(first)!,
      foodVisualImageKey(afterPhotoFails)!,
    ]);
    expect(afterBothFail.kind).toBe("category");
    expect(afterBothFail.category).toBe("protein");
  });

  test("two broken tiers settle on the badge instead of handing the image back and forth", () => {
    const item = {
      photoUri: "file:///broken.jpg",
      productImageUrl: "https://example.test/broken.jpg",
      category: "dairy" as const,
    };

    const photo = resolveFoodVisualWithFailures(item, []);
    const product = resolveFoodVisualWithFailures(item, [foodVisualImageKey(photo)!]);
    expect(product.kind).toBe("product");

    const settled = resolveFoodVisualWithFailures(item, [
      foodVisualImageKey(photo)!,
      foodVisualImageKey(product)!,
    ]);
    expect(settled.kind).toBe("category");

    // Stable: re-resolving with the same failures must not reopen a failed tier.
    expect(resolveFoodVisualWithFailures(item, [
      foodVisualImageKey(photo)!,
      foodVisualImageKey(product)!,
    ]).kind).toBe("category");
  });

  test("a replacement photo is attempted rather than inheriting the old one's failure", () => {
    const failed = foodVisualImageKey(
      resolveFoodVisualWithFailures({ photoUri: "file:///old.jpg" }, []),
    )!;

    const replaced = resolveFoodVisualWithFailures({ photoUri: "file:///new.jpg" }, [failed]);
    expect(replaced.kind).toBe("photo");
    expect(replaced.uri).toBe("file:///new.jpg");
  });

  test("the badge tier loads no image, so it has no failure identity", () => {
    expect(foodVisualImageKey(resolveFoodVisual({ category: "produce" }))).toBeNull();
  });
});

describe("Accessibility contract", () => {
  test("a visual with no alt is decorative, because the food's name sits beside it", () => {
    expect(resolveFoodVisualAccessibility(undefined).announced).toBe(false);
    expect(resolveFoodVisualAccessibility(null).announced).toBe(false);
    expect(resolveFoodVisualAccessibility("   ").announced).toBe(false);
  });

  test("an explicit alt is announced, trimmed, and never empty", () => {
    const a11y = resolveFoodVisualAccessibility("  Chicken breast  ");
    expect(a11y.announced).toBe(true);
    expect(a11y.label).toBe("Chicken breast");
  });

  test("no surface announces a food or dish name that its own text already reads out", () => {
    const surfaces = [
      "app/(tabs)/pantry.tsx",
      "app/dinner.tsx",
      "app/recipe/[id].tsx",
      "app/onboarding/first-plan.tsx",
      "app/onboarding/starter-pantry.tsx",
      "src/components/recipes/SavedRecipesSection.tsx",
      "src/components/suggestions/MealDetailSheet.tsx",
    ];

    for (const path of surfaces) {
      const source = readFileSync(path, "utf8");
      for (const block of source.match(/<(?:Food|Dish)Visual[\s\S]*?\/>/g) ?? []) {
        expect(block, path).not.toMatch(/\balt=/);
      }
    }
  });
});

describe("Sizing", () => {
  test("standard presets resolve valid dimensions and icon sizes", () => {
    expect(FOOD_VISUAL_SIZES.sm.dimension).toBe(32);
    expect(FOOD_VISUAL_SIZES.md.dimension).toBe(44);
    expect(FOOD_VISUAL_SIZES.lg.dimension).toBe(64);
    expect(FOOD_VISUAL_SIZES.hero.dimension).toBe(120);

    for (const [name, preset] of Object.entries(FOOD_VISUAL_SIZES)) {
      expect(preset.iconSize, name).toBeLessThan(preset.dimension);
      expect(preset.borderRadius, name).toBeGreaterThan(0);
    }
  });

  test("a numeric size resolves proportional icon and radius", () => {
    const custom = resolveSizeDimensions(80);
    expect(custom.dimension).toBe(80);
    expect(custom.iconSize).toBe(40);
    expect(custom.borderRadius).toBeGreaterThan(0);
  });

  test("a tiny numeric size keeps the icon legible", () => {
    expect(resolveSizeDimensions(16).iconSize).toBe(12);
  });
});

describe("Shipped asset provenance", () => {
  test("manifest is well-formed and declares the schema it is validated against", () => {
    const manifest = readManifest();

    expect(manifest.schemaVersion).toBe("2.0.0");
    expect(manifest.description.length).toBeGreaterThan(0);
    expect(existsSync(join(ASSET_DIR, "manifest.schema.json"))).toBe(true);
  });

  test("every shipped asset records complete, verified provenance", () => {
    const manifest = readManifest();

    for (const [id, meta] of Object.entries(manifest.assets)) {
      expect(meta.canonicalId, id).toBe(id);
      expect(id, id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(meta.displayName?.length, id).toBeGreaterThan(0);
      expect(FOOD_CLASSES, id).toContain(meta.category);
      expect(meta.sourceModel?.length, id).toBeGreaterThan(0);
      expect(meta.license?.length, id).toBeGreaterThan(0);
      expect(meta.promptRecipe?.length, id).toBeGreaterThan(0);
      expect(Number.isInteger(meta.seed), id).toBe(true);
      expect(meta.workflowVersion?.length, id).toBeGreaterThan(0);
      expect(meta.reviewDate, id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(meta.reviewedBy?.length, id).toBeGreaterThan(0);
      expect(meta.outputChecksum, id).toMatch(/^sha256:[0-9a-f]{64}$/);

      // Provenance is only worth recording if it describes the actual bytes.
      const filePath = join(ASSET_DIR, meta.fileName);
      expect(existsSync(filePath), filePath).toBe(true);
      const actual = createHash("sha256").update(readFileSync(filePath)).digest("hex");
      expect(`sha256:${actual}`, filePath).toBe(meta.outputChecksum);
    }
  });

  test("the manifest and the Metro require registry cannot drift apart", () => {
    const manifest = readManifest();
    expect(Object.keys(CURATED_FOOD_ILLUSTRATIONS).sort()).toEqual(
      Object.keys(manifest.assets).sort(),
    );
  });

  test("no image ships from assets/food without a provenance entry", () => {
    const manifest = readManifest();
    const images = readdirSync(ASSET_DIR).filter((name) => /\.(png|webp|jpg|jpeg)$/i.test(name));
    const declared = Object.values(manifest.assets).map((meta) => meta.fileName);

    expect(images.sort()).toEqual(declared.sort());
  });
});
