import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { clearApiKey, maskedApiKey } from '@/api/keyStore';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { ApiKeySheet } from '@/components/settings/ApiKeySheet';
import { MacroSplitSheet } from '@/components/settings/MacroSplitSheet';
import { ProfileSheet } from '@/components/settings/ProfileSheet';
import { SettingsRow } from '@/components/settings/Row';
import { useToast } from '@/components/Toast';
import { Caption, ScreenTitle } from '@/components/Type';
import { space } from '@/constants/theme';
import {
  activityLabel,
  goalLabel,
} from '@/constants/activityLevels';
import { resetDatabase } from '@/db';
import { exportData } from '@/logic/export';
import { formatHeight, formatWeight } from '@/logic/units';
import { deleteAllPhotos } from '@/media/photos';
import { useDayStore } from '@/store/dayStore';
import { useProfileStore } from '@/store/profileStore';
import type { Profile, Units } from '@/types';

type ProfileField = 'sex' | 'age' | 'height' | 'weight' | 'activity' | 'goal';

export default function SettingsScreen() {
  const router = useRouter();
  const toast = useToast();
  const profile = useProfileStore((state) => state.profile);
  const updateProfile = useProfileStore((state) => state.update);
  const refreshDay = useDayStore((state) => state.refresh);

  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [profileField, setProfileField] = useState<ProfileField | null>(null);
  const [splitOpen, setSplitOpen] = useState(false);
  const [keyOpen, setKeyOpen] = useState(false);

  const loadKey = useCallback(() => {
    void maskedApiKey().then(setMaskedKey);
  }, []);

  useEffect(loadKey, [loadKey]);

  if (!profile) return <Screen />;

  const applyPatch = async (patch: Partial<Profile>) => {
    await updateProfile(patch);
    await refreshDay();
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
            deleteAllPhotos();
            await resetDatabase();
            useProfileStore.setState({ profile: null });
            router.replace('/onboarding/welcome');
          })();
        },
      },
    ]);
  };

  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <Screen scroll>
      <ScreenTitle style={styles.title}>Settings</ScreenTitle>

      <View style={styles.groups}>
        <Card title="Profile" padded={false}>
          <SettingsRow
            label="Formula"
            value={profile.sex === 'male' ? 'Male' : 'Female'}
            onPress={() => setProfileField('sex')}
          />
          <SettingsRow
            label="Age"
            value={`${profile.age}`}
            onPress={() => setProfileField('age')}
          />
          <SettingsRow
            label="Height"
            value={formatHeight(profile.heightCm, profile.units)}
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
            value={goalLabel(profile.goal)}
            onPress={() => setProfileField('goal')}
          />
        </Card>

        <Card title="Targets" padded={false}>
          <SettingsRow
            label="Daily target"
            value={`${profile.targetCalories} kcal`}
            showChevron={false}
          />
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
        </Card>

        <Card title="Your data" padded={false}>
          <SettingsRow label="Export as JSON" onPress={onExport} />
          <SettingsRow label="Delete all data" destructive onPress={onDeleteAll} />
        </Card>

        <View style={styles.about}>
          <Caption muted>
            Snap {version}. Everything is stored only on this device. There is no
            account and no server.
          </Caption>
        </View>
      </View>

      <ProfileSheet
        visible={profileField !== null}
        field={profileField}
        profile={profile}
        onClose={() => setProfileField(null)}
        onSave={(patch) => void applyPatch(patch)}
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
        onSaved={loadKey}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: space.base, marginBottom: space.lg },
  groups: { gap: space.lg },
  about: { paddingHorizontal: space.xs, paddingTop: space.sm },
});
