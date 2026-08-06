import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Button } from '@/components/Button';
import { Card, Divider } from '@/components/Card';
import { Segmented } from '@/components/Choice';
import { EmptyState } from '@/components/EmptyState';
import { Field } from '@/components/Field';
import { Caption, RowTitle } from '@/components/Type';
import { color, layout, opacity, space } from '@/constants/theme';
import {
  addDietaryRule,
  addDietaryRuleAsText,
  confirmDietaryRule,
  deleteDietaryRule,
  listDietaryRules,
  ruleCoverage,
  updateDietaryRuleKind,
} from '@/logic/dietaryService';
import { getCanonicalById } from '@/db/queries';
import { DIETARY_RULE_KINDS, type DietaryRule, type DietaryRuleKind } from '@/types';

const KIND_LABEL: Record<DietaryRuleKind, string> = {
  allergen: 'Allergen',
  restriction: 'Restriction',
  dislike: 'Dislike',
};

const KIND_OPTIONS = [
  { value: 'allergen' as DietaryRuleKind, label: 'Allergy' },
  { value: 'restriction' as DietaryRuleKind, label: 'Restriction' },
  { value: 'dislike' as DietaryRuleKind, label: 'Dislike' },
];

interface PendingConfirmation {
  raw: string;
  kind: DietaryRuleKind;
  canonicalId: string;
  displayName: string;
}

/**
 * Add, list, and remove dietary rules. Shared between onboarding (task 7.1)
 * and Settings (task 7.2) — the same list, the same add flow, so a rule
 * recorded during onboarding shows up in Settings with no special casing.
 *
 * The app filters generated suggestions and cannot verify food (task 8.2) —
 * stated once here, since this is where an allergen is first recorded.
 */
export function DietaryRuleList() {
  const [rules, setRules] = useState<DietaryRule[]>([]);
  const [coverage, setCoverage] = useState<Record<string, string[]>>({});
  const [kind, setKind] = useState<DietaryRuleKind>('allergen');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingConfirmation | null>(null);

  const refresh = useCallback(() => {
    void listDietaryRules().then(async (list) => {
      setRules(list);
      const entries = await Promise.all(
        list.map(async (rule) => [rule.id, await ruleCoverage(rule)] as const),
      );
      setCoverage(Object.fromEntries(entries));
    });
  }, []);

  useEffect(refresh, [refresh]);

  const onAdd = () => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    void addDietaryRule(trimmed, kind)
      .then(async (result) => {
        if (result.status === 'needs_confirmation') {
          const canonical = await getCanonicalById(result.canonicalId);
          setPending({
            raw: result.raw,
            kind,
            canonicalId: result.canonicalId,
            displayName: canonical?.displayName ?? result.canonicalId,
          });
          return;
        }
        setText('');
        refresh();
      })
      .finally(() => setBusy(false));
  };

  const onConfirmPending = () => {
    if (!pending) return;
    setBusy(true);
    void confirmDietaryRule(pending.raw, pending.kind, pending.canonicalId)
      .then(() => {
        setPending(null);
        setText('');
        refresh();
      })
      .finally(() => setBusy(false));
  };

  const onRejectPending = () => {
    if (!pending) return;
    setBusy(true);
    void addDietaryRuleAsText(pending.raw, pending.kind)
      .then(() => {
        setPending(null);
        setText('');
        refresh();
      })
      .finally(() => setBusy(false));
  };

  const onRemove = (rule: DietaryRule) => {
    Alert.alert(`Remove "${rule.text}"?`, undefined, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => void deleteDietaryRule(rule.id).then(refresh),
      },
    ]);
  };

  const onChangeKind = (rule: DietaryRule) => {
    Alert.alert(
      `Change "${rule.text}" to…`,
      undefined,
      [
        ...DIETARY_RULE_KINDS.filter((k) => k !== rule.kind).map((k) => ({
          text: KIND_LABEL[k],
          onPress: () => void updateDietaryRuleKind(rule.id, k).then(refresh),
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
  };

  return (
    <View style={styles.root}>
      <View style={styles.form}>
        <Segmented options={KIND_OPTIONS} value={kind} onChange={setKind} />
        <Field
          value={text}
          onChangeText={setText}
          placeholder="e.g. peanuts, no pork, mushrooms"
          onSubmitEditing={onAdd}
        />
        <Button label="Add" onPress={onAdd} disabled={!text.trim()} loading={busy} block={false} />
        {kind === 'allergen' ? (
          <Caption muted>
            Mise filters this out of suggestions. It cannot verify what a
            recipe actually contains — read the method before you cook.
          </Caption>
        ) : null}
      </View>

      {pending ? (
        <Card>
          <RowTitle>Did you mean {pending.displayName}?</RowTitle>
          <Caption muted style={styles.pendingCaption}>
            From: {pending.raw}
          </Caption>
          <View style={styles.pendingActions}>
            <Button label="Yes, that's it" onPress={onConfirmPending} loading={busy} />
            <Button
              label="No, keep my own words"
              variant="ghost"
              onPress={onRejectPending}
              disabled={busy}
            />
          </View>
        </Card>
      ) : null}

      {rules.length === 0 ? (
        <EmptyState
          title="Nothing recorded"
          detail="Add an allergy, a restriction, or something you'd rather not see."
        />
      ) : (
        <Card padded={false}>
          {rules.map((rule, position) => (
            <View key={rule.id}>
              {position > 0 ? <Divider /> : null}
              <RuleRow
                rule={rule}
                derivatives={coverage[rule.id] ?? []}
                onRemove={() => onRemove(rule)}
                onChangeKind={() => onChangeKind(rule)}
              />
            </View>
          ))}
        </Card>
      )}
    </View>
  );
}

function RuleRow({
  rule,
  derivatives,
  onRemove,
  onChangeKind,
}: {
  rule: DietaryRule;
  derivatives: string[];
  onRemove: () => void;
  onChangeKind: () => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        <View style={styles.rowHeadline}>
          <RowTitle>{rule.text}</RowTitle>
          <Pressable
            onPress={onChangeKind}
            accessibilityRole="button"
            accessibilityLabel={`Change kind for ${rule.text}, currently ${KIND_LABEL[rule.kind]}`}
            hitSlop={space.xs}
          >
            <Caption muted style={styles.kindTag}>
              {KIND_LABEL[rule.kind]}
            </Caption>
          </Pressable>
        </View>
        {rule.canonicalId === null ? (
          <Caption muted>Matching by name only — not found in the catalogue.</Caption>
        ) : derivatives.length > 0 ? (
          <Caption muted>Also covers: {derivatives.join(', ')}.</Caption>
        ) : null}
      </View>
      <Pressable
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${rule.text}`}
        hitSlop={space.sm}
        style={({ pressed }) => [styles.remove, pressed && { opacity: opacity.pressed }]}
      >
        <Feather name="x" size={18} color={color.muted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.lg },
  form: { gap: space.sm },
  pendingCaption: { marginTop: space.xs },
  pendingActions: { marginTop: space.sm, gap: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: space.md,
  },
  rowMain: {
    flex: 1,
    minHeight: layout.minRowHeight,
    paddingHorizontal: layout.cardPadding,
    paddingVertical: space.md,
    justifyContent: 'center',
    gap: space.xs,
  },
  rowHeadline: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  kindTag: { textDecorationLine: 'underline' },
  remove: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
