import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card, Divider } from '@/components/Card';
import { Field } from '@/components/Field';
import { CanonicalPickerSheet } from '@/components/match/CanonicalPickerSheet';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { Body, Caption, RowTitle, SectionLabel } from '@/components/Type';
import { ChoiceList, Segmented } from '@/components/Choice';
import {
  addShoppingListSource,
  deleteShoppingListItem,
  getAllCanonicals,
  getLocations,
  getRecipe,
  insertShoppingListItem,
  listPantryItems,
  listRecipes,
  listShoppingItems,
  removeShoppingListSource,
  updateShoppingListItem,
} from '@/db/queries';
import {
  buildRefreshPlan,
  closedShoppingItems,
  groupShoppingItems,
  itemKey,
  manualEntryDraft,
  mergeShoppingSources,
  normalizeShoppingListCategory,
  orphanedOpenItemIds,
  planCanonicalReassignment,
  quantityLabel,
  SHOPPING_CATEGORY_LABELS,
  SHOPPING_LIST_CATEGORIES,
  sourceExplanations,
  validateShoppingQuantity,
} from '@/logic/shoppingList';
import { color, layout, opacity, radius, space } from '@/constants/theme';
import { MEASURE_UNITS, type CanonicalItem, type MeasureUnit, type ShoppingListCategory, type ShoppingListItem, type ShoppingListSection } from '@/types';
import { usePantryStore } from '@/store/pantryStore';
import { CollapsibleEditorRow } from '@/components/CollapsibleEditorRow';
import { nextExpandedId } from '@/logic/collapsibleEditor';
import { localDateString } from '@/logic/dates';
import { restockFromShoppingItem } from '@/logic/stockRestock';

interface ManualEntrySubmission {
  canonicalId: string | null;
  displayName: string;
  normalizedName: string;
  category: ShoppingListCategory;
  note: string | null;
  requestedQty: number | null;
  requestedUnit: MeasureUnit | null;
}

export function ShoppingListSection() {
  const toast = useToast();
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [recipeTitles, setRecipeTitles] = useState<Map<string, string>>(new Map());
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ShoppingListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'open' | 'history'>('open');
  const pantryRevision = usePantryStore((state) => state.revision);
  const restock = usePantryStore((state) => state.restock);
  const undoRestock = usePantryStore((state) => state.undoRestock);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [existing, pantry, recipes, canonicals] = await Promise.all([
        listShoppingItems(true),
        listPantryItems(),
        listRecipes(),
        getAllCanonicals(),
      ]);
      const recipeDetails = await Promise.all(recipes.map(async (recipe) => {
        return getRecipe(recipe.id);
      }));
      const resolvedRecipes = recipeDetails.filter((recipe): recipe is NonNullable<typeof recipe> => recipe !== null);
      setRecipeTitles(new Map(resolvedRecipes.flatMap((recipe) => {
        const title = recipe.title?.trim();
        return title ? [[recipe.id, title]] : [];
      })));

      const plan = buildRefreshPlan({
        existingItems: existing,
        pantry,
        recipes: resolvedRecipes,
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
        for (const source of candidate.sources ?? []) {
          await addShoppingListSource({
            shoppingItemId: stored.id,
            kind: source.kind,
            sourceId: source.sourceId,
            recipeId: source.recipeId,
            suggestionId: source.suggestionId,
          });
        }
      }

      for (const stale of plan.staleAutomaticSources) {
        await removeShoppingListSource(stale.shoppingItemId, stale);
      }

      const afterRefresh = await listShoppingItems(true);
      for (const orphanId of orphanedOpenItemIds(afterRefresh)) {
        await deleteShoppingListItem(orphanId);
      }

      setItems(await listShoppingItems(true));
    } catch {
      setItems([]);
      setRecipeTitles(new Map());
      toast.show({ kind: 'recoverable-error', message: 'Your grocery list could not be refreshed. Try again in a moment.' });
    } finally {
      setLoading(false);
    }
  }, [pantryRevision, toast]);

  useEffect(() => { void load(); }, [load]);

  const restockPurchasedItem = async (
    item: ShoppingListItem,
    previousStatus: ShoppingListItem['status'],
  ) => {
    try {
      const [pantry, canonicals, locations] = await Promise.all([
        listPantryItems(),
        getAllCanonicals(),
        getLocations(),
      ]);
      const canonical = canonicals.find((candidate) => candidate.id === item.canonicalId) ?? null;
      const plan = restockFromShoppingItem(
        item,
        pantry,
        canonical,
        locations,
        localDateString(),
      );
      if (!plan) throw new Error('This grocery item cannot be placed in Pantry yet.');

      const undo = await restock(plan);
      toast.show({
        kind: 'success',
        message: `${item.displayName} added to Pantry.`,
        actionLabel: 'Undo',
        onAction: () => {
          void undoRestock(undo, item.id, previousStatus)
            .then(load)
            .then(() => toast.show({ kind: 'success', message: `${item.displayName} restored.` }))
            .catch(() => toast.show({ kind: 'recoverable-error', message: 'The restock could not be undone. Try again.' }));
        },
      });
    } catch {
      toast.show({
        kind: 'recoverable-error',
        message: `${item.displayName} could not be restocked.`,
        actionLabel: 'Undo purchase',
        onAction: () => void setStatus(item, previousStatus),
      });
    }
  };

  const setStatus = async (item: ShoppingListItem, status: ShoppingListItem['status']) => {
    const previousStatus = item.status;
    await updateShoppingListItem(item.id, { status });
    await load();
    const message = status === 'purchased' ? `${item.displayName} marked purchased.`
      : status === 'snoozed' ? `${item.displayName} snoozed for later.`
      : status === 'dismissed' ? `${item.displayName} dismissed.`
      : `${item.displayName} restored.`;
    toast.show({
      kind: 'success',
      message,
      actionLabel: status === 'purchased' && item.canonicalId ? 'Restock in Pantry'
        : status !== 'open' ? 'Undo' : undefined,
      onAction: status === 'purchased' && item.canonicalId
        ? () => void restockPurchasedItem(item, previousStatus)
        : status !== 'open' ? () => void setStatus(item, previousStatus) : undefined,
    });
  };

  const addManual = async (submission: ManualEntrySubmission) => {
    const plan = submission.canonicalId ? planCanonicalReassignment(items, '', submission.canonicalId) : null;
    if (plan?.kind === 'merge') {
      const target = items.find((candidate) => candidate.id === plan.targetItemId);
      await addShoppingListSource({ shoppingItemId: plan.targetItemId, kind: 'manual' });
      if (target && target.requestedQty === null && submission.requestedQty !== null) {
        await updateShoppingListItem(target.id, { requestedQty: submission.requestedQty, requestedUnit: submission.requestedUnit });
      }
      setAdding(false);
      await load();
      toast.show({ kind: 'success', message: `Added to your existing ${target?.displayName ?? 'item'}.` });
      return;
    }
    const inserted = await insertShoppingListItem({
      canonicalId: submission.canonicalId,
      displayName: submission.displayName,
      normalizedName: submission.normalizedName,
      category: submission.category,
      note: submission.note,
      requestedQty: submission.requestedQty,
      requestedUnit: submission.requestedUnit,
    });
    await addShoppingListSource({ shoppingItemId: inserted.id, kind: 'manual' });
    setAdding(false);
    await load();
  };

  const editManual = async (item: ShoppingListItem | null, submission: ManualEntrySubmission) => {
    if (!item) return addManual(submission);
    const plan = planCanonicalReassignment(items, item.id, submission.canonicalId);
    if (plan.kind === 'merge') {
      const target = items.find((candidate) => candidate.id === plan.targetItemId);
      for (const source of item.sources) {
        await addShoppingListSource({
          shoppingItemId: plan.targetItemId,
          kind: source.kind,
          sourceId: source.sourceId,
          recipeId: source.recipeId,
          suggestionId: source.suggestionId,
        });
      }
      if (target && target.requestedQty === null && submission.requestedQty !== null) {
        await updateShoppingListItem(target.id, { requestedQty: submission.requestedQty, requestedUnit: submission.requestedUnit });
      }
      await deleteShoppingListItem(item.id);
      setEditing(null);
      await load();
      toast.show({ kind: 'success', message: `Merged with your existing ${target?.displayName ?? 'item'}.` });
      return;
    }
    await updateShoppingListItem(item.id, {
      canonicalId: submission.canonicalId,
      displayName: submission.displayName,
      normalizedName: submission.normalizedName,
      category: submission.category,
      note: submission.note,
      requestedQty: submission.requestedQty,
      requestedUnit: submission.requestedUnit,
    });
    setEditing(null);
    await load();
    toast.show({ kind: 'success', message: 'Grocery item updated.' });
  };

  const sections = groupShoppingItems(items);
  const history = closedShoppingItems(items);
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
      <Segmented
        options={[{ value: 'open', label: 'To buy' }, { value: 'history', label: 'History' }]}
        value={view}
        onChange={setView}
      />
      {loading ? <Caption muted>Refreshing from your pantry…</Caption> : view === 'open' ? (
        sections.length === 0 ? (
          <Card>
            <Body>Your list is clear</Body>
            <Caption muted>Low pantry items and missing recipe ingredients will appear here.</Caption>
            <Button label="Add an item" variant="secondary" block={false} onPress={() => setAdding(true)} style={styles.emptyAction} />
          </Card>
        ) : sections.map((section) => (
          <ShoppingSection key={section.category} section={section} recipeTitles={recipeTitles} onStatus={setStatus} onEdit={setEditing} />
        ))
      ) : history.length === 0 ? (
        <Card>
          <Body>Nothing here yet</Body>
          <Caption muted>Items you mark purchased, snooze, or dismiss appear here so you can restore them.</Caption>
        </Card>
      ) : (
        <ShoppingHistory items={history} recipeTitles={recipeTitles} onRestore={(item) => setStatus(item, 'open')} />
      )}
      <ManualShoppingItemSheet visible={adding} onClose={() => setAdding(false)} onSave={editManual} />
      <ManualShoppingItemSheet item={editing} visible={editing !== null} onClose={() => setEditing(null)} onSave={editManual} />
    </View>
  );
}

function ShoppingSection({ section, recipeTitles, onStatus, onEdit }: {
  section: ShoppingListSection;
  recipeTitles: Map<string, string>;
  onStatus: (item: ShoppingListItem, status: ShoppingListItem['status']) => void;
  onEdit: (item: ShoppingListItem) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const sectionLabel = section.label?.trim() || SHOPPING_CATEGORY_LABELS[normalizeShoppingListCategory(section.category)];
  return <Card padded={false}>
    <SectionLabel muted style={styles.sectionLabel}>{sectionLabel}</SectionLabel>
    {(section.items ?? []).filter(Boolean).map((item, index) => {
      const displayName = item.displayName?.trim() || 'Unnamed item';
      return <View key={item.id}>
      {index > 0 ? <Divider /> : null}
      <CollapsibleEditorRow
        title={displayName}
        subtitle={`${quantityLabel(item)} · ${sourceExplanations(item.sources ?? [], recipeTitles).join(' · ')}`}
        expanded={expandedId === item.id}
        onToggle={() => setExpandedId((current) => nextExpandedId(current, item.id))}
      >
        <View style={styles.detail}>
          <Pressable onPress={() => onStatus(item, 'purchased')} accessibilityRole="button" accessibilityLabel={`Mark purchased ${displayName}`} style={styles.complete}>
            <View style={styles.check}><Feather name="check" size={14} color={color.onAction} /></View>
            <Body>Mark purchased</Body>
          </Pressable>
          <View style={styles.actions}>
            <Pressable onPress={() => onStatus(item, 'snoozed')} accessibilityRole="button" accessibilityLabel={`Snooze ${displayName}`} hitSlop={space.sm} style={styles.textAction}><Caption muted>Later</Caption></Pressable>
            <Pressable onPress={() => onStatus(item, 'dismissed')} accessibilityRole="button" accessibilityLabel={`Dismiss ${displayName}`} hitSlop={space.sm} style={styles.textAction}><Caption muted>Remove</Caption></Pressable>
            <Pressable onPress={() => onEdit(item)} accessibilityRole="button" accessibilityLabel={`Edit ${displayName}`} hitSlop={space.sm} style={styles.textAction}><Caption muted>Edit</Caption></Pressable>
          </View>
        </View>
      </CollapsibleEditorRow>
    </View>;
    })}
  </Card>;
}

const HISTORY_STATUS_LABEL: Record<string, string> = {
  purchased: 'Purchased',
  snoozed: 'Snoozed for later',
  dismissed: 'Dismissed',
};

function ShoppingHistory({ items, recipeTitles, onRestore }: {
  items: ShoppingListItem[];
  recipeTitles: Map<string, string>;
  onRestore: (item: ShoppingListItem) => void;
}) {
  return <Card padded={false}>
    {items.filter(Boolean).map((item, index) => {
      const displayName = item.displayName?.trim() || 'Unnamed item';
      const statusLabel = HISTORY_STATUS_LABEL[item.status] ?? 'Updated';
      return <View key={item.id}>
      {index > 0 ? <Divider /> : null}
      <View style={styles.row}>
        <View style={styles.text}>
          <RowTitle>{displayName}</RowTitle>
          <Caption muted>{statusLabel} · {sourceExplanations(item.sources ?? [], recipeTitles).join(' · ')}</Caption>
        </View>
        <Pressable onPress={() => onRestore(item)} accessibilityRole="button" accessibilityLabel={`Restore ${displayName} to your list`} hitSlop={space.sm} style={styles.textAction}>
          <Caption>Restore</Caption>
        </Pressable>
      </View>
    </View>;
    })}
  </Card>;
}

function ManualShoppingItemSheet({ item, visible, onClose, onSave }: {
  item?: ShoppingListItem | null;
  visible: boolean;
  onClose: () => void;
  onSave: (item: ShoppingListItem | null, submission: ManualEntrySubmission) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [quantity, setQuantity] = useState('');
  const [quantityError, setQuantityError] = useState<string | null>(null);
  const [unit, setUnit] = useState<MeasureUnit | null>(null);
  const [canonical, setCanonical] = useState<CanonicalItem | null>(null);
  const [manualCategory, setManualCategory] = useState<ShoppingListCategory>('other');
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(item?.displayName ?? '');
    setNote(item?.note ?? '');
    setQuantity(item?.requestedQty == null ? '' : String(item.requestedQty));
    setUnit(item?.requestedUnit ?? null);
    setQuantityError(null);
    setManualCategory(normalizeShoppingListCategory(item?.category));
    setCanonical(null);
    if (item?.canonicalId) {
      const canonicalId = item.canonicalId;
      void getAllCanonicals()
        .then((all) => {
          const match = all.find((candidate) => candidate.id === canonicalId);
          if (match) setCanonical(match);
        })
        .catch(() => setCanonical(null));
    }
  }, [visible, item]);

  const handleSave = () => {
    const validated = validateShoppingQuantity(quantity);
    if (validated.error) {
      setQuantityError(validated.error);
      return;
    }
    const draft = manualEntryDraft(name, canonical, manualCategory);
    if (draft.displayName.length === 0) return;
    void onSave(item ?? null, {
      canonicalId: draft.canonicalId,
      displayName: draft.displayName,
      normalizedName: draft.normalizedName,
      category: draft.category,
      note: note.trim() || null,
      requestedQty: validated.quantity,
      requestedUnit: validated.quantity === null ? null : unit,
    });
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={item ? 'Edit grocery item' : 'Add to grocery haul'} footer={<Button label={item ? 'Save changes' : 'Add item'} onPress={handleSave} />}>
      <SectionLabel muted>Ingredient</SectionLabel>
      <Pressable
        onPress={() => setPicking(true)}
        accessibilityRole="button"
        accessibilityLabel={canonical ? `${canonical.displayName}, tap to change` : 'Match to a known ingredient, optional'}
        style={({ pressed }) => [styles.pickerBox, pressed && { opacity: opacity.pressed }]}
      >
        {canonical ? <RowTitle>{canonical.displayName}</RowTitle> : <Body muted>Match to a known ingredient (optional)</Body>}
      </Pressable>
      {canonical ? (
        <Pressable onPress={() => setCanonical(null)} accessibilityRole="button" accessibilityLabel="Clear matched ingredient and type a name instead" hitSlop={space.sm} style={styles.textAction}>
          <Caption muted>Use free text instead</Caption>
        </Pressable>
      ) : (
        <Field label="Item" value={name} onChangeText={setName} placeholder="e.g. scallions" autoFocus />
      )}
      <Field label="Amount" value={quantity} onChangeText={(value) => { setQuantity(value); setQuantityError(null); }} placeholder="Optional" keyboardType="decimal-pad" numeric error={quantityError ?? undefined} />
      <SectionLabel muted>Unit</SectionLabel>
      <Segmented options={MEASURE_UNITS.slice(0, 4).map((value) => ({ value, label: value }))} value={unit} onChange={setUnit} />
      <Segmented options={MEASURE_UNITS.slice(4).map((value) => ({ value, label: value }))} value={unit} onChange={setUnit} />
      {canonical ? null : (
        <>
          <SectionLabel muted>Category</SectionLabel>
          <ChoiceList
            options={SHOPPING_LIST_CATEGORIES.map((category) => ({ value: category, label: SHOPPING_CATEGORY_LABELS[category] ?? SHOPPING_CATEGORY_LABELS.other }))}
            value={manualCategory}
            onChange={setManualCategory}
          />
        </>
      )}
      <Field label="Note" value={note} onChangeText={setNote} placeholder="Optional" multiline />
      <Caption muted>Leave quantities blank when you do not know how much to buy.</Caption>
      <CanonicalPickerSheet
        visible={picking}
        title="Match an ingredient"
        onPick={(picked) => { setCanonical(picked); setPicking(false); }}
        onClose={() => setPicking(false)}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.base },
  emptyAction: { marginTop: space.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  add: { width: layout.minTouchTarget, height: layout.minTouchTarget, alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { marginHorizontal: layout.cardPadding, marginTop: space.md, marginBottom: space.xs },
  row: { minHeight: layout.minRowHeight, paddingHorizontal: layout.cardPadding, paddingVertical: space.md, flexDirection: 'row', alignItems: 'center', gap: space.md },
  check: { width: 24, height: 24, borderRadius: radius.full, backgroundColor: color.action, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: space.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.base },
  textAction: { minHeight: layout.minTouchTarget, justifyContent: 'center' },
  detail: { gap: space.base },
  complete: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: layout.minTouchTarget },
  pickerBox: { minHeight: layout.minTouchTarget, justifyContent: 'center', paddingHorizontal: layout.cardPadding, borderWidth: 1, borderColor: color.line, borderRadius: radius.input },
});
