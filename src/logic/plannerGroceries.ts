import { convert } from '@/logic/measures';
import { normalise } from '@/logic/normalise';
import { projectRecipeQuantity } from '@/logic/plannerNutrition';
import type {
  CanonicalItem,
  PlanGroceryContribution,
  PlanGroceryDemand,
  PlannedBatch,
  PlannerRecipeSnapshot,
  PlanPantryCoverage,
} from '@/types';

export function buildPlanGroceryDemand(params: {
  batches: readonly PlannedBatch[];
  snapshots: readonly PlannerRecipeSnapshot[];
  canonicals?: ReadonlyMap<string, CanonicalItem>;
}): PlanGroceryDemand[] {
  const snapshots = new Map(params.snapshots.map((snapshot) => [snapshot.id, snapshot]));
  const groups = new Map<string, { demand: PlanGroceryDemand; unitAnchor: PlanGroceryContribution['unit'] }>();
  for (const batch of params.batches) {
    const snapshot = snapshots.get(batch.snapshotId);
    if (!snapshot) throw new Error('Grocery demand references a missing recipe snapshot');
    for (const ingredient of snapshot.ingredients.filter((item) => item.included)) {
      const quantity = projectRecipeQuantity(ingredient.quantity, snapshot.baseYield, batch.producedPortions);
      const sourceKey = `${batch.id}:${ingredient.id}`;
      const identity = ingredient.canonicalId ? `canonical:${ingredient.canonicalId}` : `text:${normalise(ingredient.name)}`;
      const compatible = [...groups.entries()].find(([key, group]) => {
        if (!key.startsWith(`${identity}:`)) return false;
        if (quantity === null || ingredient.unit === null || group.unitAnchor === null) return ingredient.unit === group.unitAnchor;
        const facts = ingredient.canonicalId ? params.canonicals?.get(ingredient.canonicalId) : undefined;
        return ingredient.unit === group.unitAnchor || (facts ? convert(quantity, ingredient.unit, group.unitAnchor, facts) !== null : false);
      });
      const key = compatible?.[0] ?? `${identity}:${ingredient.unit ?? 'unknown'}:${groups.size}`;
      const contribution: PlanGroceryContribution = {
        sourceKey, batchId: batch.id, snapshotIngredientId: ingredient.id,
        canonicalId: ingredient.canonicalId, displayName: ingredient.name,
        quantity, unit: ingredient.unit,
      };
      const current = compatible?.[1];
      if (!current) {
        groups.set(key, {
          unitAnchor: ingredient.unit,
          demand: { key, canonicalId: ingredient.canonicalId, displayName: ingredient.name, quantity, unit: ingredient.unit, hasUnknownQuantity: quantity === null, contributions: [contribution] },
        });
        continue;
      }
      let converted = quantity;
      if (quantity !== null && ingredient.unit !== null && current.unitAnchor !== null && ingredient.unit !== current.unitAnchor) {
        const facts = ingredient.canonicalId ? params.canonicals?.get(ingredient.canonicalId) : undefined;
        converted = facts ? convert(quantity, ingredient.unit, current.unitAnchor, facts) : null;
      }
      current.demand = {
        ...current.demand,
        quantity: converted === null ? current.demand.quantity : (current.demand.quantity ?? 0) + converted,
        hasUnknownQuantity: current.demand.hasUnknownQuantity || quantity === null,
        contributions: [...current.demand.contributions, contribution],
      };
    }
  }
  return [...groups.values()].map((group) => group.demand);
}

export function demandAfterCoverage(
  demand: PlanGroceryDemand,
  coverage: PlanPantryCoverage | undefined,
  currentRevision: number,
): PlanGroceryDemand {
  if (!coverage || coverage.scheduleRevision !== currentRevision) return demand;
  if (coverage.haveEnough) return { ...demand, quantity: demand.quantity === null ? null : 0 };
  if (demand.quantity === null || coverage.coveredQuantity === null || coverage.unit !== demand.unit) return demand;
  return { ...demand, quantity: Math.max(0, demand.quantity - coverage.coveredQuantity) };
}

export function groceryRevisionKey(scheduleId: string, revision: number, demands: readonly PlanGroceryDemand[]): string {
  return `${scheduleId}:${revision}:${demands.map((demand) => `${demand.key}=${demand.quantity ?? '?'}${demand.unit ?? '?'}/${demand.hasUnknownQuantity}`).sort().join('|')}`;
}

export interface PlanGroceryDiff {
  added: readonly PlanGroceryDemand[];
  removed: readonly PlanGroceryDemand[];
  changed: readonly PlanGroceryDemand[];
}

export function diffPlanGroceryDemand(
  applied: readonly PlanGroceryDemand[],
  next: readonly PlanGroceryDemand[],
): PlanGroceryDiff {
  const before = new Map(applied.map((demand) => [demand.key, demand]));
  const after = new Map(next.map((demand) => [demand.key, demand]));
  const sameQuantity = (a: PlanGroceryDemand, b: PlanGroceryDemand) =>
    a.quantity === b.quantity && a.unit === b.unit && a.hasUnknownQuantity === b.hasUnknownQuantity;
  return {
    added: next.filter((demand) => !before.has(demand.key)),
    removed: applied.filter((demand) => !after.has(demand.key)),
    changed: next.filter((demand) => before.has(demand.key) && !sameQuantity(before.get(demand.key)!, demand)),
  };
}
