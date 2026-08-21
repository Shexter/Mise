import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import {
  clearApiKey,
  getConfiguredProvider,
  getGeminiModelPreference,
  GEMINI_MODELS,
  maskedApiKey,
  setGeminiModelPreference,
  type GeminiModel,
} from '@/api/keyStore';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { ApiKeySheet } from '@/components/settings/ApiKeySheet';
import { MacroSplitSheet } from '@/components/settings/MacroSplitSheet';
import { ModelSheet } from '@/components/settings/ModelSheet';
import { ProfileSheet } from '@/components/settings/ProfileSheet';
import { SettingsRow, SettingsToggleRow } from '@/components/settings/Row';
import { ThemeSheet } from '@/components/settings/ThemeSheet';
import { useToast } from '@/components/Toast';
import { Caption, ScreenTitle } from '@/components/Type';
import { space, themeId } from '@/constants/theme';
import { themeOptions } from '@/constants/themePalettes';
import { activityLabel } from '@/constants/activityLevels';
import { resetDatabase } from '@/db';
import { useDbReadiness } from '@/db/readiness';
import { populateDemoData } from '@/db/demoData';
import {
  getBodyMeasurements,
  getReceiptOcrPreference,
  listPendingCaptures,
  removePendingCapture,
  saveBodyMeasurement,
  saveReceiptOcrPreference,
} from '@/db/queries';
import { exportData } from '@/logic/export';
import { isMeasurementStale, resolveTarget } from '@/logic/bodyComposition';
import { localDateString } from '@/logic/dates';
import { retryPendingCapture } from '@/logic/pendingCaptureService';
import { formatHeight, formatWeight } from '@/logic/units';
import { goalSummaryLabel } from '@/logic/weightGoalPacing';
import { deleteAllPhotos } from '@/media/photos';
import { useDayStore } from '@/store/dayStore';
import { useOnboardingStore } from '@/store/onboardingStore';
import { usePantryCaptureStore } from '@/store/pantryCaptureStore';
import { useProfileStore } from '@/store/profileStore';
import { TARGET_SOURCES, type BodyMeasurement, type Profile, type Units } from '@/types';

type ProfileField = 'formula' | 'sex' | 'age' | 'height' | 'weight' | 'activity' | 'goal' | 'fibre';

export default function SettingsScreen() {
  const router = useRouter();
  const toast = useToast();
  const profile = useProfileStore((state) => state.profile);
  const updateProfile = useProfileStore((state) => state.update);
  const refreshDay = useDayStore((state) => state.refresh);
  const setCaptureReview = usePantryCaptureStore((state) => state.set);
  const dbReadiness = useDbReadiness();

  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [profileField, setProfileField] = useState<ProfileField | null>(null);
  const [splitOpen, setSplitOpen] = useState(false);
  const [keyOpen, setKeyOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [ocrCloudText, setOcrCloudText] = useState(false);
  const [configuredProvider, setConfiguredProvider] = useState<string | null>(null);
  const [geminiModel, setGeminiModel] = useState<GeminiModel>('gemini-2.5-flash-lite');

  const loadKey = useCallback(() => {
    void maskedApiKey().then(setMaskedKey);
    void getConfiguredProvider().then(setConfiguredProvider);
    void getGeminiModelPreference().then(setGeminiModel);
  }, []);

  const releasePendingCaptures = async () => {
    loadKey();
    const capture = (await listPendingCaptures()).find((item) => item.status === 'pending');
    if (!capture) return;
    const result = await retryPendingCapture(capture.id);
    if (!result) return;
    if (result.kind === 'items') {
      setCaptureReview(result.capture.imageUri, result.capture.createdAt.slice(0, 10), result.proposals);
      router.push('/pantry-capture-review');
      await removePendingCapture(result.capture.id);
      return;
    }
    if (result.kind === 'receipt') {
      router.push({ pathname: '/receipt-review', params: { receiptId: result.receipt.id } });
      await removePendingCapture(result.capture.id);
      return;
    }
    if (result.kind === 'waiting_for_key') {
      toast.show({ message: 'The saved capture still needs an API key.' });
    } else if (result.kind === 'failed') {
      toast.show({ message: 'A saved capture could not be read after several attempts.' });
    } else {
      toast.show({ message: 'The saved capture is still waiting for a connection.' });
    }
  };

  useEffect(loadKey, [loadKey]);
  useEffect(() => { void getBodyMeasurements().then(setMeasurements); }, []);
  useEffect(() => {
    void getReceiptOcrPreference().then((preference) => setOcrCloudText(preference.cloudTextEnhancement));
  }, []);

  if (!profile) return <Screen />;
  const activeMeasurement = measurements.find((item) => item.provider === profile.targetSource);
  const measurementIsStale = activeMeasurement ? isMeasurementStale(profile, activeMeasurement) : false;

  const applyPatch = async (patch: Partial<Profile>) => {
    await updateProfile(patch);
    await refreshDay();
  };

  const updateMeasurementWeight = async () => {
    if (!activeMeasurement) return;
    const updated = {
      ...activeMeasurement,
      weightKg: profile.weightKg,
      measuredAt: new Date().toISOString(),
    };
    await saveBodyMeasurement(updated);
    setMeasurements((current) => current.map((item) =>
      item.provider === updated.provider ? updated : item,
    ));
  };

  const chooseTargetSource = () => {
    const choices = TARGET_SOURCES.map((source) => {
      const target = resolveTarget({ ...profile, targetSource: source }, measurements);
      if (target !== null) {
        return {
            text: `${targetSourceLabel(source)} — ${target} kcal`,
            onPress: () => void applyPatch({ targetSource: source, targetCalories: target }),
          };
      }
      return {
        text: `Add ${targetSourceLabel(source)} inputs`,
        onPress: () => {
          if (dbReadiness.phase !== 'ready') return;
          if (source === 'estimated') {
            setProfileField('formula');
            return;
          }
          if (source === 'dexa' || source === 'inbody') {
            useOnboardingStore.getState().setMeasuredFlowOrigin('settings');
          }
          useOnboardingStore.getState().set({ targetSource: source });
          router.push('/onboarding/energy');
        },
      };
    });
    Alert.alert(
      'Target source',
      'Each option is your own calculation. Add the inputs a source needs before using it.',
      [...choices, { text: 'Cancel', style: 'cancel' }],
    );
  };

  // Optimistic, then reconciled: a toggle that visibly lags is worse than
  // one that snaps back on the rare write failure.
  const changeOcrCloudText = (next: boolean) => {
    setOcrCloudText(next);
    void saveReceiptOcrPreference({ cloudTextEnhancement: next }).catch(() => {
      setOcrCloudText(!next);
      toast.show({ kind: 'recoverable-error', message: 'That preference could not be saved.' });
    });
  };

  // Optimistic, like the OCR toggle above: the row reflects the pick the
  // instant it's tapped, then reconciles if the write fails.
  const chooseGeminiModel = (model: GeminiModel) => {
    const previous = geminiModel;
    setGeminiModel(model);
    void Haptics.selectionAsync();
    void setGeminiModelPreference(model)
      .then(() => {
        const label = GEMINI_MODELS.find((option) => option.id === model)?.label ?? model;
        toast.show({ message: `Now using ${label} for new estimates.` });
      })
      .catch(() => {
        setGeminiModel(previous);
        toast.show({ kind: 'recoverable-error', message: 'That model could not be saved.' });
      });
  };

  const removeKey = () => {
    Alert.alert('Remove API key?', 'Photo estimates will stop until you add a new one.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void clearApiKey().then(() => {
            setMaskedKey(null);
            toast.show({ message: 'Key removed.' });
          });
        },
      },
    ]);
  };

  const onExport = () => {
    void exportData().catch(() => {
      toast.show({ message: 'Export could not be shared.' });
    });
  };

  const onDeleteAll = () => {
    Alert.alert(
      'Delete all data?',
      'Every meal, photo, and your profile. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: () => confirmDeleteAll(),
        },
      ],
    );
  };

  const confirmDeleteAll = () => {
    Alert.alert('Are you sure?', 'This is the last chance to keep your data.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            deleteAllPhotos('meals');
            deleteAllPhotos('receipts');
            deleteAllPhotos('pantry-captures');
            deleteAllPhotos('recipes');
            await resetDatabase();
            useProfileStore.setState({ profile: null });
            router.replace('/onboarding/welcome');
          })();
        },
      },
    ]);
  };

  const onLoadDemoData = () => {
    Alert.alert(
      'Replace with demo data?',
      'This removes the current local profile, meals, pantry, recipes, and photos. It then loads a testing profile with 14 meals, 18 pantry items, two recipes, and four recent barcode scans.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Replace data',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setDemoLoading(true);
              try {
                deleteAllPhotos('meals');
                deleteAllPhotos('receipts');
                deleteAllPhotos('pantry-captures');
                deleteAllPhotos('recipes');
                await resetDatabase();
                const summary = await populateDemoData();
                await useProfileStore.getState().load();
                useDayStore.setState({
                  selectedDate: localDateString(),
                  following: true,
                  monthSummaries: {},
                  pendingUndo: null,
                  lastDepletion: null,
                });
                await useDayStore.getState().refresh();
                router.replace('/(tabs)');
                toast.show({ message: `Demo loaded: ${summary.meals} meals, ${summary.pantryItems} pantry items, and ${summary.barcodeScans} barcode scans.` });
              } catch (error) {
                console.warn('Demo data load failed.', error);
                const detail = error instanceof Error ? error.message : String(error);
                toast.show({ kind: 'recoverable-error', message: `Demo data could not be loaded: ${detail}` });
              } finally {
                setDemoLoading(false);
              }
            })();
          },
        },
      ],
    );
  };

  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <Screen scroll>
      <ScreenTitle style={styles.title}>Settings</ScreenTitle>

      <View style={styles.groups}>
        <Card title="Appearance" padded={false}>
          <SettingsRow
            label="Theme"
            value={themeOptions.find((option) => option.id === themeId)?.label ?? 'Organic'}
            onPress={() => setThemeOpen(true)}
          />
        </Card>

        <Card title="Profile" padded={false}>
          <SettingsRow
            label="Formula"
            value={profile.sex === null ? 'Not set' : profile.sex === 'male' ? 'Male' : 'Female'}
            onPress={() => setProfileField('sex')}
          />
          <SettingsRow
            label="Age"
            value={profile.age === null ? 'Not set' : `${profile.age}`}
            onPress={() => setProfileField('age')}
          />
          <SettingsRow
            label="Height"
            value={profile.heightCm === null ? 'Not set' : formatHeight(profile.heightCm, profile.units)}
            onPress={() => setProfileField('height')}
          />
          <SettingsRow
            label="Weight"
            value={formatWeight(profile.weightKg, profile.units)}
            onPress={() => setProfileField('weight')}
          />
          <SettingsRow
            label="Activity"
            value={activityLabel(profile.activityLevel)}
            onPress={() => setProfileField('activity')}
          />
          <SettingsRow
            label="Goal"
            value={goalRowValue(profile)}
            onPress={() => setProfileField('goal')}
          />
        </Card>

        <Card title="Targets" padded={false}>
          <SettingsRow
            label="Target source"
            value={targetSourceLabel(profile.targetSource)}
            onPress={chooseTargetSource}
          />
          <SettingsRow
            label="Daily target"
            value={`${profile.targetCalories} kcal`}
            showChevron={false}
          />
          <SettingsRow
            label="Daily fibre target"
            value={`${profile.fibreTargetG} g`}
            onPress={() => setProfileField('fibre')}
          />
          {measurementIsStale ? (
            <>
              <Caption muted style={styles.stale}>
                Your current weight differs from this measurement. This calculation stays active until you update it.
              </Caption>
              <SettingsRow
                label="Use current weight for measurement"
                onPress={() => void updateMeasurementWeight()}
              />
            </>
          ) : null}
          <SettingsRow
            label="Macro split"
            value={`${Math.round(profile.proteinPct * 100)} / ${Math.round(
              profile.carbsPct * 100,
            )} / ${Math.round(profile.fatPct * 100)}`}
            onPress={() => setSplitOpen(true)}
          />
          <SettingsRow
            label="Units"
            value={profile.units === 'metric' ? 'Metric' : 'Imperial'}
            onPress={() =>
              void applyPatch({
                units: (profile.units === 'metric'
                  ? 'imperial'
                  : 'metric') as Units,
              })
            }
          />
        </Card>

        <Card title="Tracking" padded={false}>
          <SettingsRow
            label="Fasting"
            onPress={() => router.push('/fasting')}
          />
          <SettingsRow
            label="Shops"
            onPress={() => router.push('/shops')}
          />
        </Card>

        <Card title="Receipt OCR" padded={false}>
          <SettingsToggleRow
            label="Enhance receipt text with AI"
            description="Lightweight text-only; photos never leave device"
            value={ocrCloudText}
            onValueChange={changeOcrCloudText}
          />
          {ocrCloudText && !maskedKey ? (
            <Caption muted style={styles.stale}>
              This needs an API key. Until one is added, receipts are structured on this device.
            </Caption>
          ) : null}
        </Card>

        <Card title="API key" padded={false}>
          <SettingsRow
            label="Key"
            value={maskedKey ?? 'Not set'}
            showChevron={false}
          />
          <SettingsRow
            label={maskedKey ? 'Replace key' : 'Add key'}
            onPress={() => setKeyOpen(true)}
          />
          {maskedKey ? (
            <SettingsRow label="Remove key" destructive onPress={removeKey} />
          ) : null}
          {configuredProvider === 'gemini' ? (
            <SettingsRow
              label="Model"
              value={modelRowValue(geminiModel)}
              onPress={() => setModelOpen(true)}
            />
          ) : null}
        </Card>

        <Card title="Ingredients" padded={false}>
          <SettingsRow
            label="Saved recipes"
            onPress={() => router.push('/recipes')}
          />
          <SettingsRow
            label="Needs a look"
            onPress={() => router.push('/match-queue')}
          />
          <SettingsRow
            label="Merge duplicates"
            onPress={() => router.push('/merge-canonicals')}
          />
        </Card>

        <Card title="What you avoid" padded={false}>
          <SettingsRow
            label="Allergies, restrictions, dislikes"
            onPress={() => router.push('/dietary-rules')}
          />
        </Card>

        <Card title="Your data" padded={false}>
          <SettingsRow label="Export as JSON" onPress={onExport} />
          <SettingsRow label="Delete all data" destructive onPress={onDeleteAll} />
        </Card>

        {__DEV__ ? (
          <Card title="Developer" padded={false}>
            <SettingsRow
              label={demoLoading ? 'Loading demo data…' : 'Replace with demo data'}
              value="14 meals · 18 pantry · 4 scans"
              onPress={demoLoading ? undefined : onLoadDemoData}
              showChevron={!demoLoading}
            />
          </Card>
        ) : null}

        <View style={styles.about}>
          <Caption muted>
            Mise {version}. Your diary is stored on this device. There is no Mise
            account or server. Photo analysis sends the selected photo to your
            configured provider.
          </Caption>
        </View>
      </View>

      <ProfileSheet
        visible={profileField !== null}
        field={profileField}
        profile={profile}
        onClose={() => setProfileField(null)}
        onSave={(patch) => void applyPatch(
          profileField === 'formula' ? { ...patch, targetSource: 'estimated' } : patch,
        )}
      />

      <MacroSplitSheet
        visible={splitOpen}
        onClose={() => setSplitOpen(false)}
        proteinPct={profile.proteinPct}
        carbsPct={profile.carbsPct}
        fatPct={profile.fatPct}
        onSave={(split) => void applyPatch(split)}
      />

      <ApiKeySheet
        visible={keyOpen}
        onClose={() => setKeyOpen(false)}
        onSaved={releasePendingCaptures}
      />

      <ModelSheet
        visible={modelOpen}
        activeModel={geminiModel}
        onClose={() => setModelOpen(false)}
        onSelect={chooseGeminiModel}
      />

      <ThemeSheet
        visible={themeOpen}
        activeTheme={themeId}
        onClose={() => setThemeOpen(false)}
        onError={() => toast.show({ kind: 'recoverable-error', message: 'Theme could not be changed. Your current appearance was kept.' })}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: space.base, marginBottom: space.lg },
  groups: { gap: space.lg },
  about: { paddingHorizontal: space.xs, paddingTop: space.sm },
  stale: { paddingHorizontal: space.base, paddingBottom: space.base },
});

function modelRowValue(model: GeminiModel): string {
  const option = GEMINI_MODELS.find((candidate) => candidate.id === model);
  return option ? `${option.label} · ${option.quotaBadge}` : model;
}

function targetSourceLabel(source: Profile['targetSource']): string {
  return source === 'dexa' ? 'DEXA scan' : source === 'inbody' ? 'InBody result' : source === 'stated' ? 'Known figure' : 'Formula';
}

function goalRowValue(profile: Profile): string {
  return goalSummaryLabel(profile.goal, profile.weightKg, profile.targetWeightKg, profile.weightGoalRateKgPerWeek, new Date());
}
