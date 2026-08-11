import type {
  MealItem,
  MealType,
  MealVenue,
  MealWithItems,
  MeasureUnit,
} from '@/types';

export interface MealItemDraft {
  id: string;
  name: string;
  quantity: string;
  unit: MeasureUnit;
  calories: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
  isManualAddition: boolean;
  canonicalId: string | null;
}

/** A local edit buffer. Immutable provenance stays in `original`. */
export interface MealEditDraft {
  original: MealWithItems;
  name: string;
  mealType: MealType;
  venue: MealVenue;
  servingsMult: string;
  items: MealItemDraft[];
}

export interface MealEditErrors {
  name?: string;
  servingsMult?: string;
  items?: string;
  itemFields: Record<string, Partial<Record<keyof MealItemDraft, string>>>;
}

export function mealToDraft(meal: MealWithItems): MealEditDraft {
  return {
    original: meal,
    name: meal.name,
    mealType: meal.mealType,
    venue: meal.venue,
    servingsMult: String(meal.servingsMult),
    items: meal.items.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: String(item.quantity),
      unit: item.unit,
      calories: item.calories === null ? '' : String(item.calories),
      proteinG: item.proteinG === null ? '' : String(item.proteinG),
      carbsG: item.carbsG === null ? '' : String(item.carbsG),
      fatG: item.fatG === null ? '' : String(item.fatG),
      isManualAddition: item.isManualAddition,
      canonicalId: item.canonicalId,
    })),
  };
}

function finite(value: string): number | null {
  if (value.trim().length === 0) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function validateMealDraft(draft: MealEditDraft): MealEditErrors {
  const errors: MealEditErrors = { itemFields: {} };
  if (draft.name.trim().length === 0) errors.name = 'Enter a meal name.';
  if (draft.items.length === 0) errors.items = 'Add at least one item.';

  const servings = finite(draft.servingsMult);
  if (draft.venue === 'home' && (servings === null || servings <= 0)) {
    errors.servingsMult = 'Enter a number greater than zero.';
  }

  for (const item of draft.items) {
    const fields: Partial<Record<keyof MealItemDraft, string>> = {};
    if (item.name.trim().length === 0) fields.name = 'Enter an item name.';
    const quantity = finite(item.quantity);
    if (quantity === null || quantity <= 0) {
      fields.quantity = 'Enter a number greater than zero.';
    }
    for (const key of ['calories', 'proteinG', 'carbsG', 'fatG'] as const) {
      const value = finite(item[key]);
      if (value !== null && value < 0) {
        fields[key] = 'Enter zero or a positive number, or leave it unknown.';
      }
    }
    if (Object.keys(fields).length > 0) errors.itemFields[item.id] = fields;
  }
  return errors;
}

export function hasMealEditErrors(errors: MealEditErrors): boolean {
  return Boolean(
    errors.name ||
      errors.servingsMult ||
      errors.items ||
      Object.keys(errors.itemFields).length > 0,
  );
}

/** Converts a valid draft while taking immutable fields only from the original. */
export function normaliseMealDraft(draft: MealEditDraft): MealWithItems {
  const venue = draft.venue;
  const servingsMult =
    venue === 'home' ? Math.max(1, finite(draft.servingsMult) ?? 1) : 1;
  const mealId = draft.original.id;
  const items: MealItem[] = draft.items.map((item, sortOrder) => ({
    id: item.id,
    mealId,
    name: item.name.trim(),
    quantity: finite(item.quantity) ?? 0,
    unit: item.unit,
    calories: finite(item.calories),
    proteinG: finite(item.proteinG),
    carbsG: finite(item.carbsG),
    fatG: finite(item.fatG),
    fibreG: draft.original.items.find((original) => original.id === item.id)?.fibreG ?? null,
    isManualAddition: item.isManualAddition,
    sortOrder,
    canonicalId: item.canonicalId,
  }));
  return {
    ...draft.original,
    name: draft.name.trim(),
    mealType: draft.mealType,
    venue,
    servingsMult,
    items,
  };
}

function editableShape(meal: MealWithItems): unknown {
  return {
    name: meal.name.trim(),
    mealType: meal.mealType,
    venue: meal.venue,
    servingsMult: meal.venue === 'home' ? meal.servingsMult : 1,
    items: meal.items.map((item, sortOrder) => ({
      id: item.id,
      name: item.name.trim(),
      quantity: item.quantity,
      unit: item.unit,
      calories: item.calories,
      proteinG: item.proteinG,
      carbsG: item.carbsG,
      fatG: item.fatG,
      isManualAddition: item.isManualAddition,
      sortOrder,
      canonicalId: item.canonicalId,
    })),
  };
}

export function mealsHaveSameEditableValues(
  left: MealWithItems,
  right: MealWithItems,
): boolean {
  return JSON.stringify(editableShape(left)) === JSON.stringify(editableShape(right));
}

export function isMealDraftDirty(draft: MealEditDraft): boolean {
  return !mealsHaveSameEditableValues(draft.original, normaliseMealDraft(draft));
}
