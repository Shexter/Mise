import { describe, expect, test } from "vitest";
import {
  buildDishComposition,
  buildPlateGeometry,
  buildPlateWedgePaths,
  dishPlatingRotation,
  resolveDishVisual,
} from "@/media/dishVisuals";
import { CATEGORY_FALLBACK_TOKENS } from "@/media/foodVisuals";
import type { FoodClass } from "@/types";

describe("Dish composition", () => {
  test("a dish is its own mix of food classes, largest share first", () => {
    const wedges = buildDishComposition(["produce", "protein", "produce", "staple"]);

    // produce leads on count; staple precedes protein on the FOOD_CLASSES tie-break.
    expect(wedges.map((wedge) => wedge.category)).toEqual(["produce", "staple", "protein"]);
    expect(wedges[0]!.fraction).toBeCloseTo(0.5);
    expect(wedges[1]!.fraction).toBeCloseTo(0.25);
    expect(wedges.reduce((sum, wedge) => sum + wedge.fraction, 0)).toBeCloseTo(1);
  });

  test("wedges carry the same colour the class carries as an ingredient badge", () => {
    for (const wedge of buildDishComposition(["produce", "protein", "seasoning"])) {
      expect(wedge.color, wedge.category).toBe(CATEGORY_FALLBACK_TOKENS[wedge.category].iconColor);
    }
  });

  test("equal shares plate in a stable order, so a dish never reshuffles", () => {
    const first = buildDishComposition(["seasoning", "produce", "protein"]);
    const second = buildDishComposition(["protein", "seasoning", "produce"]);

    expect(first.map((wedge) => wedge.category)).toEqual(second.map((wedge) => wedge.category));
    // Tie-break follows FOOD_CLASSES order, not insertion order.
    expect(first.map((wedge) => wedge.category)).toEqual(["produce", "protein", "seasoning"]);
  });

  test("an unresolved ingredient adds no wedge rather than a guessed one", () => {
    const wedges = buildDishComposition(["protein", null, undefined, "protein"]);

    expect(wedges).toHaveLength(1);
    expect(wedges[0]!.category).toBe("protein");
    expect(wedges[0]!.fraction).toBe(1);
  });

  test("a dish with nothing resolved composes no wedges at all", () => {
    expect(buildDishComposition([])).toEqual([]);
    expect(buildDishComposition([null, undefined])).toEqual([]);
    expect(buildDishComposition()).toEqual([]);
  });

  test("counts ingredients rather than quantities, so no wedge can vanish", () => {
    // Quantities arrive in mixed units (g, ml, count); weighting by them would
    // be meaningless. Counting bounds every wedge at 1/n of the plate.
    const wedges = buildDishComposition(["protein", "produce", "produce", "produce", "seasoning"]);
    for (const wedge of wedges) {
      expect(wedge.fraction, wedge.category).toBeGreaterThanOrEqual(1 / 5);
    }
  });
});

describe("Plating angle", () => {
  test("is stable for a dish, so the same dish always plates the same way", () => {
    expect(dishPlatingRotation("Ginger chicken stir-fry")).toBe(
      dishPlatingRotation("Ginger chicken stir-fry"),
    );
    expect(dishPlatingRotation("  GINGER chicken stir-fry ")).toBe(
      dishPlatingRotation("ginger chicken stir-fry"),
    );
  });

  test("differs between dishes, so identical compositions still read apart", () => {
    expect(dishPlatingRotation("Miso salmon")).not.toBe(dishPlatingRotation("Roast chicken"));
  });

  test("is always a usable angle", () => {
    const names = ["a", "Miso salmon with rice", "🍜 noodles", "", "   ", "x".repeat(400)];
    for (const name of names) {
      const rotation = dishPlatingRotation(name);
      expect(Number.isInteger(rotation), name).toBe(true);
      expect(rotation, name).toBeGreaterThanOrEqual(0);
      expect(rotation, name).toBeLessThan(360);
    }
  });
});

describe("Dish visual resolution", () => {
  test("a photo of the finished dish outranks the drawn plate", () => {
    const resolved = resolveDishVisual({
      photoUri: "file:///meals/stir-fry.jpg",
      dish: "Stir-fry",
      foodClasses: ["protein", "produce"],
    });

    expect(resolved.kind).toBe("photo");
    expect(resolved.uri).toBe("file:///meals/stir-fry.jpg");
  });

  test("a blank photo URI falls through to the plate", () => {
    const resolved = resolveDishVisual({ photoUri: "   ", dish: "Stir-fry", foodClasses: ["produce"] });

    expect(resolved.kind).toBe("plate");
    expect(resolved.wedges).toHaveLength(1);
  });

  test("a dish with no resolvable ingredients still resolves to an empty plate", () => {
    const resolved = resolveDishVisual({ dish: "Leftovers", foodClasses: [null] });

    expect(resolved.kind).toBe("plate");
    expect(resolved.wedges).toEqual([]);
  });

  test("a dish never borrows an ingredient's identity", () => {
    // The input has no way to express "use this ingredient's picture", which is
    // the point: a dish is composed, never impersonated.
    const resolved = resolveDishVisual({ dish: "Chicken and broccoli", foodClasses: ["protein"] });
    expect(resolved.kind).toBe("plate");
    expect(Object.keys(resolved)).not.toContain("canonicalId");
  });
});

describe("Plate geometry", () => {
  test("the well always leaves a visible ring of ceramic", () => {
    for (const size of [20, 32, 44, 64, 120]) {
      const geometry = buildPlateGeometry(size);
      expect(geometry.center, String(size)).toBe(size / 2);
      expect(geometry.wellRadius, String(size)).toBeGreaterThan(0);
      expect(geometry.wellRadius, String(size)).toBeLessThan(geometry.rimRadius);
      expect(geometry.rimRadius - geometry.wellRadius, String(size)).toBeGreaterThanOrEqual(1);
      // The rim stroke must stay inside the canvas or it clips.
      expect(geometry.rimRadius + geometry.rimStrokeWidth / 2, String(size)).toBeLessThanOrEqual(size / 2);
    }
  });
});

describe("Plate wedge paths", () => {
  const geometry = buildPlateGeometry(64);

  test("a single class fills the well as a circle, because no arc can sweep 360°", () => {
    const paths = buildPlateWedgePaths(buildDishComposition(["staple"]), geometry);

    expect(paths).toHaveLength(1);
    expect(paths[0]!.path).toBeNull();
    expect(paths[0]!.category).toBe("staple");
  });

  test("no classes draws nothing", () => {
    expect(buildPlateWedgePaths([], geometry)).toEqual([]);
  });

  test("each class gets one wedge, and every wedge is finite geometry", () => {
    const classes: FoodClass[] = ["produce", "produce", "protein", "staple", "seasoning"];
    const paths = buildPlateWedgePaths(buildDishComposition(classes), geometry, 37);

    expect(paths).toHaveLength(4);
    for (const wedge of paths) {
      expect(wedge.path, wedge.category).toMatch(/^M [\d.]+ [\d.]+ L /);
      expect(wedge.path, wedge.category).not.toMatch(/NaN|Infinity|undefined/);
    }
  });

  test("a share over half sets the large-arc flag, or the wedge draws inside out", () => {
    const [major, minor] = buildPlateWedgePaths(
      buildDishComposition(["produce", "produce", "produce", "protein"]),
      geometry,
    );

    expect(major!.path).toContain(" 1 1 ");
    expect(minor!.path).toContain(" 0 1 ");
  });

  test("plating angle rotates the whole arrangement without changing shares", () => {
    const wedges = buildDishComposition(["produce", "protein"]);
    const unrotated = buildPlateWedgePaths(wedges, geometry, 0);
    const rotated = buildPlateWedgePaths(wedges, geometry, 90);

    expect(rotated).toHaveLength(unrotated.length);
    expect(rotated.map((wedge) => wedge.category)).toEqual(
      unrotated.map((wedge) => wedge.category),
    );
    expect(rotated[0]!.path).not.toBe(unrotated[0]!.path);
  });
});
