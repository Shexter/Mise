import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Divider } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Field } from '@/components/Field';
import { Sheet } from '@/components/Sheet';
import { Body, Caption, RowTitle } from '@/components/Type';
import { layout, opacity, space } from '@/constants/theme';
import { getAllCanonicals } from '@/db/queries';
import { normalise } from '@/logic/normalise';
import type { CanonicalItem } from '@/types';

interface Props {
  visible: boolean;
  title?: string;
  /** Canonical ids pinned above the search results, e.g. a suggested match. */
  suggestedIds?: readonly string[];
  /** Canonical ids hidden from the list, e.g. an already-picked merge side. */
  excludedIds?: readonly string[];
  onPick: (item: CanonicalItem) => void;
  onClose: () => void;
}

/**
 * Picks one canonical ingredient. Every row shows the canonical display
 * name — never a raw observed string.
 */
export function CanonicalPickerSheet({
  visible,
  title = 'Pick an ingredient',
  suggestedIds = [],
  excludedIds = [],
  onPick,
  onClose,
}: Props) {
  const [items, setItems] = useState<CanonicalItem[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!visible) return;
    setQuery('');
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

  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <Field
        value={query}
        onChangeText={setQuery}
        placeholder="Search ingredients"
      />
      {suggested.length + rest.length === 0 ? (
        <EmptyState
          title="Nothing matches"
          detail="Try a shorter search."
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
});
