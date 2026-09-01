import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Divider } from '@/components/Card';
import { Sheet } from '@/components/Sheet';
import { Body, Caption, RowTitle } from '@/components/Type';
import { color, radius, space } from '@/constants/theme';
import {
  SPEECH_MODELS,
  downloadSpeechModel,
  isModelInstalled,
  refreshInstalledModels,
  removeSpeechModel,
  type DownloadProgress,
  type SpeechModel,
} from '@/media/speech';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Bumps the caller's install count whenever a model is added or removed. */
  onChange: () => void;
}

type RowState =
  | { kind: 'checking' }
  | { kind: 'absent' }
  | { kind: 'installed' }
  | { kind: 'downloading'; progress: DownloadProgress }
  | { kind: 'error'; message: string };

/**
 * Every registered speech model (`SPEECH_MODELS`), with its install state and
 * a Download or Delete action — the surface the voice intake screen's inline
 * offer never covered: downloading ahead of time, for a language not being
 * used this minute, or simply because there was nowhere else in the app to
 * see what had already been fetched.
 */
export function SpeechModelsSheet({ visible, onClose, onChange }: Props) {
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const aborts = useRef<Record<string, AbortController>>({});

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setRows(Object.fromEntries(SPEECH_MODELS.map((model) => [model.id, { kind: 'checking' }])));
    void (async () => {
      const entries = await Promise.all(
        SPEECH_MODELS.map(async (model) => {
          const installed = await isModelInstalled(model.id);
          return [model.id, { kind: installed ? 'installed' : 'absent' } as RowState] as const;
        }),
      );
      if (!cancelled) setRows(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const download = async (model: SpeechModel) => {
    const controller = new AbortController();
    aborts.current[model.id] = controller;
    setRows((prev) => ({
      ...prev,
      [model.id]: { kind: 'downloading', progress: { percent: 0, phase: 'downloading' } },
    }));
    AccessibilityInfo.announceForAccessibility(`Downloading ${model.name}, ${model.sizeMb} MB.`);
    try {
      const result = await downloadSpeechModel(
        model.id,
        (progress) => setRows((prev) => ({ ...prev, [model.id]: { kind: 'downloading', progress } })),
        controller.signal,
      );
      if (result.status === 'installed') {
        await refreshInstalledModels();
        onChange();
        setRows((prev) => ({ ...prev, [model.id]: { kind: 'installed' } }));
        AccessibilityInfo.announceForAccessibility(`${model.name} is ready.`);
      } else if (result.status === 'failed') {
        setRows((prev) => ({ ...prev, [model.id]: { kind: 'error', message: result.message } }));
      } else {
        setRows((prev) => ({ ...prev, [model.id]: { kind: 'absent' } }));
      }
    } finally {
      delete aborts.current[model.id];
    }
  };

  const cancelDownload = (modelId: string) => {
    aborts.current[modelId]?.abort();
    delete aborts.current[modelId];
    setRows((prev) => ({ ...prev, [modelId]: { kind: 'absent' } }));
  };

  const remove = async (model: SpeechModel) => {
    await removeSpeechModel(model.id);
    await refreshInstalledModels();
    onChange();
    setRows((prev) => ({ ...prev, [model.id]: { kind: 'absent' } }));
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Speech models">
      <Body muted>
        Downloaded once, used entirely on this device. Nothing here is sent
        anywhere, before or after the download.
      </Body>
      <View style={styles.list}>
        {SPEECH_MODELS.map((model, index) => {
          const row = rows[model.id] ?? { kind: 'checking' };
          return (
            <View key={model.id}>
              {index > 0 ? <Divider /> : null}
              <View style={styles.row}>
                <View style={styles.rowText}>
                  <RowTitle>{model.name}</RowTitle>
                  <Caption muted>
                    {model.publisher} · {model.licence} · {model.sizeMb} MB
                  </Caption>
                  <Caption muted>{model.summary}</Caption>
                </View>

                {row.kind === 'checking' ? null : row.kind === 'installed' ? (
                  <Button
                    label="Delete"
                    variant="destructive"
                    block={false}
                    onPress={() => void remove(model)}
                  />
                ) : row.kind === 'downloading' ? (
                  <Button
                    label={`${row.progress.percent}%`}
                    variant="ghost"
                    block={false}
                    onPress={() => cancelDownload(model.id)}
                    accessibilityHint="Stops the download."
                  />
                ) : (
                  <Button
                    label="Download"
                    variant="secondary"
                    block={false}
                    onPress={() => void download(model)}
                    accessibilityHint={`Downloads ${model.name}, ${model.sizeMb} MB, from ${model.publisher}.`}
                  />
                )}
              </View>

              {row.kind === 'downloading' ? (
                <View
                  style={styles.progressTrack}
                  accessibilityRole="progressbar"
                  accessibilityValue={{ now: row.progress.percent, min: 0, max: 100 }}
                >
                  <View style={[styles.progressFill, { width: `${row.progress.percent}%` }]} />
                </View>
              ) : null}
              {row.kind === 'error' ? <Caption>{row.message}</Caption> : null}
            </View>
          );
        })}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: { marginTop: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingVertical: space.md,
  },
  rowText: { flex: 1, gap: 2 },
  progressTrack: {
    height: 6,
    borderRadius: radius.full,
    backgroundColor: color.line,
    overflow: 'hidden',
    marginBottom: space.sm,
  },
  progressFill: { height: '100%', backgroundColor: color.ink },
});
