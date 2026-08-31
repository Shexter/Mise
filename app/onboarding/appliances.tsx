import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { StepShell } from '@/components/StepShell';
import { Body, Caption } from '@/components/Type';
import { color, opacity, radius, space } from '@/constants/theme';
import { useCookingPreferencesStore } from '@/store/cookingPreferencesStore';
import { useOnboardingStore } from '@/store/onboardingStore';
import { APPLIANCE_CATALOGUE, type ApplianceId } from '@/types';

export default function AppliancesStep() {
  const router = useRouter();
  const draftAppliances = useOnboardingStore((state) => state.selectedAppliances);
  const noAppliancesChosen = useOnboardingStore((state) => state.noAppliancesChosen);
  const toggleAppliance = useOnboardingStore((state) => state.toggleAppliance);
  const setNoAppliances = useOnboardingStore((state) => state.setNoAppliances);
  const intents = useOnboardingStore((state) => state.intents);
  const resetDraft = useOnboardingStore((state) => state.reset);

  const saveAppliances = useCookingPreferencesStore((state) => state.saveAppliances);
  const savePreferences = useCookingPreferencesStore((state) => state.savePreferences);
  const deferMealPrep = useCookingPreferencesStore((state) => state.deferMealPrep);

  const [saving, setSaving] = useState(false);

  const onContinue = async () => {
    setSaving(true);
    try {
      // Save appliance ownerships
      const records = APPLIANCE_CATALOGUE.map((app) => ({
        applianceId: app.id,
        owned: !noAppliancesChosen && draftAppliances.includes(app.id),
      }));
      await saveAppliances(records);
      await savePreferences({
        intents,
        mealPrepStatus: 'not_started',
      });
      router.push('/onboarding/starter-pantry');
    } finally {
      setSaving(false);
    }
  };

  const onSkip = async () => {
    setSaving(true);
    try {
      await deferMealPrep();
      await savePreferences({
        intents,
        mealPrepStatus: 'deferred',
      });
      resetDraft();
      router.replace('/(tabs)');
    } finally {
      setSaving(false);
    }
  };

  return (
    <StepShell
      step="appliances"
      title="What appliances do you have?"
      detail="Select what is available in your kitchen. Mise will suggest plans that fit what you own."
      primaryLabel="Continue"
      primaryLoading={saving}
      onPrimary={onContinue}
      secondaryLabel="Skip for now"
      onSecondary={onSkip}
    >
      <View style={styles.list}>
        {APPLIANCE_CATALOGUE.map((app) => {
          const selected = !noAppliancesChosen && draftAppliances.includes(app.id);
          return (
            <ApplianceRow
              key={app.id}
              label={app.label}
              detail={app.detail}
              selected={selected}
              onToggle={() => {
                if (noAppliancesChosen) setNoAppliances(false);
                toggleAppliance(app.id);
              }}
            />
          );
        })}

        <Pressable
          onPress={() => setNoAppliances(!noAppliancesChosen)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: noAppliancesChosen }}
          accessibilityLabel={`No appliances, no cook ideas, ${noAppliancesChosen ? 'selected' : 'not selected'}`}
          style={({ pressed }) => [
            styles.noApplianceRow,
            noAppliancesChosen && styles.rowSelected,
            pressed && { opacity: opacity.pressed },
          ]}
        >
          <View style={styles.rowText}>
            <Body style={[styles.label, noAppliancesChosen && styles.labelSelected]}>
              No appliances / no-cook ideas
            </Body>
            <Caption muted>Only show salads, cold bowls, and assembly recipes.</Caption>
          </View>
          <View style={[styles.checkbox, noAppliancesChosen && styles.checkboxSelected]}>
            {noAppliancesChosen ? <Feather name="check" size={16} color={color.surface} /> : null}
          </View>
        </Pressable>
      </View>
    </StepShell>
  );
}

function ApplianceRow({
  label,
  detail,
  selected,
  onToggle,
}: {
  label: string;
  detail: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${label}, ${selected ? 'selected' : 'not selected'}`}
      style={({ pressed }) => [
        styles.row,
        selected && styles.rowSelected,
        pressed && { opacity: opacity.pressed },
      ]}
    >
      <View style={styles.rowText}>
        <Body style={[styles.label, selected && styles.labelSelected]}>{label}</Body>
        <Caption muted>{detail}</Caption>
      </View>
      <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
        {selected ? <Feather name="check" size={16} color={color.surface} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: space.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: space.md,
    backgroundColor: color.surface,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderColor: color.line,
  },
  noApplianceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: space.md,
    backgroundColor: color.surface,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderColor: color.line,
    marginTop: space.sm,
  },
  rowSelected: {
    borderColor: color.action,
    backgroundColor: color.surface,
  },
  rowText: {
    flex: 1,
    gap: space.xs,
    marginRight: space.md,
  },
  label: {
    fontWeight: '500',
    color: color.ink,
  },
  labelSelected: {
    color: color.action,
    fontWeight: '600',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.input,
    borderWidth: 1.5,
    borderColor: color.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface,
  },
  checkboxSelected: {
    backgroundColor: color.action,
    borderColor: color.action,
  },
});
