import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Divider } from '@/components/Card';
import { Sheet } from '@/components/Sheet';
import { Body, Caption, RowTitle } from '@/components/Type';
import { color, radius, space } from '@/constants/theme';
import {
  SPEECH_MODELS,
  cancelSpeechModelDownload,
  downloadSpeechModel,
  pauseSpeechModelDownload,
  readSpeechPreferences,
  reconcileSpeechModels,
  removeSpeechModel,
  repairSpeechModel,
  resumeSpeechModelDownload,
  updateSpeechPreferences,
  type DownloadProgress,
  type ModelInstallState,
  type SpeechModel,
} from '@/media/speech';

interface Props {
  visible: boolean;
  onClose: () => void;
  onChange: () => void;
}

type RowState = { status: 'checking' } | ModelInstallState;

export function SpeechModelsSheet({ visible, onClose, onChange }: Props) {
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [preferredModelId, setPreferredModelId] = useState<string | null>(
    () => readSpeechPreferences().preferredModelId,
  );

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setPreferredModelId(readSpeechPreferences().preferredModelId);
    setRows(Object.fromEntries(SPEECH_MODELS.map((model) => [model.id, { status: 'checking' }])));
    void reconcileSpeechModels().then((states) => {
      if (!cancelled) setRows(states);
    });
    return () => { cancelled = true; };
  }, [visible]);

  const setRow = (modelId: string, state: ModelInstallState) => {
    setRows((current) => ({ ...current, [modelId]: state }));
  };

  const onProgress = (modelId: string) => (progress: DownloadProgress) => {
    setRow(modelId,
      progress.phase === 'validating'
        ? { status: 'validating', path: '' }
        : progress.phase === 'extracting'
          ? { status: 'extracting', percent: progress.percent }
          : { status: 'downloading', phase: 'downloading', percent: progress.percent });
  };

  const run = async (
    model: SpeechModel,
    operation: 'download' | 'resume' | 'repair',
  ) => {
    setRow(model.id, { status: 'downloading', phase: 'downloading', percent: 0 });
    AccessibilityInfo.announceForAccessibility(`${operation === 'resume' ? 'Resuming' : 'Downloading'} ${model.name}.`);
    const progress = onProgress(model.id);
    const result = operation === 'resume'
      ? await resumeSpeechModelDownload(model.id, progress)
      : operation === 'repair'
        ? await repairSpeechModel(model.id, progress)
        : await downloadSpeechModel(model.id, progress);
    setRow(model.id, result);
    onChange();
    if (result.status === 'ready') {
      AccessibilityInfo.announceForAccessibility(`${model.name} is ready.`);
    } else if (result.status === 'incompatible') {
      AccessibilityInfo.announceForAccessibility(`${model.name} is not supported on this device.`);
    }
  };

  const pause = async (model: SpeechModel) => {
    setRow(model.id, await pauseSpeechModelDownload(model.id));
    AccessibilityInfo.announceForAccessibility(`${model.name} download paused.`);
  };

  const cancel = async (model: SpeechModel) => {
    await cancelSpeechModelDownload(model.id);
    setRow(model.id, { status: 'absent' });
    onChange();
  };

  const remove = async (model: SpeechModel) => {
    await removeSpeechModel(model.id);
    setRow(model.id, { status: 'absent' });
    onChange();
  };

  const choose = (model: SpeechModel) => {
    setPreferredModelId(model.id);
    updateSpeechPreferences({ preferredModelId: model.id });
    AccessibilityInfo.announceForAccessibility(`${model.name} selected.`);
    onChange();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Speech models">
      <Body muted>
        Downloads continue in Android with a visible notification. Ready means
        the files, model detector, and speech engine all passed locally.
      </Body>
      <View style={styles.list}>
        {SPEECH_MODELS.map((model, index) => {
          const row = rows[model.id] ?? { status: 'checking' };
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
                  <Caption accessibilityLiveRegion="polite" style={statusIsFailure(row) ? styles.error : undefined}>
                    {modelStateCopy(row)}
                  </Caption>
                </View>
                <View style={styles.actions}>
                  {row.status === 'ready' ? (
                    <Button label="Delete" variant="destructive" block={false} onPress={() => void remove(model)} />
                  ) : row.status === 'downloading' ? (
                    <Button label="Pause" variant="secondary" block={false} onPress={() => void pause(model)} />
                  ) : row.status === 'paused' ? (
                    <>
                      <Button label="Resume" variant="secondary" block={false} onPress={() => void run(model, 'resume')} />
                      <Button label="Cancel" variant="ghost" block={false} onPress={() => void cancel(model)} />
                    </>
                  ) : row.status === 'extracting' ? (
                    <Button label="Cancel" variant="ghost" block={false} onPress={() => void cancel(model)} />
                  ) : row.status === 'repair' || row.status === 'failed' ? (
                    <>
                      <Button label="Repair" variant="secondary" block={false} onPress={() => void run(model, 'repair')} />
                      <Button label="Delete" variant="ghost" block={false} onPress={() => void remove(model)} />
                    </>
                  ) : row.status === 'incompatible' ? (
                    <Button label="Delete" variant="destructive" block={false} onPress={() => void remove(model)} />
                  ) : row.status === 'absent' ? (
                    <Button label="Download" variant="secondary" block={false} onPress={() => void run(model, 'download')} />
                  ) : null}
                </View>
              </View>

              {'percent' in row ? (
                <View
                  style={styles.progressTrack}
                  accessibilityRole="progressbar"
                  accessibilityValue={{ now: row.percent, min: 0, max: 100 }}
                >
                  <View style={[styles.progressFill, { width: `${row.percent}%` }]} />
                </View>
              ) : null}

              <Button
                label={preferredModelId === model.id ? 'Selected model' : 'Use this model'}
                variant="ghost"
                block={false}
                disabled={preferredModelId === model.id}
                onPress={() => choose(model)}
              />
            </View>
          );
        })}
      </View>
    </Sheet>
  );
}

function statusIsFailure(state: RowState): boolean {
  return ['repair', 'incompatible', 'failed'].includes(state.status);
}

function modelStateCopy(state: RowState): string {
  switch (state.status) {
    case 'checking': return 'Checking local files…';
    case 'absent': return 'Not downloaded';
    case 'downloading': return `Downloading · ${state.percent}%`;
    case 'paused': return `Paused · ${state.percent}%`;
    case 'extracting': return `Extracting · ${state.percent}%`;
    case 'validating': return 'Validating model runtime…';
    case 'ready': return 'Ready';
    case 'repair': return `Repair needed · ${state.message}`;
    case 'incompatible': return `Not supported on this device · ${state.message}`;
    case 'failed': return `Download failed · ${state.message}`;
  }
}

const styles = StyleSheet.create({
  list: { marginTop: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.md,
    paddingVertical: space.md,
  },
  rowText: { flex: 1, gap: 2 },
  actions: { gap: space.xs, alignItems: 'flex-end' },
  progressTrack: {
    height: 6,
    borderRadius: radius.full,
    backgroundColor: color.line,
    overflow: 'hidden',
    marginBottom: space.sm,
  },
  progressFill: { height: '100%', backgroundColor: color.ink },
  error: { color: color.paprika },
});
