import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Divider } from '@/components/Card';
import { Sheet } from '@/components/Sheet';
import { Body, Caption, RowTitle } from '@/components/Type';
import { space } from '@/constants/theme';
import {
  buildSpeechDiagnosticReport,
  readSpeechDiagnostics,
  serializeSpeechDiagnosticReport,
  type SpeechDiagnosticEvent,
} from '@/media/speech/diagnostics';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function SpeechDiagnosticsSheet({ visible, onClose }: Props) {
  const [events, setEvents] = useState<SpeechDiagnosticEvent[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setEvents(readSpeechDiagnostics().slice().reverse());
    setCopied(false);
  }, [visible]);

  const copy = async () => {
    await Clipboard.setStringAsync(serializeSpeechDiagnosticReport());
    setCopied(true);
    AccessibilityInfo.announceForAccessibility('Redacted speech diagnostics copied.');
  };

  const report = buildSpeechDiagnosticReport();
  return (
    <Sheet visible={visible} onClose={onClose} title="Speech diagnostics">
      <Body muted>
        This local report contains modes, model readiness, provider/model names,
        app version, source revision, and failed boundaries. It never contains
        transcripts, audio, API keys, pantry data, or raw AI responses.
      </Body>
      <View style={styles.meta}>
        <Caption muted>App {report.appVersion}</Caption>
        <Caption muted>Source {report.sourceRevision}</Caption>
      </View>
      <Button
        label={copied ? 'Report copied' : 'Copy redacted report'}
        variant="secondary"
        onPress={() => void copy()}
        disabled={copied}
      />
      <View style={styles.events}>
        {events.length === 0 ? (
          <Caption muted>No speech events recorded yet.</Caption>
        ) : events.map((event, index) => (
          <View key={`${event.at}-${index}`} style={styles.event}>
            {index > 0 ? <Divider /> : null}
            <RowTitle>{event.boundary.replaceAll('_', ' ')} · {event.outcome}</RowTitle>
            <Caption muted>
              {[event.mode, event.parserPath, event.modelReadiness, event.provider, event.providerModel]
                .filter(Boolean)
                .join(' · ')}
            </Caption>
            {event.nativeErrorCode ? (
              <Caption muted>Boundary code: {event.nativeErrorCode}</Caption>
            ) : null}
            <Caption muted>{event.at}</Caption>
          </View>
        ))}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  meta: { gap: 2 },
  events: { gap: space.sm, marginTop: space.sm },
  event: { gap: space.xs },
});
