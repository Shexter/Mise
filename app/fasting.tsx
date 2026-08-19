import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card, Divider } from '@/components/Card';
import { Field } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { Body, Caption, Hero, RowTitle, ScreenTitle } from '@/components/Type';
import { color, layout, space } from '@/constants/theme';
import { useFastingStore } from '@/store/fastingStore';
import type { Fast } from '@/types';

export default function FastingScreen() {
  const router = useRouter();
  const status = useFastingStore((state) => state.status);
  const activeFast = useFastingStore((state) => state.activeFast);
  const history = useFastingStore((state) => state.history);
  const error = useFastingStore((state) => state.error);
  const refresh = useFastingStore((state) => state.refresh);
  const start = useFastingStore((state) => state.start);
  const end = useFastingStore((state) => state.end);
  const [targetHours, setTargetHours] = useState('');
  const [targetError, setTargetError] = useState<string | undefined>();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!activeFast) return undefined;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [activeFast]);

  const startCurrentFast = () => {
    const trimmed = targetHours.trim();
    if (trimmed === '') {
      setTargetError(undefined);
      void start(null);
      return;
    }
    const hours = Number(trimmed);
    if (!Number.isFinite(hours) || hours <= 0) {
      setTargetError('Enter a target greater than zero, or leave this blank.');
      return;
    }
    const targetMinutes = Math.round(hours * 60);
    if (targetMinutes < 1) {
      setTargetError('Enter at least one minute, or leave this blank.');
      return;
    }
    setTargetError(undefined);
    void start(targetMinutes);
  };

  const confirmEnd = () => {
    Alert.alert('End this fast?', 'Its actual duration will be saved to your history.', [
      { text: 'Keep fasting', style: 'cancel' },
      { text: 'End fast', onPress: () => void end() },
    ]);
  };

  const elapsedMs = activeFast ? Math.max(0, now - Date.parse(activeFast.startedAt)) : 0;
  const elapsed = formatDuration(elapsedMs);
  const busy = status === 'loading' || status === 'saving';

  return (
    <Screen
      scroll
      footer={<Button label="Back to Settings" variant="secondary" onPress={() => router.back()} />}
      contentStyle={styles.content}
    >
      <View style={styles.header}>
        <ScreenTitle>Fasting</ScreenTitle>
        <Body muted>A private timer stored only on this device.</Body>
      </View>

      {activeFast ? (
        <Card>
          <View
            accessible
            accessibilityRole="timer"
            accessibilityLabel={`Active fast. Elapsed time ${spokenDuration(elapsedMs)}.`}
            style={styles.timer}
          >
            <Caption muted>Elapsed</Caption>
            <Hero>{elapsed}</Hero>
            <Body muted>{targetLine(activeFast, elapsedMs)}</Body>
          </View>
          <Button
            label="End fast"
            variant="destructive"
            loading={busy}
            onPress={confirmEnd}
            accessibilityHint="Saves this fast to history with its current elapsed time."
          />
        </Card>
      ) : (
        <Card title="Start a fast">
          <View style={styles.startForm}>
            <Field
              label="Target duration"
              value={targetHours}
              onChangeText={setTargetHours}
              placeholder="Optional"
              hint="Leave blank for an open-ended fast."
              error={targetError}
              suffix="hours"
              keyboardType="decimal-pad"
              numeric
            />
            <Button
              label="Start fast"
              loading={busy}
              onPress={startCurrentFast}
              accessibilityHint="Starts a fasting timer now."
            />
          </View>
        </Card>
      )}

      {error ? <Caption style={styles.error}>{error}</Caption> : null}

      <View style={styles.history}>
        <RowTitle>History</RowTitle>
        {history.length === 0 ? (
          <Card>
            <Body>No completed fasts</Body>
            <Caption muted>A fast appears here after you end it.</Caption>
          </Card>
        ) : (
          <Card padded={false}>
            {history.map((fast, index) => (
              <View key={fast.id}>
                {index > 0 ? <Divider /> : null}
                <HistoryRow fast={fast} />
              </View>
            ))}
          </Card>
        )}
      </View>
    </Screen>
  );
}

function HistoryRow({ fast }: { fast: Fast }) {
  const endedAt = fast.endedAt ?? fast.startedAt;
  const durationMs = Math.max(0, Date.parse(endedAt) - Date.parse(fast.startedAt));
  return (
    <View
      accessible
      accessibilityLabel={`${spokenDuration(durationMs)} fast. ${formatDateRange(fast.startedAt, endedAt)}.`}
      style={styles.historyRow}
    >
      <View style={styles.historyText}>
        <RowTitle>{formatDate(fast.startedAt)}</RowTitle>
        <Caption muted>{formatDateRange(fast.startedAt, endedAt)}</Caption>
      </View>
      <RowTitle numeric>{formatShortDuration(durationMs)}</RowTitle>
    </View>
  );
}

function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1_000);
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainder = seconds % 60;
  return [hours, minutes, remainder].map((part) => String(part).padStart(2, '0')).join(':');
}

function formatShortDuration(milliseconds: number): string {
  const minutes = Math.floor(milliseconds / 60_000);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours > 0 ? `${hours}h ${remainder}m` : `${remainder}m`;
}

function spokenDuration(milliseconds: number): string {
  const minutes = Math.floor(milliseconds / 60_000);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours} hours, ${remainder} minutes`;
}

function targetLine(fast: Fast, elapsedMs: number): string {
  if (fast.targetDurationMinutes === null) return 'Open-ended fast';
  const remainingMinutes = Math.max(0, fast.targetDurationMinutes - Math.floor(elapsedMs / 60_000));
  return remainingMinutes === 0
    ? 'Target reached'
    : `${formatShortDuration(remainingMinutes * 60_000)} until target`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  }).format(new Date(value));
}

function formatDateRange(start: string, end: string): string {
  const formatter = new Intl.DateTimeFormat(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
  return `${formatter.format(new Date(start))} – ${formatter.format(new Date(end))}`;
}

const styles = StyleSheet.create({
  content: { gap: space.lg },
  header: { marginTop: space.base, gap: space.xs },
  timer: { alignItems: 'center', gap: space.sm, marginBottom: space.lg },
  startForm: { gap: space.base },
  error: { color: color.paprika },
  history: { gap: space.sm },
  historyRow: {
    minHeight: layout.minRowHeight,
    padding: space.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  historyText: { flex: 1, gap: space.xs },
});
