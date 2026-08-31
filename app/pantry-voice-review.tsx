import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CanonicalPickerSheet } from '@/components/match/CanonicalPickerSheet';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { Body, Caption, RowTitle, ScreenTitle, SectionLabel } from '@/components/Type';
import { color, layout, opacity, radius, space } from '@/constants/theme';
import {
  applyPantryIntakeBatch,
  invalidatePantryDependentSuggestions,
  undoPantryIntakeBatch,
} from '@/db/queries';
import { partitionProposals } from '@/logic/intakeProposals';
import {
  finalActionLabel,
  isSelected,
  pendingRowCount,
  reviewOpeningSummary,
  selectedProposals,
  successSummary,
} from '@/logic/intakeReview';
import { materialise } from '@/logic/materialisation';
import { usePantryStore } from '@/store/pantryStore';
import { useVoiceIntakeStore } from '@/store/voiceIntakeStore';
import type { PantryIntakeProposal } from '@/types';

/**
 * The mutation boundary. One screen, one button, one transaction.
 *
 * Everything that reaches here is a proposal — a thing the user said that Mise
 * has an opinion about. The screen's whole job is to make the opinion legible
 * before it becomes stock: what was heard, what Mise thinks it is, how sure it
 * is, and exactly how many rows the button will create.
 *
 * The two groups are the compact-review argument from the design. Eight clear
 * items collapse into one tap; the two Mise is unsure about get the attention
 * that would otherwise have been spread evenly across all ten.
 */
export default function PantryVoiceReviewScreen() {
  const router = useRouter();
  const toast = useToast();
  const locations = usePantryStore((state) => state.locations);
  const refreshPantry = usePantryStore((state) => state.refresh);

  const draft = useVoiceIntakeStore((store) => store.draft);
  const review = useVoiceIntakeStore((store) => store.review);
  const toggle = useVoiceIntakeStore((store) => store.toggle);
  const setLocation = useVoiceIntakeStore((store) => store.setLocation);
  const resolveIdentity = useVoiceIntakeStore((store) => store.resolveIdentity);
  const clear = useVoiceIntakeStore((store) => store.clear);

  const [saving, setSaving] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [namingId, setNamingId] = useState<string | null>(null);
  const announced = useRef(false);

  const groups = useMemo(
    () => partitionProposals(review?.proposals ?? []),
    [review?.proposals],
  );

  useEffect(() => {
    if (announced.current || !review) return;
    announced.current = true;
    AccessibilityInfo.announceForAccessibility(reviewOpeningSummary(review.proposals));
  }, [review]);

  if (!review || !draft) {
    return (
      <Screen>
        <View style={styles.header}>
          <ScreenTitle>Nothing to review</ScreenTitle>
          <Caption muted>That draft has gone. Start a new sweep when you are ready.</Caption>
        </View>
        <Button label="Back to Pantry" onPress={() => router.replace('/(tabs)/pantry')} />
      </Screen>
    );
  }

  const rows = pendingRowCount(review);
  const namedProposal = review.proposals.find((proposal) => proposal.id === namingId) ?? null;

  const confirm = async () => {
    if (saving || rows === 0) return;
    setSaving(true);
    try {
      const accepted = selectedProposals(review).map((proposal) => ({
        canonicalId: proposal.canonicalId!,
        locationId: proposal.locationId!,
        rows: materialise(proposal.quantity).rows,
        // A first inventory says nothing about when anything was bought. The
        // capture date is not a purchase date and must not become one.
        acquiredAtKnown: false,
        fullness: proposal.fullness,
        openedAt: null,
      }));

      const result = await applyPantryIntakeBatch(draft.id, 'voice', accepted);
      await invalidatePantryDependentSuggestions();
      await refreshPantry();

      const skipped =
        review.proposals.length - selectedProposals(review).length +
        draft.unusedPhrases.length;

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const summary = successSummary(result.createdItemIds.length, skipped);
      AccessibilityInfo.announceForAccessibility(summary);
      toast.show({
        kind: 'success',
        message: summary,
        actionLabel: 'Undo',
        onAction: () => {
          void (async () => {
            await undoPantryIntakeBatch(result.batchId);
            await invalidatePantryDependentSuggestions();
            await refreshPantry();
          })();
        },
      });

      clear();
      router.dismissAll();
      router.replace('/(tabs)/pantry');
    } catch (error) {
      toast.show({
        kind: 'recoverable-error',
        message:
          error instanceof Error
            ? error.message
            : 'Nothing was added. Check the items marked below and try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    clear();
    router.back();
  };

  const renderRow = (proposal: PantryIntakeProposal) => {
    const chosen = isSelected(review, proposal.id);
    const location = locations.find((entry) => entry.id === proposal.locationId);
    const rowsForItem = materialise(proposal.quantity).rows.length;

    return (
      <Card key={proposal.id} style={styles.itemCard}>
        <Pressable
          onPress={() => toggle(proposal.id)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: chosen }}
          accessibilityLabel={`${proposal.canonicalName ?? proposal.statedName}, ${quantityLine(proposal, rowsForItem)}`}
          style={({ pressed }) => [styles.itemRow, pressed && { opacity: opacity.pressed }]}
        >
          <View style={[styles.check, chosen && styles.checkOn]}>
            {chosen ? <Feather name="check" size={14} color={color.ground} /> : null}
          </View>
          <View style={styles.itemText}>
            <RowTitle>{proposal.canonicalName ?? proposal.statedName}</RowTitle>
            <Caption muted>{quantityLine(proposal, rowsForItem)}</Caption>
          </View>
        </Pressable>

        {proposal.sourceSpan ? (
          <Caption muted>You said: “{proposal.sourceSpan}”</Caption>
        ) : null}

        {proposal.notes.map((note) => (
          <Caption key={note.reason} muted={!note.blocking}>
            {note.message}
          </Caption>
        ))}

        <View style={styles.itemActions}>
          <Pressable
            onPress={() => setMovingId(proposal.id)}
            accessibilityRole="button"
            accessibilityLabel={`Change location for ${proposal.canonicalName ?? proposal.statedName}`}
            hitSlop={space.xs}
            style={({ pressed }) => [styles.action, pressed && { opacity: opacity.pressed }]}
          >
            <Feather name="map-pin" size={14} color={color.muted} />
            <Caption muted>{location?.name ?? 'Choose a place'}</Caption>
          </Pressable>
          <Pressable
            onPress={() => setNamingId(proposal.id)}
            accessibilityRole="button"
            accessibilityLabel={`Choose the ingredient for ${proposal.statedName}`}
            hitSlop={space.xs}
            style={({ pressed }) => [styles.action, pressed && { opacity: opacity.pressed }]}
          >
            <Feather name="edit-2" size={14} color={color.muted} />
            <Caption muted>
              {proposal.canonicalId ? 'Change ingredient' : 'Pick ingredient'}
            </Caption>
          </Pressable>
        </View>
      </Card>
    );
  };

  return (
    <Screen
      scroll
      footer={
        <View style={styles.footer}>
          <Button
            label={finalActionLabel(review, locations)}
            onPress={() => void confirm()}
            disabled={rows === 0}
            loading={saving}
            accessibilityHint="This is the only step that changes your pantry."
          />
          <Button label="Discard this draft" variant="ghost" onPress={discard} />
        </View>
      }
    >
      <View style={styles.header}>
        <ScreenTitle>Review what Mise heard</ScreenTitle>
        <Caption muted>{reviewOpeningSummary(review.proposals)}</Caption>
      </View>

      {groups.clear.length > 0 ? (
        <View style={styles.group}>
          <SectionLabel muted>Clear</SectionLabel>
          {groups.clear.map(renderRow)}
        </View>
      ) : null}

      {groups.needsLook.length > 0 ? (
        <View style={styles.group}>
          <SectionLabel muted>Needs a look</SectionLabel>
          {groups.needsLook.map(renderRow)}
        </View>
      ) : null}

      {draft.unusedPhrases.length > 0 ? (
        <Card style={styles.unusedCard}>
          <RowTitle>Not used</RowTitle>
          <Caption muted>
            Mise found no food in these. They are shown so nothing disappears
            without you seeing it.
          </Caption>
          {draft.unusedPhrases.map((phrase, index) => (
            <Caption key={`${phrase}-${index}`} muted>
              · “{phrase}”
            </Caption>
          ))}
        </Card>
      ) : null}

      <Body muted>
        Dates are unknown for everything here, so Mise will not guess when it
        goes off. Open an item later to tell it when you got it.
      </Body>

      <Sheet
        visible={movingId !== null}
        onClose={() => setMovingId(null)}
        title="Where does this go?"
      >
        {locations.map((location) => (
          <Pressable
            key={location.id}
            onPress={() => {
              if (movingId) setLocation(movingId, location.id);
              setMovingId(null);
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.option, pressed && { opacity: opacity.pressed }]}
          >
            <RowTitle>{location.name}</RowTitle>
          </Pressable>
        ))}
      </Sheet>

      <CanonicalPickerSheet
        visible={namingId !== null}
        title={`What is “${namedProposal?.statedName ?? ''}”?`}
        suggestedIds={(namedProposal?.alternatives ?? []).map((option) => option.canonicalId)}
        onClose={() => setNamingId(null)}
        onPick={(item) => {
          if (namingId) {
            resolveIdentity(namingId, {
              canonicalId: item.id,
              displayName: item.displayName,
              confidence: 1,
            });
          }
          setNamingId(null);
        }}
      />
    </Screen>
  );
}

/**
 * The one line under each name.
 *
 * Says "quantity unknown" out loud rather than leaving a blank, because a
 * blank reads as "none" and the difference between "no butter" and "butter,
 * amount unknown" is the whole point of keeping unknowns nullable.
 */
function quantityLine(proposal: PantryIntakeProposal, rows: number): string {
  const { quantity } = proposal;
  const parts: string[] = [];

  if (quantity.containerCount != null) {
    parts.push(rows === 1 ? '1 container' : `${rows} containers`);
  }
  if (quantity.amount != null) {
    const amount = quantity.approximate
      ? `about ${formatAmount(quantity.amount)}`
      : formatAmount(quantity.amount);
    parts.push(quantity.unit ? `${amount} ${quantity.unit}` : amount);
  }
  if (parts.length === 0) parts.push('quantity unknown');

  return parts.join(' · ');
}

function formatAmount(amount: number): string {
  if (amount === 0.5) return 'half';
  if (amount === 0.25) return 'a quarter';
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2).replace(/0$/, '');
}

const styles = StyleSheet.create({
  header: { marginTop: space.base, marginBottom: space.lg, gap: space.xs },
  group: { gap: space.sm, marginBottom: space.lg },
  itemCard: { gap: space.xs },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: layout.minTouchTarget,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: radius.input,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: color.ink, borderColor: color.ink },
  itemText: { flex: 1, gap: 2 },
  itemActions: { flexDirection: 'row', gap: space.base, flexWrap: 'wrap' },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: layout.minTouchTarget,
  },
  unusedCard: { gap: space.xs, marginBottom: space.lg },
  option: {
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
    paddingVertical: space.sm,
  },
  footer: { gap: space.sm },
});
