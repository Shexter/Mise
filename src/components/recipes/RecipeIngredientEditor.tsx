import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Segmented } from '@/components/Choice';
import { Field } from '@/components/Field';
import { CanonicalPickerSheet } from '@/components/match/CanonicalPickerSheet';
import { Sheet } from '@/components/Sheet';
import { Caption, SectionLabel } from '@/components/Type';
import { CollapsibleEditorRow } from '@/components/CollapsibleEditorRow';
import { nextExpandedId } from '@/logic/collapsibleEditor';
import { color, space } from '@/constants/theme';
import type { CanonicalItem, MeasureUnit, RecipeIngredient } from '@/types';
import { MEASURE_UNITS } from '@/types';

type EditorUnit = MeasureUnit | 'none';

interface DraftIngredient {
  id: string;
  recipeId: string;
  name: string;
  quantity: string;
  unit: EditorUnit;
  canonicalId: string | null;
  sortOrder: number;
}

interface Props {
  visible: boolean;
  ingredients: readonly RecipeIngredient[];
  canonicalNames: ReadonlyMap<string, string>;
  onClose: () => void;
  onSave: (ingredients: readonly RecipeIngredient[]) => Promise<void>;
}

const UNIT_OPTIONS = MEASURE_UNITS.map((value) => ({ value, label: value }));
const NO_UNIT = { value: 'none' as const, label: 'Not stated' };

function toDraft(ingredient: RecipeIngredient): DraftIngredient {
  return {
    ...ingredient,
    quantity: ingredient.quantity === null ? '' : String(ingredient.quantity),
    unit: ingredient.unit ?? 'none',
  };
}

/** Edits only user-owned recipe facts; provenance remains on the recipe. */
export function RecipeIngredientEditor({
  visible,
  ingredients,
  canonicalNames,
  onClose,
  onSave,
}: Props) {
  const [drafts, setDrafts] = useState<DraftIngredient[]>([]);
  const [pickingId, setPickingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setDrafts(ingredients.map(toDraft));
    setError(null);
    setPickingId(null);
    setExpandedId(ingredients[0]?.id ?? null);
  }, [visible, ingredients]);

  const patch = (id: string, values: Partial<DraftIngredient>) => {
    setDrafts((current) => current.map((draft) =>
      draft.id === id ? { ...draft, ...values } : draft,
    ));
  };

  const save = async () => {
    const trimmed = drafts.map((draft) => ({ ...draft, name: draft.name.trim() }));
    if (trimmed.some((draft) => draft.name.length === 0)) {
      setError('Every ingredient needs a name.');
      return;
    }
    const invalid = trimmed.some((draft) =>
      draft.quantity.trim().length > 0 &&
      (!Number.isFinite(Number(draft.quantity)) || Number(draft.quantity) <= 0),
    );
    if (invalid) {
      setError('Amounts must be positive numbers, or left blank when not stated.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(trimmed.map((draft, sortOrder) => ({
        id: draft.id,
        recipeId: draft.recipeId,
        name: draft.name,
        quantity: draft.quantity.trim().length === 0 ? null : Number(draft.quantity),
        unit: draft.quantity.trim().length === 0 || draft.unit === 'none' ? null : draft.unit,
        canonicalId: draft.canonicalId,
        sortOrder,
      })));
      onClose();
    } catch {
      setError('The ingredient changes could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const picking = drafts.find((draft) => draft.id === pickingId);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Edit ingredients"
      footer={<Button label="Save ingredients" onPress={() => void save()} loading={saving} />}
    >
      <Caption muted>
        Leave an amount blank when the recipe did not state one. Mise will not guess it.
      </Caption>
      {drafts.map((draft, index) => (
        <CollapsibleEditorRow
          key={draft.id}
          title={draft.name || `Ingredient ${index + 1}`}
          subtitle={draft.quantity.trim().length > 0
            ? `${draft.quantity}${draft.unit === 'none' ? '' : ` ${draft.unit}`}`
            : 'Amount not stated'}
          expanded={expandedId === draft.id}
          onToggle={() => setExpandedId((current) => nextExpandedId(current, draft.id))}
        >
          <Card padded={false}>
          <View style={styles.fields}>
            <Field label="Name" value={draft.name} onChangeText={(name) => patch(draft.id, { name })} />
            <Field
              label="Amount"
              value={draft.quantity}
              onChangeText={(quantity) => patch(draft.id, { quantity })}
              keyboardType="decimal-pad"
              numeric
              hint="Blank means not stated."
            />
            <View>
              <SectionLabel muted style={styles.label}>Unit</SectionLabel>
              <Segmented
                options={[NO_UNIT, ...UNIT_OPTIONS.slice(0, 3)]}
                value={draft.unit}
                onChange={(unit: EditorUnit) => patch(draft.id, { unit })}
              />
              <Segmented
                options={UNIT_OPTIONS.slice(3)}
                value={draft.unit === 'none' ? null : draft.unit}
                onChange={(unit: MeasureUnit) => patch(draft.id, { unit })}
                style={styles.unitRow}
              />
            </View>
            <Button
              label={draft.canonicalId
                ? `Matched: ${canonicalNames.get(draft.canonicalId) ?? draft.canonicalId}`
                : 'Match catalogue ingredient'}
              variant="secondary"
              onPress={() => setPickingId(draft.id)}
            />
            {draft.canonicalId ? (
              <Button
                label="Clear match"
                variant="ghost"
                block={false}
                onPress={() => patch(draft.id, { canonicalId: null })}
              />
            ) : null}
          </View>
          </Card>
        </CollapsibleEditorRow>
      ))}
      {error ? <Caption style={styles.error}>{error}</Caption> : null}
      <CanonicalPickerSheet
        visible={picking !== undefined}
        title="Which ingredient is it?"
        suggestedIds={picking?.canonicalId ? [picking.canonicalId] : []}
        onPick={(item: CanonicalItem) => {
          if (picking) patch(picking.id, { canonicalId: item.id });
          setPickingId(null);
        }}
        onClose={() => setPickingId(null)}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  fields: { gap: space.base },
  label: { marginBottom: space.sm, marginLeft: space.xs },
  unitRow: { marginTop: space.sm },
  error: { color: color.paprika },
});
