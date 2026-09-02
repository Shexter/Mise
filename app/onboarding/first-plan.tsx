import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { DishVisual } from '@/components/DishVisual';
import { dishIllustrationFor } from '@/media/dishIllustrations';
import { FoodVisual } from '@/components/FoodVisual';
import { Sheet } from '@/components/Sheet';
import { StepShell } from '@/components/StepShell';
import { Body, Caption, ScreenTitle, SectionLabel } from '@/components/Type';
import { color, radius, space } from '@/constants/theme';
import { getAllCanonicals, listDietaryRules, listPantryItems } from '@/db/queries';
import { findEligibleMealPrepPlans } from '@/logic/mealPrepMatching';
import { STARTER_MEAL_PREP_TEMPLATES } from '@/logic/mealPrepTemplates';
import { useCookingPreferencesStore } from '@/store/cookingPreferencesStore';
import { useOnboardingStore } from '@/store/onboardingStore';
import type { ApplianceId, FoodClass, MealPrepPlan } from '@/types';

export default function FirstPlanStep() {
  const router = useRouter();
  const ownedApplianceIds = useCookingPreferencesStore((state) => state.ownedApplianceIds);
  const completeMealPrep = useCookingPreferencesStore((state) => state.completeMealPrep);
  const deferMealPrep = useCookingPreferencesStore((state) => state.deferMealPrep);
  const savePreferences = useCookingPreferencesStore((state) => state.savePreferences);

  const starterConfirmedIds = useOnboardingStore((state) => state.starterPantryConfirmedIds);
  const intents = useOnboardingStore((state) => state.intents);
  const resetDraft = useOnboardingStore((state) => state.reset);
  const completeBranch = useOnboardingStore((state) => state.completeBranch);
  const setDraft = useOnboardingStore((state) => state.set);
  const calorieComplete = useOnboardingStore((state) => state.completedBranches.includes('calories'));

  const [pantryCanonicalIds, setPantryCanonicalIds] = useState<Set<string>>(new Set());
  const [excludedCanonicalIds, setExcludedCanonicalIds] = useState<Set<string>>(new Set());
  const [foodClassById, setFoodClassById] = useState<Map<string, FoodClass>>(new Map());
  const [loadingData, setLoadingData] = useState(true);
  const [selectedPlanIndex, setSelectedPlanIndex] = useState(0);

  // Active cooking guide sheet state
  const [cookingActive, setCookingActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [guideFinished, setGuideFinished] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadData() {
      try {
        const [pantryItems, dietaryRules, canonicals] = await Promise.all([
          listPantryItems(),
          listDietaryRules(),
          getAllCanonicals(),
        ]);
        if (!active) return;

        setFoodClassById(new Map(canonicals.map((item) => [item.id, item.foodClass])));

        const pantrySet = new Set<string>(pantryItems.map((p) => p.canonicalId));
        for (const id of starterConfirmedIds) {
          pantrySet.add(id);
        }
        setPantryCanonicalIds(pantrySet);

        const excluded = new Set<string>();
        for (const rule of dietaryRules) {
          if (rule.canonicalId) excluded.add(rule.canonicalId);
        }
        setExcludedCanonicalIds(excluded);
      } finally {
        if (active) setLoadingData(false);
      }
    }
    void loadData();
    return () => {
      active = false;
    };
  }, [starterConfirmedIds]);

  const eligiblePlans: MealPrepPlan[] = useMemo(() => {
    return findEligibleMealPrepPlans({
      ownedAppliances: ownedApplianceIds,
      confirmedPantryCanonicalIds: pantryCanonicalIds,
      excludedCanonicalIds,
      templates: STARTER_MEAL_PREP_TEMPLATES,
    });
  }, [ownedApplianceIds, pantryCanonicalIds, excludedCanonicalIds]);

  const currentPlan: MealPrepPlan | null = eligiblePlans[selectedPlanIndex] ?? null;

  // A plan's identity is everything it calls for, whether or not it is in stock.
  const planFoodClasses = useMemo(
    () =>
      [...(currentPlan?.confirmedIngredients ?? []), ...(currentPlan?.missingIngredients ?? [])].map(
        (ingredient) => (ingredient.canonicalId ? foodClassById.get(ingredient.canonicalId) ?? null : null),
      ),
    [currentPlan, foodClassById],
  );

  const saveCompletedMealPrep = async () => {
    await completeMealPrep();
    await savePreferences({
      intents: useOnboardingStore.getState().intents,
      mealPrepStatus: 'completed',
    });
    completeBranch('meal_prep');
  };

  const onSetUpCalories = async () => {
    await saveCompletedMealPrep();
    setDraft({ intents: ['calories', 'meal_prep'] });
    router.push('/onboarding/sex');
  };

  const onFinishSetup = async () => {
    await saveCompletedMealPrep();
    resetDraft();
    router.replace('/(tabs)');
  };

  const onDefer = async () => {
    await deferMealPrep();
    await savePreferences({
      intents,
      mealPrepStatus: 'deferred',
    });
    resetDraft();
    router.replace('/(tabs)');
  };

  const onNextIdea = () => {
    if (eligiblePlans.length > 1) {
      setSelectedPlanIndex((prev) => (prev + 1) % eligiblePlans.length);
    }
  };

  const onStartCooking = () => {
    setCurrentStepIndex(0);
    setGuideFinished(false);
    setCookingActive(true);
  };

  const onHandoffToManualLog = async () => {
    setCookingActive(false);
    await completeMealPrep();
    await savePreferences({
      intents,
      mealPrepStatus: 'completed',
    });
    resetDraft();
    router.replace('/manual');
  };

  if (loadingData) {
    return (
      <StepShell step="first-plan" title="Building your plan..." showBack={false}>
        <View style={styles.loadingContainer}>
          <Body muted>Matching kitchen tools and pantry ingredients...</Body>
        </View>
      </StepShell>
    );
  }

  if (!currentPlan) {
    return (
      <StepShell
        step="first-plan"
        title="No matching starter plan"
        detail="We could not find a starter template matching your current appliances and ingredients. You can still enter the app and add custom recipes."
        primaryLabel={calorieComplete ? 'Head straight to the app' : 'Set up daily calorie target'}
        onPrimary={calorieComplete ? onFinishSetup : onSetUpCalories}
        secondaryLabel={calorieComplete ? undefined : 'Head straight to the app'}
        onSecondary={calorieComplete ? undefined : onFinishSetup}
      >
        <Card title="Next steps">
          <Body>
            Explore the Pantry and Recipes tabs to add ingredients and custom cooking ideas.
          </Body>
        </Card>
      </StepShell>
    );
  }

  return (
    <StepShell
      step="first-plan"
      title="Your first meal-prep plan"
      detail="Tailored from your kitchen setup and confirmed pantry."
      primaryLabel={calorieComplete ? 'Head straight to the app' : 'Set up daily calorie target'}
      onPrimary={calorieComplete ? onFinishSetup : onSetUpCalories}
      secondaryLabel={calorieComplete ? undefined : 'Head straight to the app'}
      onSecondary={calorieComplete ? undefined : onFinishSetup}
    >
      <View style={styles.container}>
        {/* Plan Header Card */}
        <Card>
          <View style={styles.planHeader}>
            <View style={styles.planHeaderTop}>
              <PlanDishVisual
                templateId={currentPlan.templateId}
                title={currentPlan.title}
                foodClasses={planFoodClasses}
              />
              <View style={styles.planTitleWrap}>
                <ScreenTitle style={styles.planTitle}>{currentPlan.title}</ScreenTitle>

                <View style={styles.metaRow}>
                  <View style={styles.badge}>
                    <Feather name="pie-chart" size={14} color={color.ink} />
                    <Caption>{currentPlan.portions} portions</Caption>
                  </View>

                  {currentPlan.durationMinutes ? (
                    <View style={styles.badge}>
                      <Feather name="clock" size={14} color={color.ink} />
                      <Caption>{currentPlan.durationMinutes} mins</Caption>
                    </View>
                  ) : null}

                  <View style={styles.badge}>
                    <Feather name="tool" size={14} color={color.ink} />
                    <Caption>
                      {currentPlan.requiredAppliances.length === 0
                        ? 'No-cook'
                        : currentPlan.requiredAppliances.map(applianceLabel).join(', ')}
                    </Caption>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </Card>

        {/* Ingredients Card */}
        <Card title="Ingredients">
          <View style={styles.ingredientsList}>
            {currentPlan.confirmedIngredients.map((item, idx) => (
              <View key={`conf-${idx}`} style={styles.ingredientRow}>
                <FoodVisual
                  canonicalId={item.canonicalId}
                  category="other"
                  size="sm"
                />
                <Body style={styles.ingredientName}>{item.name}</Body>
                {item.quantity && item.unit ? (
                  <Caption muted>{item.quantity} {item.unit}</Caption>
                ) : null}
                <Feather name="check" size={16} color={color.action} />
              </View>
            ))}

            {currentPlan.missingIngredients.map((item, idx) => (
              <View key={`miss-${idx}`} style={styles.ingredientRow}>
                <FoodVisual
                  canonicalId={item.canonicalId}
                  category="other"
                  size="sm"
                />
                <Body muted style={styles.ingredientName}>
                  {item.name} <Caption muted>(Missing)</Caption>
                </Body>
                {item.quantity && item.unit ? (
                  <Caption muted>{item.quantity} {item.unit}</Caption>
                ) : null}
              </View>
            ))}
          </View>
        </Card>

        {/* Cooking Guide Steps Card */}
        <Card title="Cooking Guide">
          <View style={styles.stepsList}>
            {currentPlan.steps.map((step) => (
              <View key={step.stepNumber} style={styles.stepItem}>
                <View style={styles.stepBadge}>
                  <Body style={styles.stepNumberText}>{step.stepNumber}</Body>
                </View>
                <View style={styles.stepContent}>
                  <Body style={styles.stepInstruction}>{step.instruction}</Body>
                  <View style={styles.stepMeta}>
                    <Caption muted>
                      {step.applianceId ? applianceLabel(step.applianceId) : 'No-cook action'}
                      {step.durationMinutes ? ` · ${step.durationMinutes} min` : ''}
                    </Caption>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </Card>

        {/* Interactive Buttons */}
        <View style={styles.planActions}>
          <Button
            label="Start interactive guide"
            onPress={onStartCooking}
          />
          {eligiblePlans.length > 1 ? (
            <Button
              label="Choose another idea"
              variant="secondary"
              onPress={onNextIdea}
            />
          ) : null}
        </View>
      </View>

      {/* Interactive Cooking Guide Sheet */}
      <Sheet
        visible={cookingActive}
        onClose={() => setCookingActive(false)}
        title={!guideFinished ? `Step ${currentStepIndex + 1} of ${currentPlan.steps.length}` : 'Guide complete'}
        footer={
          !guideFinished ? (
            <View style={styles.guideFooter}>
              {currentStepIndex < currentPlan.steps.length - 1 ? (
                <Button
                  label="Next step"
                  onPress={() => setCurrentStepIndex((i) => i + 1)}
                />
              ) : (
                <Button
                  label="Complete cooking guide"
                  onPress={() => setGuideFinished(true)}
                />
              )}
              {currentStepIndex > 0 ? (
                <Button
                  label="Previous step"
                  variant="ghost"
                  onPress={() => setCurrentStepIndex((i) => i - 1)}
                />
              ) : null}
            </View>
          ) : (
            <View style={styles.completionActions}>
              <Button
                label="Review & log meal"
                onPress={() => void onHandoffToManualLog()}
              />
              <Button
                label="Finish setup"
                variant="ghost"
                onPress={() => void onFinishSetup()}
              />
            </View>
          )
        }
      >
        {!guideFinished ? (
          <View style={styles.activeStepCard}>
            <ScreenTitle style={styles.activeStepInstruction}>
              {currentPlan.steps[currentStepIndex]?.instruction}
            </ScreenTitle>
            <Caption muted style={styles.activeStepMeta}>
              {currentPlan.steps[currentStepIndex]?.applianceId
                ? `Use: ${applianceLabel(currentPlan.steps[currentStepIndex]!.applianceId!)}`
                : 'No appliance needed'}
              {currentPlan.steps[currentStepIndex]?.durationMinutes
                ? ` · ~${currentPlan.steps[currentStepIndex]?.durationMinutes} mins`
                : ''}
            </Caption>
          </View>
        ) : (
          <View style={styles.completionView}>
            <Feather name="award" size={40} color={color.action} />
            <ScreenTitle style={styles.completionTitle}>Cooking guide complete!</ScreenTitle>
            <Body muted style={styles.completionDetail}>
              Great job batch cooking {currentPlan.title}. You can now optionally review and log this meal.
            </Body>
          </View>
        )}
      </Sheet>
    </StepShell>
  );
}

function applianceLabel(id: ApplianceId): string {
  switch (id) {
    case 'cooktop':
      return 'Cooktop';
    case 'oven':
      return 'Oven';
    case 'microwave':
      return 'Microwave';
    case 'air_fryer':
      return 'Air fryer';
    case 'rice_cooker':
      return 'Rice cooker';
    case 'slow_cooker':
      return 'Slow cooker';
    case 'blender':
      return 'Blender';
    default:
      return id;
  }
}

/**
 * The plan's dish: its own artwork when the plan came from an authored
 * meal-prep template, and the procedural plate otherwise.
 *
 * The authored templates are a bounded set, so each one could be drawn. Every
 * other dish is not — a saved recipe or a provider's suggestion could be
 * anything — so `dishIllustrationFor` returns `null` for them and `DishVisual`
 * composes a plate from the food classes the dish's own ingredients belong to.
 * That fallback is a reviewed state, not a degraded one.
 */
function PlanDishVisual({
  templateId,
  title,
  foodClasses,
}: {
  templateId: string;
  title: string;
  foodClasses: readonly (FoodClass | null)[];
}) {
  const artwork = dishIllustrationFor(templateId);

  if (artwork === null) {
    return <DishVisual dish={title} foodClasses={foodClasses} size="lg" />;
  }

  return (
    <Image
      source={artwork}
      style={styles.planDish}
      resizeMode="contain"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

const styles = StyleSheet.create({
  /**
   * Matches `DishVisual`'s `lg` dimension so the header does not reflow when a
   * plan falls back to the procedural plate.
   */
  planDish: { width: 64, height: 64 },
  container: {
    gap: space.md,
  },
  loadingContainer: {
    padding: space.xl,
    alignItems: 'center',
  },
  planHeader: {
    gap: space.sm,
  },
  planHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  planTitleWrap: {
    flex: 1,
    gap: space.xs,
  },
  planTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    backgroundColor: color.ground,
    borderRadius: radius.input,
  },
  ingredientsList: {
    gap: space.sm,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  ingredientName: {
    flex: 1,
  },
  stepsList: {
    gap: space.md,
  },
  stepItem: {
    flexDirection: 'row',
    gap: space.md,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: color.ground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontWeight: '700',
    fontSize: 14,
  },
  stepContent: {
    flex: 1,
    gap: space.xs,
  },
  stepInstruction: {
    lineHeight: 20,
  },
  stepMeta: {
    marginTop: space.xs,
  },
  planActions: {
    gap: space.sm,
    marginTop: space.sm,
  },
  activeStepCard: {
    backgroundColor: color.surface,
    padding: space.lg,
    borderRadius: radius.card,
    gap: space.sm,
  },
  activeStepInstruction: {
    fontSize: 18,
    lineHeight: 24,
  },
  activeStepMeta: {
    marginTop: space.xs,
  },
  guideFooter: {
    gap: space.sm,
  },
  completionView: {
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.lg,
  },
  completionTitle: {
    fontSize: 22,
    textAlign: 'center',
  },
  completionDetail: {
    textAlign: 'center',
    lineHeight: 22,
  },
  completionActions: {
    width: '100%',
    gap: space.sm,
    marginTop: space.md,
  },
});
