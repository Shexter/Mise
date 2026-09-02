import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, PixelRatio, Pressable, StyleSheet, View } from 'react-native';

import { StepShell } from '@/components/StepShell';
import { Body, Caption } from '@/components/Type';
import { color, opacity, radius, space, type } from '@/constants/theme';
import { APPLIANCE_ILLUSTRATIONS } from '@/media/onboardingIllustrations';
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
      title="What do you cook with?"
      detail="Pick everything you have. Recipes will fit your kitchen."
      primaryLabel="Continue"
      primaryLoading={saving}
      onPrimary={onContinue}
      secondaryLabel="Skip for now"
      onSecondary={onSkip}
    >
      {/* A grid, because this is a recognition task. Someone knows their own
          rice cooker by sight, so the picture does the identifying and the name
          only confirms it — a paragraph explaining what a microwave is for is
          reading work in place of looking. */}
      <View style={styles.grid}>
        {APPLIANCE_CATALOGUE.map((app) => {
          const selected = !noAppliancesChosen && draftAppliances.includes(app.id);
          return (
            <ApplianceTile
              key={app.id}
              applianceId={app.id}
              label={app.shortLabel}
              accessibilityLabel={app.label}
              selected={selected}
              onToggle={() => {
                if (noAppliancesChosen) setNoAppliances(false);
                toggleAppliance(app.id);
              }}
            />
          );
        })}
      </View>

      {/* Full width and wordier on purpose: this is the opt-out, not an eighth
          appliance to compare, and it is the one choice whose consequence is
          not obvious from a picture. */}
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
        <View style={[styles.checkbox, noAppliancesChosen && styles.checkboxSelected]}>
          {noAppliancesChosen ? <Feather name="check" size={14} color={color.onAction} /> : null}
        </View>
        <View style={styles.rowText}>
          <Body style={[styles.label, noAppliancesChosen && styles.labelSelected]}>
            No appliances / no-cook ideas
          </Body>
          <Caption muted>Only show salads, cold bowls, and assembly recipes.</Caption>
        </View>
      </Pressable>
    </StepShell>
  );
}

/**
 * One appliance as a tile: a tick in the corner, its illustration, its name.
 *
 * The tick stays vector. Selection has to read at a glance and retint per theme
 * and per state, which a painted mark cannot do — and the artwork is what the
 * person is choosing, so it must not also be the control.
 */
function ApplianceTile({
  applianceId,
  label,
  accessibilityLabel,
  selected,
  onToggle,
}: {
  applianceId: ApplianceId;
  label: string;
  accessibilityLabel: string;
  selected: boolean;
  onToggle: () => void;
}) {
  // React Native scales font size but not line height, so a fixed line box
  // clips its own glyphs at a large system text size.
  const fontScale = PixelRatio.getFontScale();

  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${accessibilityLabel}, ${selected ? 'selected' : 'not selected'}`}
      style={({ pressed }) => [
        styles.tile,
        selected && styles.tileSelected,
        pressed && { opacity: opacity.pressed },
      ]}
    >
      <View style={[styles.checkbox, styles.tileCheckbox, selected && styles.checkboxSelected]}>
        {selected ? <Feather name="check" size={14} color={color.onAction} /> : null}
      </View>

      {/* Contained and unframed: the artwork's own warm paper is the surface,
          so the tile does not nest one painted square inside another. */}
      <Image
        source={APPLIANCE_ILLUSTRATIONS[applianceId]}
        style={styles.art}
        resizeMode="contain"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />

      <Body
        style={[
          styles.tileLabel,
          { lineHeight: type.body.lineHeight * fontScale },
          selected && styles.labelSelected,
        ]}
      >
        {label}
      </Body>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
  },
  /**
   * Two to a row, sized by the leftover width rather than a fixed number, so
   * the pair still fits when the gutter changes.
   */
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    alignItems: 'center',
    paddingTop: space.base,
    paddingBottom: space.md,
    paddingHorizontal: space.sm,
    // `ground`, not `surface`: the artwork's warm paper is lighter than a card
    // fill, and on `surface` it reads as a pale square sitting inside a darker
    // one. On the screen's own ground the seam all but disappears and the
    // hairline border still says "tile" — which is how the concept draws it.
    backgroundColor: color.ground,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderColor: color.line,
    overflow: 'hidden',
  },
  tileSelected: {
    borderColor: color.action,
  },
  tileCheckbox: {
    position: 'absolute',
    top: space.sm,
    left: space.sm,
    // Above the artwork it overlaps, so the tick stays the thing you can see.
    zIndex: 1,
  },
  /**
   * Full-bleed to the tile's edges. The artwork carries its own warm paper, so
   * letting it reach the border means there is no lighter square inside a
   * darker one — the paper simply is the top of the tile.
   */
  art: {
    // A definite square. A percentage width or a bare `aspectRatio` leaves the
    // box indefinite inside this centred column, and the image falls back to
    // its own 512px intrinsic size and overruns the tile.
    width: 120,
    height: 120,
    marginBottom: space.sm,
  },
  tileLabel: {
    textAlign: 'center',
    fontWeight: '500',
    color: color.ink,
    paddingHorizontal: space.sm,
  },
  noApplianceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    backgroundColor: color.surface,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderColor: color.line,
    marginTop: space.base,
  },
  rowSelected: {
    borderColor: color.action,
    backgroundColor: color.surface,
  },
  rowText: {
    flex: 1,
    gap: space.xs,
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
