import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card, Divider } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Field } from '@/components/Field';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { Body, Caption, RowTitle, SectionLabel } from '@/components/Type';
import { Segmented } from '@/components/Choice';
import {
  addShoppingListSource,
  getAllCanonicals,
  getRecipe,
  insertShoppingListItem,
  listRecipes,
  listShoppingItems,
  updateShoppingListItem,
} from '@/db/queries';
import { buildRefreshPlan, groupShoppingItems, itemKey, mergeShoppingSources, quantityLabel } from '@/logic/shoppingList';
import { listPantryItems } from '@/db/queries';
import { color, layout, opacity, radius, space } from '@/constants/theme';
import { MEASURE_UNITS, type MeasureUnit, type ShoppingListItem, type ShoppingListSection } from '@/types';

export function ShoppingListSection() {
  const toast = useToast();
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ShoppingListItem | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [existing, pantry, recipes, canonicals] = await Promise.all([
      listShoppingItems(true),
      listPantryItems(),
      listRecipes(),
      getAllCanonicals(),
    ]);
    const recipeDetails = await Promise.all(recipes.map(async (recipe) => {
      return getRecipe(recipe.id);
    }));
    const plan = buildRefreshPlan({
      pantry,
      recipes: recipeDetails.filter((recipe): recipe is NonNullable<typeof recipe> => recipe !== null),
      suggestions: [],
      canonicals: new Map(canonicals.map((canonical) => [canonical.id, canonical])),
    });
    const merged = mergeShoppingSources(existing, plan.additions);
    for (const candidate of merged) {
      let stored = existing.find((item) => itemKey(item) === itemKey(candidate));
      if (!stored) {
        stored = await insertShoppingListItem({
          canonicalId: candidate.canonicalId,
          displayName: candidate.displayName,
          normalizedName: candidate.normalizedName,
          requestedQty: candidate.requestedQty,
          requestedUnit: candidate.requestedUnit,
          category: candidate.category,
          sortOrder: candidate.sortOrder,
        });
      }
      for (const source of candidate.sources) {
        await addShoppingListSource({
          shoppingItemId: stored.id,
          kind: source.kind,
          sourceId: source.sourceId,
          recipeId: source.recipeId,
          suggestionId: source.suggestionId,
        });
      }
    }
    setItems(await listShoppingItems(true));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const setStatus = async (item: ShoppingListItem, status: ShoppingListItem['status']) => {
    await updateShoppingListItem(item.id, { status });
    await load();
    toast.show({
      kind: 'success',
      message: status === 'purchased' ? `${item.displayName} marked purchased.` : `${item.displayName} restored.`,
      actionLabel: status === 'purchased' ? 'Undo' : undefined,
      onAction: status === 'purchased' ? () => void setStatus(item, 'open') : undefined,
    });
  };

  const addManual = async (name: string, note: string, quantity: string, unit: MeasureUnit | null) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const parsedQty = quantity.trim() ? Number(quantity) : null;
    const item = await insertShoppingListItem({ displayName: trimmed, normalizedName: trimmed.toLocaleLowerCase(), note: note.trim() || null, requestedQty: parsedQty !== null && Number.isFinite(parsedQty) ? parsedQty : null, requestedUnit: parsedQty !== null && Number.isFinite(parsedQty) ? unit : null });
    await addShoppingListSource({ shoppingItemId: item.id, kind: 'manual' });
    setAdding(false);
    await load();
  };

  const editManual = async (item: ShoppingListItem | null, name: string, note: string, quantity: string, unit: MeasureUnit | null) => {
    if (!item) return addManual(name, note, quantity, unit);
    const trimmed = name.trim();
    const parsedQty = quantity.trim() ? Number(quantity) : null;
    if (!trimmed || (parsedQty !== null && (!Number.isFinite(parsedQty) || parsedQty < 0))) return;
    await updateShoppingListItem(item.id, { displayName: trimmed, normalizedName: trimmed.toLocaleLowerCase(), note: note.trim() || null, requestedQty: parsedQty, requestedUnit: parsedQty === null ? null : unit });
    setEditing(null);
    await load();
    toast.show({ kind: 'success', message: 'Grocery item updated.' });
  };

  const sections = groupShoppingItems(items);
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View>
          <RowTitle>Grocery haul</RowTitle>
          <Caption muted>{items.filter((item) => item.status === 'open').length} items to pick up</Caption>
        </View>
        <Pressable onPress={() => setAdding(true)} accessibilityRole="button" accessibilityLabel="Add shopping list item" style={styles.add}>
          <Feather name="plus" size={22} color={color.ink} />
        </Pressable>
      </View>
      {loading ? <Caption muted>Refreshing from your pantry…</Caption> : sections.length === 0 ? (
        <Card><EmptyState title="Your list is clear" detail="Low pantry items and missing recipe ingredients will appear here." actionLabel="Add an item" onAction={() => setAdding(true)} /></Card>
      ) : sections.map((section) => <ShoppingSection key={section.category} section={section} onStatus={setStatus} onEdit={setEditing} />)}
      <ManualShoppingItemSheet visible={adding} onClose={() => setAdding(false)} onSave={editManual} />
      <ManualShoppingItemSheet item={editing} visible={editing !== null} onClose={() => setEditing(null)} onSave={editManual} />
    </View>
  );
}

function ShoppingSection({ section, onStatus, onEdit }: { section: ShoppingListSection; onStatus: (item: ShoppingListItem, status: ShoppingListItem['status']) => void; onEdit: (item: ShoppingListItem) => void }) {
  return <Card padded={false}>
    <SectionLabel muted style={styles.sectionLabel}>{section.label}</SectionLabel>
    {section.items.map((item, index) => <View key={item.id}>
      {index > 0 ? <Divider /> : null}
      <Pressable onPress={() => onStatus(item, 'purchased')} accessibilityRole="button" accessibilityLabel={`${item.displayName}, ${quantityLabel(item)}. Mark purchased`} style={({ pressed }) => [styles.row, pressed && { opacity: opacity.pressed }]}>
        <View style={styles.check}><Feather name="check" size={14} color={color.onAction} /></View>
        <View style={styles.text}><Body>{item.displayName}</Body><Caption muted>{quantityLabel(item)}{item.sources.length > 1 ? ` · ${item.sources.length} reasons` : ''}</Caption><View style={styles.actions}><Pressable onPress={() => onStatus(item, 'snoozed')} accessibilityRole="button" accessibilityLabel={`Snooze ${item.displayName}`}><Caption muted>Later</Caption></Pressable><Pressable onPress={() => onStatus(item, 'dismissed')} accessibilityRole="button" accessibilityLabel={`Dismiss ${item.displayName}`}><Caption muted>Remove</Caption></Pressable><Pressable onPress={() => onEdit(item)} accessibilityRole="button" accessibilityLabel={`Edit ${item.displayName}`}><Caption muted>Edit</Caption></Pressable></View></View>
      </Pressable>
    </View>)}
  </Card>;
}

function ManualShoppingItemSheet({ item, visible, onClose, onSave }: { item?: ShoppingListItem | null; visible: boolean; onClose: () => void; onSave: (item: ShoppingListItem | null, name: string, note: string, quantity: string, unit: MeasureUnit | null) => Promise<void> }) {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<MeasureUnit | null>(null);
  useEffect(() => { if (visible) { setName(item?.displayName ?? ''); setNote(item?.note ?? ''); setQuantity(item?.requestedQty == null ? '' : String(item.requestedQty)); setUnit(item?.requestedUnit ?? null); } }, [visible, item]);
  return <Sheet visible={visible} onClose={onClose} title={item ? 'Edit grocery item' : 'Add to grocery haul'} footer={<Button label={item ? 'Save changes' : 'Add item'} onPress={() => void onSave(item ?? null, name, note, quantity, unit)} />}>
    <Field label="Item" value={name} onChangeText={setName} placeholder="e.g. scallions" autoFocus />
    <Field label="Amount" value={quantity} onChangeText={setQuantity} placeholder="Optional" keyboardType="decimal-pad" numeric />
    <SectionLabel muted>Unit</SectionLabel>
    <Segmented options={MEASURE_UNITS.slice(0, 4).map((value) => ({ value, label: value }))} value={unit} onChange={setUnit} />
    <Segmented options={MEASURE_UNITS.slice(4).map((value) => ({ value, label: value }))} value={unit} onChange={setUnit} />
    <Field label="Note" value={note} onChangeText={setNote} placeholder="Optional" multiline />
    <Caption muted>Leave quantities blank when you do not know how much to buy.</Caption>
  </Sheet>;
}

const styles = StyleSheet.create({
  root: { gap: space.base },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  add: { width: layout.minTouchTarget, height: layout.minTouchTarget, alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { marginHorizontal: layout.cardPadding, marginTop: space.md, marginBottom: space.xs },
  row: { minHeight: layout.minRowHeight, paddingHorizontal: layout.cardPadding, paddingVertical: space.md, flexDirection: 'row', alignItems: 'center', gap: space.md },
  check: { width: 24, height: 24, borderRadius: radius.full, backgroundColor: color.action, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: space.xs },
  actions: { flexDirection: 'row', gap: space.base },
});
