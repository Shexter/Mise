import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Divider } from '@/components/Card';
import { ChoiceList, Segmented } from '@/components/Choice';
import { EmptyState } from '@/components/EmptyState';
import { Field } from '@/components/Field';
import { Sheet } from '@/components/Sheet';
import { Body, Caption, RowTitle, SectionLabel } from '@/components/Type';
import { color, layout, opacity, space } from '@/constants/theme';
import { getAllCanonicals } from '@/db/queries';
import { createCanonicalFromProposal } from '@/logic/canonicals';
import type { CanonicalProposal } from '@/logic/match';
import { normalise } from '@/logic/normalise';
import { FOOD_CLASSES, STORAGE_LOCATIONS, type CanonicalItem, type FoodClass, type StorageLocation } from '@/types';

interface Props {
  visible: boolean;
  title?: string;
  /** Canonical ids pinned above the search results, e.g. a suggested match. */
  suggestedIds?: readonly string[];
  /** Canonical ids hidden from the list, e.g. an already-picked merge side. */
  excludedIds?: readonly string[];
  /** Off for flows where a brand-new ingredient makes no sense, e.g. a merge. */
  allowCreate?: boolean;
  onPick: (item: CanonicalItem) => void;
  onClose: () => void;
}

function label(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const FOOD_CLASS_OPTIONS = FOOD_CLASSES.map((value) => ({ value, label: label(value) }));
const LOCATION_OPTIONS = STORAGE_LOCATIONS.map((value) => ({ value, label: label(value) }));

/**
 * Picks one canonical ingredient. Every row shows the canonical display
 * name — never a raw observed string. When nothing matches, the same sheet
 * can create the ingredient instead of dead-ending the search.
 */
export function CanonicalPickerSheet({
  visible,
  title = 'Pick an ingredient',
  suggestedIds = [],
  excludedIds = [],
  allowCreate = true,
  onPick,
  onClose,
}: Props) {
  const [items, setItems] = useState<CanonicalItem[]>([]);
  const [query, setQuery] = useState('');

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newFoodClass, setNewFoodClass] = useState<FoodClass | null>(null);
  const [newLocation, setNewLocation] = useState<StorageLocation | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [duplicate, setDuplicate] = useState<{ existing: CanonicalItem; score: number } | null>(null);

  useEffect(() => {
    if (!visible) return;
    setQuery('');
    setCreating(false);
    setNewFoodClass(null);
    setNewLocation(null);
    setError(undefined);
    setSubmitting(false);
    setDuplicate(null);
    void getAllCanonicals().then(setItems);
  }, [visible]);

  const { suggested, rest } = useMemo(() => {
    const needle = normalise(query);
    const visible_ = items.filter(
      (item) =>
        !excludedIds.includes(item.id) &&
        (needle.length === 0 || normalise(item.displayName).includes(needle)),
    );
    return {
      suggested: visible_.filter((item) => suggestedIds.includes(item.id)),
      rest: visible_.filter((item) => !suggestedIds.includes(item.id)),
    };
  }, [items, query, suggestedIds, excludedIds]);

  const openCreate = () => {
    setNewName(query.trim());
    setNewFoodClass(null);
    setNewLocation(null);
    setError(undefined);
    setDuplicate(null);
    setCreating(true);
  };

  const handleCreate = async () => {
    const trimmedName = newName.trim();
    if (trimmedName.length === 0) {
      setError('Give it a name.');
      return;
    }
    if (!newFoodClass) {
      setError('Pick a category.');
      return;
    }
    if (!newLocation) {
      setError('Pick where it lives.');
      return;
    }
    setError(undefined);
    setSubmitting(true);
    const proposal: CanonicalProposal = {
      displayName: trimmedName,
      foodClass: newFoodClass,
      defaultLocation: newLocation,
      shelfLifeDays: {},
      openLifeDays: null,
      typicalUseQty: null,
      typicalUseUnit: null,
    };
    const result = await createCanonicalFromProposal(proposal, {
      userConfirmedDistinct: duplicate !== null,
    });
    setSubmitting(false);
    if (result.kind === 'needs_confirmation') {
      setDuplicate({ existing: result.existing, score: result.score });
      return;
    }
    setCreating(false);
    setDuplicate(null);
    onPick(result.item);
  };

  const renderRow = (item: CanonicalItem, isSuggested: boolean) => (
    <Pressable
      key={item.id}
      onPress={() => onPick(item)}
      accessibilityRole="button"
      accessibilityLabel={item.displayName}
      style={({ pressed }) => [
        styles.row,
        pressed && { opacity: opacity.pressed },
      ]}
    >
      <View style={styles.rowText}>
        <RowTitle>{item.displayName}</RowTitle>
        <Caption muted>
          {isSuggested ? 'Suggested · ' : ''}
          {item.foodClass} · {item.defaultLocation}
        </Caption>
      </View>
    </Pressable>
  );

  const resultCount = suggested.length + rest.length;

  return (
    <Sheet visible={visible} onClose={onClose} title={creating ? 'New ingredient' : title}>
      {creating ? (
        <View style={styles.form}>
          <Field
            label="Name"
            value={newName}
            onChangeText={setNewName}
            placeholder="e.g. Potato"
            autoFocus
          />
          <View>
            <SectionLabel muted style={styles.formLabel}>
              Category
            </SectionLabel>
            <ChoiceList options={FOOD_CLASS_OPTIONS} value={newFoodClass} onChange={setNewFoodClass} />
          </View>
          <View>
            <SectionLabel muted style={styles.formLabel}>
              Where it lives
            </SectionLabel>
            <Segmented options={LOCATION_OPTIONS} value={newLocation} onChange={setNewLocation} />
          </View>
          {duplicate ? (
            <View style={styles.duplicate}>
              <Body>
                This looks close to &quot;{duplicate.existing.displayName}&quot;, already in your
                ingredients.
              </Body>
              <Button
                label={`Use "${duplicate.existing.displayName}" instead`}
                variant="secondary"
                onPress={() => {
                  onPick(duplicate.existing);
                  setCreating(false);
                  setDuplicate(null);
                }}
              />
              <Button
                label="Create as a separate ingredient"
                variant="ghost"
                onPress={handleCreate}
                loading={submitting}
              />
            </View>
          ) : (
            <>
              {error ? <Caption style={styles.error}>{error}</Caption> : null}
              <Button label="Add ingredient" onPress={handleCreate} loading={submitting} />
              <Button label="Cancel" variant="ghost" onPress={() => setCreating(false)} />
            </>
          )}
        </View>
      ) : (
        <>
          <Field
            value={query}
            onChangeText={setQuery}
            placeholder="Search ingredients"
          />
          {resultCount === 0 ? (
            <EmptyState
              title="Nothing matches"
              detail="Try a shorter search, or add it as a new ingredient."
              actionLabel={allowCreate ? 'Add as new ingredient' : undefined}
              onAction={allowCreate ? openCreate : undefined}
            />
          ) : (
            <View>
              {suggested.map((item) => renderRow(item, true))}
              {suggested.length > 0 && rest.length > 0 ? <Divider /> : null}
              {rest.map((item) => renderRow(item, false))}
            </View>
          )}
          {query.length === 0 ? (
            <Body muted>
              Names shown are the app's own ingredient names, not receipt text.
            </Body>
          ) : null}
          {allowCreate && resultCount > 0 ? (
            <Button
              label="Can't find it? Add new ingredient"
              variant="ghost"
              onPress={openCreate}
              style={styles.createLink}
            />
          ) : null}
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: layout.minRowHeight,
    paddingVertical: space.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowText: { gap: space.xs, flex: 1 },
  createLink: { marginTop: space.sm },
  form: { gap: space.base },
  formLabel: { marginBottom: space.sm, marginLeft: space.xs },
  duplicate: { gap: space.sm },
  error: { color: color.paprika },
});
