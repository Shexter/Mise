import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { FoodVisual } from '@/components/FoodVisual';
import { Sheet } from '@/components/Sheet';
import { StepShell } from '@/components/StepShell';
import { Body, Caption, SectionLabel } from '@/components/Type';
import { color, opacity, radius, space } from '@/constants/theme';
import { insertPantryItem } from '@/db/queries';
import { COMMON_STARTER_PANTRY_ITEMS, type StarterPantryOption } from '@/logic/starterPantryItems';
import { useCookingPreferencesStore } from '@/store/cookingPreferencesStore';
import { useOnboardingStore } from '@/store/onboardingStore';

export default function StarterPantryStep() {
  const router = useRouter();
  const draftIds = useOnboardingStore((state) => state.starterPantryDraftIds);
  const toggleStarterPantryDraft = useOnboardingStore((state) => state.toggleStarterPantryDraft);
  const confirmStarterPantry = useOnboardingStore((state) => state.confirmStarterPantry);
  const intents = useOnboardingStore((state) => state.intents);
  const resetDraft = useOnboardingStore((state) => state.reset);

  const deferMealPrep = useCookingPreferencesStore((state) => state.deferMealPrep);
  const savePreferences = useCookingPreferencesStore((state) => state.savePreferences);

  const [reviewing, setReviewing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const selectedItems = useMemo(() => {
    return COMMON_STARTER_PANTRY_ITEMS.filter((item) => draftIds.includes(item.canonicalId));
  }, [draftIds]);

  const categories = useMemo(() => {
    const map = new Map<string, StarterPantryOption[]>();
    for (const item of COMMON_STARTER_PANTRY_ITEMS) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return map;
  }, []);

  const onPrimaryAction = () => {
    if (selectedItems.length > 0) {
      setReviewing(true);
    } else {
      router.push('/onboarding/first-plan');
    }
  };

  const onConfirmReview = async () => {
    setConfirming(true);
    try {
      const confirmedIds: string[] = [];
      for (const item of selectedItems) {
        try {
          await insertPantryItem({
            canonicalId: item.canonicalId,
            locationId: item.defaultLocation,
            qtyRemaining: null,
            qtyUnit: null,
          });
          confirmedIds.push(item.canonicalId);
        } catch {
          confirmedIds.push(item.canonicalId);
        }
      }

      confirmStarterPantry(confirmedIds);
      setReviewing(false);
      router.push('/onboarding/first-plan');
    } finally {
      setConfirming(false);
    }
  };

  const onSkip = async () => {
    await deferMealPrep();
    await savePreferences({
      intents,
      mealPrepStatus: 'deferred',
    });
    resetDraft();
    router.replace('/(tabs)');
  };

  return (
    <StepShell
      step="starter-pantry"
      title="What’s in your kitchen?"
      detail="Select a few ingredients on hand to build your first tailored meal-prep plan."
      primaryLabel={selectedItems.length > 0 ? `Review ${selectedItems.length} ingredients` : 'Continue without ingredients'}
      onPrimary={onPrimaryAction}
      secondaryLabel="Skip for now"
      onSecondary={onSkip}
    >
      <View style={styles.container}>
        {Array.from(categories.entries()).map(([category, items]) => (
          <View key={category} style={styles.categorySection}>
            <SectionLabel>{categoryLabel(category)}</SectionLabel>
            <View style={styles.chipsWrap}>
              {items.map((item) => {
                const selected = draftIds.includes(item.canonicalId);
                return (
                  <Pressable
                    key={item.canonicalId}
                    onPress={() => toggleStarterPantryDraft(item.canonicalId)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={`${item.name}, ${selected ? 'selected' : 'not selected'}`}
                    style={({ pressed }) => [
                      styles.chip,
                      selected && styles.chipSelected,
                      pressed && { opacity: opacity.pressed },
                    ]}
                  >
                    <FoodVisual
                      canonicalId={item.canonicalId}
                      category={item.category}
                      size={20}
                      bordered={false}
                    />
                    <Body style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {item.name}
                    </Body>
                    {selected ? (
                      <Feather name="check" size={14} color={color.surface} />
                    ) : (
                      <Feather name="plus" size={14} color={color.muted} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}

        <View style={styles.alternateIntake}>
          <SectionLabel muted>More ways to add</SectionLabel>
          <View style={styles.intakeButtons}>
            <Button
              label="Scan items with camera"
              variant="secondary"
              onPress={() => router.push('/pantry-capture')}
            />
            {/* The invitation, offered once and never required: "Skip for now"
                above is still one tap, and taking it leaves calorie tracking,
                meal prep, and the pantry exactly as reachable as before. */}
            <Button
              label="Say what’s in there"
              detail="Name several things at once — you review before anything is added"
              variant="secondary"
              onPress={() => router.push('/pantry-voice')}
            />
            <Button
              label="Add custom ingredient"
              variant="secondary"
              onPress={() => router.push('/add-pantry-item')}
            />
          </View>
        </View>
      </View>

      <Sheet
        visible={reviewing}
        onClose={() => setReviewing(false)}
        title="Confirm starter pantry"
        footer={
          <View style={styles.modalFooter}>
            <Button
              label="Confirm & add to pantry"
              loading={confirming}
              onPress={() => void onConfirmReview()}
            />
            <Button
              label="Back to selection"
              variant="ghost"
              onPress={() => setReviewing(false)}
            />
          </View>
        }
      >
        <Body muted>
          Review the ingredients you selected before they are added to your local pantry stock.
        </Body>

        <View style={styles.reviewList}>
          {selectedItems.map((item) => (
            <View key={item.canonicalId} style={styles.reviewRow}>
              <View style={styles.reviewRowLeft}>
                <FoodVisual
                  canonicalId={item.canonicalId}
                  category={item.category}
                  size="md"
                />
                <View style={styles.reviewRowInfo}>
                  <Body style={styles.reviewRowName}>{item.name}</Body>
                  <Caption muted>
                    Location: {item.defaultLocation} · Quantity unknown
                  </Caption>
                </View>
              </View>
              <Pressable
                onPress={() => toggleStarterPantryDraft(item.canonicalId)}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${item.name}`}
                style={styles.removeButton}
              >
                <Feather name="x" size={16} color={color.muted} />
              </Pressable>
            </View>
          ))}
        </View>
      </Sheet>
    </StepShell>
  );
}

function categoryLabel(category: string): string {
  switch (category) {
    case 'protein':
      return 'Proteins';
    case 'staple':
      return 'Grains & staples';
    case 'produce':
      return 'Fresh produce';
    case 'seasoning':
      return 'Seasonings & oils';
    default:
      return category;
  }
}

const styles = StyleSheet.create({
  container: {
    gap: space.lg,
  },
  categorySection: {
    gap: space.sm,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: color.surface,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: color.line,
  },
  chipSelected: {
    backgroundColor: color.action,
    borderColor: color.action,
  },
  chipText: {
    fontSize: 15,
    fontWeight: '500',
    color: color.ink,
  },
  chipTextSelected: {
    color: color.surface,
  },
  alternateIntake: {
    gap: space.sm,
    marginTop: space.md,
  },
  intakeButtons: {
    gap: space.sm,
  },
  reviewList: {
    marginVertical: space.sm,
    gap: space.xs,
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: color.line,
    gap: space.md,
  },
  reviewRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    flex: 1,
  },
  reviewRowInfo: {
    gap: space.xs,
  },
  reviewRowName: {
    fontWeight: '600',
  },
  removeButton: {
    padding: space.sm,
  },
  modalFooter: {
    gap: space.sm,
    marginTop: space.sm,
  },
});
