import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Card, Divider } from '@/components/Card';
import { Segmented } from '@/components/Choice';
import { CanonicalPickerSheet } from '@/components/match/CanonicalPickerSheet';
import { LineEditSheet } from '@/components/receipt/LineEditSheet';
import { Body, Caption, RowTitle, ScreenTitle, SectionLabel } from '@/components/Type';
import { useToast } from '@/components/Toast';
import { color, layout, opacity, radius, space } from '@/constants/theme';
import {
  discardReceipt,
  getAllCanonicals,
  getLocations,
  getReceipt,
  listPantryItems,
  markItemUsedUp,
  setReceiptLineDetails,
  setReceiptLineExcluded,
} from '@/db/queries';
import { friendlyDate } from '@/logic/dates';
import { checkArithmetic, planReceiptApply, type PantryChange } from '@/logic/receipt';
import {
  acceptReceiptReview,
  changeReceiptType,
  correctReceiptLine,
  reclassifyReceiptLine,
} from '@/logic/receiptService';
import { formatQuantity } from '@/logic/scaling';
import type {
  CanonicalItem,
  Location,
  MeasureUnit,
  PantryItem,
  ReceiptLine,
  ReceiptType,
  ReceiptWithLines,
} from '@/types';

const TYPE_OPTIONS: { value: ReceiptType; label: string }[] = [
  { value: 'grocery', label: 'Grocery' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'other', label: 'Other' },
];

/**
 * The feature, not polish (tasks.md group 8): a thirty-line receipt with
 * two wrong lines is only usable if the two are findable. Confidently
 * matched lines read as one compact list; anything uncertain — an
 * unresolved food line, a reconciliation question — surfaces above it.
 */
export default function ReceiptReviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { receiptId } = useLocalSearchParams<{ receiptId: string }>();

  const [receipt, setReceipt] = useState<ReceiptWithLines | null>(null);
  const [canonicals, setCanonicals] = useState<Map<string, CanonicalItem>>(new Map());
  const [catalogue, setCatalogue] = useState<PantryItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [correcting, setCorrecting] = useState<ReceiptLine | null>(null);
  const [editing, setEditing] = useState<ReceiptLine | null>(null);
  const [dismissedPrompts, setDismissedPrompts] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!receiptId) return;
    const [stored, canonicalList, items, locs] = await Promise.all([
      getReceipt(receiptId),
      getAllCanonicals(),
      listPantryItems(),
      getLocations(),
    ]);
    setReceipt(stored);
    setCanonicals(new Map(canonicalList.map((c) => [c.id, c])));
    setCatalogue(items);
    setLocations(locs);
  }, [receiptId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!receipt) {
    return (
      <View style={[styles.root, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator color={color.ink} />
      </View>
    );
  }

  const displayName = (line: ReceiptLine) =>
    (line.canonicalId && canonicals.get(line.canonicalId)?.displayName) || line.rawText;

  const foodLines = receipt.lines.filter((l) => l.kind === 'food' && !l.excluded);
  const unresolved = foodLines.filter((l) => !l.canonicalId);
  const matched = foodLines.filter((l) => l.canonicalId);
  const excludedLines = receipt.lines.filter((l) => l.excluded);
  const nonFoodLines = receipt.lines.filter((l) => l.kind === 'non_food' && !l.excluded);
  const moneyLines = receipt.lines.filter(
    (l) => (l.kind === 'discount' || l.kind === 'deposit' || l.kind === 'refund') && !l.excluded,
  );

  const arithmetic = checkArithmetic(receipt.lines, receipt.subtotalCents);

  const preview: PantryChange[] = planReceiptApply(
    receipt.lines,
    catalogue,
    canonicals,
    locations,
    receipt.type,
    receipt.purchasedAt,
  );
  const prompts = preview.filter(
    (c): c is Extract<PantryChange, { kind: 'flag_asked' }> =>
      c.kind === 'flag_asked' && !dismissedPrompts.has(c.pantryItemId),
  );

  const changeType = async (type: ReceiptType) => {
    await changeReceiptType(receipt.id, type);
    await load();
  };

  const pickForLine = async (item: CanonicalItem) => {
    if (!correcting) return;
    await correctReceiptLine(correcting.id, correcting.rawText, item.id);
    setCorrecting(null);
    await load();
  };

  const applyDetails = async (details: {
    qty: number | null;
    unit: MeasureUnit | null;
    lineTotalCents: number | null;
  }) => {
    if (!editing) return;
    await setReceiptLineDetails(editing.id, details);
    setEditing(null);
    await load();
  };

  const toggleExcluded = async (line: ReceiptLine) => {
    void Haptics.selectionAsync();
    await setReceiptLineExcluded(line.id, !line.excluded);
    await load();
  };

  const reclassifyAsFood = async (line: ReceiptLine) => {
    await reclassifyReceiptLine(receipt.id, line.id, 'food');
    await load();
  };

  const markOldFinished = async (pantryItemId: string) => {
    await markItemUsedUp(pantryItemId);
    setDismissedPrompts((prev) => new Set(prev).add(pantryItemId));
    await load();
  };

  const dismissPrompt = (pantryItemId: string) => {
    setDismissedPrompts((prev) => new Set(prev).add(pantryItemId));
  };

  const accept = async () => {
    setSaving(true);
    try {
      const summary = await acceptReceiptReview(receipt.id);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show({
        message:
          summary.names.length > 0
            ? `Added ${summary.names.slice(0, 3).join(', ')}${summary.names.length > 3 ? `, and ${summary.names.length - 3} more` : ''}.`
            : 'Receipt saved.',
      });
      router.dismissAll();
      router.replace('/(tabs)/pantry');
    } finally {
      setSaving(false);
    }
  };

  const discard = async () => {
    await discardReceipt(receipt.id);
    router.back();
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <ScreenTitle numberOfLines={1}>{receipt.store ?? 'Receipt'}</ScreenTitle>
          <Caption muted>{friendlyDate(receipt.purchasedAt)}</Caption>
        </View>
        <Button label="Close" variant="ghost" block={false} onPress={() => router.back()} />
      </View>

      <View style={styles.typeRow}>
        <Segmented options={TYPE_OPTIONS} value={receipt.type} onChange={(t) => void changeType(t)} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxxl }]}
        showsVerticalScrollIndicator={false}
      >
        {arithmetic.status === 'mismatch' ? (
          <Card>
            <Body>
              {`Lines add up to $${(arithmetic.sumCents / 100).toFixed(2)}, but the receipt's own subtotal is $${(arithmetic.subtotalCents / 100).toFixed(2)} — off by $${(Math.abs(arithmetic.differenceCents) / 100).toFixed(2)}.`}
            </Body>
            <Caption muted>
              Extraction likely dropped, duplicated, or misread a line. Check the list below.
            </Caption>
          </Card>
        ) : null}

        {prompts.map((prompt) => {
          const item = catalogue.find((i) => i.id === prompt.pantryItemId);
          const name = item ? canonicals.get(item.canonicalId)?.displayName : null;
          return (
            <Card key={prompt.pantryItemId}>
              <Body>{`Is your running-low ${name ?? 'item'} already finished?`}</Body>
              <View style={styles.promptRow}>
                <Button
                  label="Yes, mark it out"
                  variant="secondary"
                  onPress={() => void markOldFinished(prompt.pantryItemId)}
                />
                <Button
                  label="No"
                  variant="ghost"
                  onPress={() => dismissPrompt(prompt.pantryItemId)}
                />
              </View>
            </Card>
          );
        })}

        {unresolved.length > 0 ? (
          <Card title="Needs a match">
            {unresolved.map((line, index) => (
              <View key={line.id}>
                {index > 0 ? <Divider /> : null}
                <LineRow
                  title={line.rawText}
                  detail={priceLabel(line)}
                  actionLabel="Match"
                  onPress={() => setCorrecting(line)}
                  onExclude={() => void toggleExcluded(line)}
                />
              </View>
            ))}
          </Card>
        ) : null}

        {matched.length > 0 ? (
          <Card title="Matched">
            {matched.map((line, index) => (
              <View key={line.id}>
                {index > 0 ? <Divider /> : null}
                <LineRow
                  title={displayName(line)}
                  provenance={line.rawText}
                  detail={priceLabel(line)}
                  actionLabel="Edit"
                  onPress={() => setEditing(line)}
                  onSecondaryPress={() => setCorrecting(line)}
                  secondaryLabel="Change match"
                  onExclude={() => void toggleExcluded(line)}
                />
              </View>
            ))}
          </Card>
        ) : null}

        {excludedLines.length > 0 ? (
          <Card title="Excluded">
            {excludedLines.map((line, index) => (
              <View key={line.id}>
                {index > 0 ? <Divider /> : null}
                <LineRow
                  title={displayName(line)}
                  detail="Excluded"
                  actionLabel="Include"
                  onPress={() => void toggleExcluded(line)}
                  compact
                />
              </View>
            ))}
          </Card>
        ) : null}

        {nonFoodLines.length > 0 ? (
          <Card title="Not food">
            {nonFoodLines.map((line, index) => (
              <View key={line.id}>
                {index > 0 ? <Divider /> : null}
                <LineRow
                  title={line.rawText}
                  actionLabel="This is food"
                  onPress={() => void reclassifyAsFood(line)}
                  compact
                />
              </View>
            ))}
          </Card>
        ) : null}

        {moneyLines.length > 0 ? (
          <Card title="Money">
            {moneyLines.map((line, index) => (
              <View key={line.id}>
                {index > 0 ? <Divider /> : null}
                <LineRow title={line.rawText} detail={moneyLineDetail(line)} compact />
              </View>
            ))}
          </Card>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.sm }]}>
        <Button label="Accept" onPress={() => void accept()} loading={saving} />
        <Button label="Discard" variant="ghost" onPress={() => void discard()} />
      </View>

      <CanonicalPickerSheet
        visible={correcting !== null}
        title={correcting ? `Match “${correcting.rawText}”` : 'Match'}
        suggestedIds={correcting?.canonicalId ? [correcting.canonicalId] : []}
        onPick={(item) => void pickForLine(item)}
        onClose={() => setCorrecting(null)}
      />

      <LineEditSheet
        line={editing}
        displayName={editing ? displayName(editing) : ''}
        onClose={() => setEditing(null)}
        onApply={(details) => void applyDetails(details)}
      />
    </View>
  );
}

function priceLabel(line: ReceiptLine): string {
  if (line.lineTotalCents === null) return 'Price unknown';
  const price = `$${(line.lineTotalCents / 100).toFixed(2)}`;
  if (line.qty === null || !line.unit) return price;
  const quantity =
    line.quantityKind === 'count'
      ? `${formatQuantity(line.qty)} container${line.qty === 1 ? '' : 's'}`
      : `${formatQuantity(line.qty)} ${line.unit}`;
  return `${quantity} · ${price}`;
}

const MONEY_LINE_LABELS: Record<'discount' | 'deposit' | 'refund', string> = {
  discount: 'Discount',
  deposit: 'Deposit / levy',
  refund: 'Refund',
};

function moneyLineDetail(line: ReceiptLine): string {
  const kindLabel =
    line.kind === 'discount' || line.kind === 'deposit' || line.kind === 'refund'
      ? MONEY_LINE_LABELS[line.kind]
      : line.kind;
  if (line.lineTotalCents === null) return kindLabel;
  const amount = `${line.lineTotalCents < 0 ? '−' : ''}$${(Math.abs(line.lineTotalCents) / 100).toFixed(2)}`;
  return `${kindLabel} · ${amount}`;
}

function LineRow({
  title,
  provenance,
  detail,
  actionLabel,
  onPress,
  secondaryLabel,
  onSecondaryPress,
  onExclude,
  compact = false,
}: {
  title: string;
  provenance?: string;
  detail?: string;
  actionLabel?: string;
  onPress?: () => void;
  secondaryLabel?: string;
  onSecondaryPress?: () => void;
  onExclude?: () => void;
  compact?: boolean;
}) {
  return (
    <View style={[styles.row, compact && styles.rowCompact]}>
      <View style={styles.rowText}>
        <RowTitle numberOfLines={1}>{title}</RowTitle>
        {provenance ? (
          <Caption muted numberOfLines={1}>
            “{provenance}”
          </Caption>
        ) : null}
        {detail ? <Caption muted>{detail}</Caption> : null}
      </View>
      <View style={styles.rowActions}>
        {secondaryLabel && onSecondaryPress ? (
          <Pressable onPress={onSecondaryPress} accessibilityRole="button">
            <Caption>{secondaryLabel}</Caption>
          </Pressable>
        ) : null}
        {actionLabel && onPress ? (
          <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            style={({ pressed }) => [styles.actionChip, pressed && { opacity: opacity.pressed }]}
          >
            <Caption>{actionLabel}</Caption>
          </Pressable>
        ) : null}
        {onExclude ? (
          <Pressable
            onPress={onExclude}
            accessibilityRole="button"
            accessibilityLabel="Exclude"
            style={({ pressed }) => [styles.excludeButton, pressed && { opacity: opacity.pressed }]}
          >
            <Caption muted>✕</Caption>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.ground },
  centered: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenGutter,
  },
  headerText: { flex: 1, marginRight: space.sm },
  typeRow: { paddingHorizontal: layout.screenGutter, paddingTop: space.sm },
  content: {
    paddingHorizontal: layout.screenGutter,
    paddingTop: space.lg,
    gap: space.base,
  },
  promptRow: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  row: {
    minHeight: layout.minRowHeight,
    paddingVertical: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  rowCompact: { paddingVertical: space.sm, opacity: opacity.disabled },
  rowText: { flex: 1, gap: space.xs },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  actionChip: {
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.input,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  excludeButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    paddingHorizontal: layout.screenGutter,
    paddingTop: space.sm,
    gap: space.sm,
    backgroundColor: color.ground,
    borderTopWidth: 1,
    borderTopColor: color.line,
  },
});
