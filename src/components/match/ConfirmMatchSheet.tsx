import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { CanonicalPickerSheet } from '@/components/match/CanonicalPickerSheet';
import { Sheet } from '@/components/Sheet';
import { Body, Caption, ScreenTitle } from '@/components/Type';
import { space } from '@/constants/theme';
import { confirmMatch, rejectMatch } from '@/logic/resolution';
import type { CanonicalItem, ReferenceSource } from '@/types';

/** One needs-confirmation outcome, joined with its canonical display name. */
export interface PendingConfirmation {
  raw: string;
  canonicalId: string;
  /** The canonical ingredient's own name — what the user sees. */
  displayName: string;
  confidence: number;
  source: ReferenceSource;
}

interface Props {
  visible: boolean;
  matches: readonly PendingConfirmation[];
  onClose: () => void;
  /** Called once every match has been confirmed, corrected, or sent away. */
  onDone?: () => void;
}

/**
 * The confirm-a-match surface: one-tap confirmation for confirm-band
 * resolutions. Shows the canonical ingredient's display name as the match;
 * the raw observed text appears only as provenance, never as the name.
 */
export function ConfirmMatchSheet({ visible, matches, onClose, onDone }: Props) {
  const [index, setIndex] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) setIndex(0);
  }, [visible, matches]);

  const current = matches[index];

  const advance = () => {
    if (index + 1 >= matches.length) {
      onDone?.();
      onClose();
    } else {
      setIndex(index + 1);
    }
  };

  const run = (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    void work()
      .catch(() => {})
      .finally(() => {
        setBusy(false);
        advance();
      });
  };

  const onConfirm = () => {
    if (!current) return;
    run(() => confirmMatch(current.raw, current.canonicalId));
  };

  const onReject = () => {
    if (!current) return;
    run(() => rejectMatch(current.raw, current.canonicalId, current.source));
  };

  const onPick = (item: CanonicalItem) => {
    setPickerOpen(false);
    if (!current) return;
    run(() => confirmMatch(current.raw, item.id));
  };

  return (
    <Sheet
      visible={visible && current !== undefined}
      onClose={onClose}
      title="Check a match"
      footer={
        <View style={styles.footer}>
          <Button label="Yes, that's it" onPress={onConfirm} loading={busy} />
          <Button
            label="Pick something else"
            variant="secondary"
            onPress={() => setPickerOpen(true)}
            disabled={busy}
          />
          <Button
            label="Not sure — review later"
            variant="ghost"
            onPress={onReject}
            disabled={busy}
          />
        </View>
      }
    >
      {current ? (
        <View style={styles.body}>
          <Caption muted>
            {matches.length > 1 ? `${index + 1} of ${matches.length} · ` : ''}
            From: {current.raw}
          </Caption>
          <ScreenTitle>{current.displayName}</ScreenTitle>
          <Body muted>
            Matched with {Math.round(current.confidence * 100)}% confidence.
            Confirming teaches the app this name for next time.
          </Body>
        </View>
      ) : null}
      <CanonicalPickerSheet
        visible={pickerOpen}
        title="Which ingredient is it?"
        suggestedIds={current ? [current.canonicalId] : []}
        onPick={onPick}
        onClose={() => setPickerOpen(false)}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.sm },
  footer: { gap: space.sm },
});
