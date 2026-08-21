import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useReducer, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { DeckCountIndicator, EmptyDeck, SwipeActionBar } from '@/components/suggestions/DeckControls';
import { MealDetailSheet } from '@/components/suggestions/MealDetailSheet';
import { MealSwipeCard } from '@/components/suggestions/MealSwipeCard';
import { layout, space, swipeTokens } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { activeMeal, createDeckState, mealDeckReducer } from '@/logic/mealDeck';
import { evaluateMealBudget, nutritionProvenanceForSuggestion } from '@/logic/suggest';
import type { CanonicalItem, Suggestion } from '@/types';

interface Props {
  meals: Suggestion[];
  targetCalories: number | null;
  consumedCalories: number | null;
  canonicals: ReadonlyMap<string, CanonicalItem>;
  onHandCanonicalIds?: ReadonlySet<string>;
  onCook: (meal: Suggestion, servingsMade: number, servingsEaten: number) => void | Promise<void>;
  onPass: (meal: Suggestion) => void;
  onUndo: () => void;
  onRefresh?: () => void;
  onManual?: () => void;
}

const DECISION_RATIO = 0.35;
const VELOCITY_THRESHOLD = 800;

export function MealSwipeDeck(props: Props) {
  const [state, dispatch] = useReducer(mealDeckReducer, props.meals, createDeckState);
  const [cardWidth, setCardWidth] = useState(1);
  const [servingsMade, setServingsMade] = useState(1);
  const [servingsEaten, setServingsEaten] = useState(1);
  const [saving, setSaving] = useState(false);
  const reduceMotion = useReducedMotion();
  const translateX = useSharedValue(0);
  const opacityValue = useSharedValue(1);
  const hapticLatched = useSharedValue(false);
  const behindTranslateX = useSharedValue(0);
  const threshold = cardWidth * DECISION_RATIO;
  const top = activeMeal(state);
  const behind = state.meals[1] ?? null;

  useEffect(() => { dispatch({ type: 'replace', meals: props.meals }); }, [props.meals]);

  const pulse = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const resetMotion = useCallback(() => {
    translateX.value = 0;
    opacityValue.value = 1;
    hapticLatched.value = false;
  }, [hapticLatched, opacityValue, translateX]);

  const finishPass = useCallback(() => {
    if (top) props.onPass(top);
    dispatch({ type: 'pass' });
    resetMotion();
  }, [props, resetMotion, top]);

  const finishAccept = useCallback(() => {
    if (!top) return;
    dispatch({ type: 'accept' });
    setServingsMade(top.servings);
    setServingsEaten(1);
    resetMotion();
  }, [resetMotion, top]);

  const commit = useCallback((direction: 'left' | 'right') => {
    const done = direction === 'left' ? finishPass : finishAccept;
    if (reduceMotion) {
      opacityValue.value = withTiming(0, { duration: swipeTokens.motion.reducedFadeDurationMs }, (finished) => {
        if (finished) runOnJS(done)();
      });
      return;
    }
    translateX.value = withTiming(
      direction === 'left' ? -cardWidth * 2 : cardWidth * 2,
      { duration: swipeTokens.motion.exitDurationMs, easing: Easing.out(Easing.cubic) },
      (finished) => { if (finished) runOnJS(done)(); },
    );
  }, [cardWidth, finishAccept, finishPass, opacityValue, reduceMotion, translateX]);

  const pan = Gesture.Pan()
    .enabled(!reduceMotion && top !== null && state.pendingCook === null)
    .activeOffsetX([-space.md, space.md])
    .failOffsetY([-space.xl, space.xl])
    .onUpdate((event) => {
      translateX.value = event.translationX;
      if (Math.abs(event.translationX) >= threshold && !hapticLatched.value) {
        hapticLatched.value = true;
        runOnJS(pulse)();
      }
    })
    .onEnd((event) => {
      const shouldCommit = Math.abs(event.translationX) >= threshold || Math.abs(event.velocityX) >= VELOCITY_THRESHOLD;
      if (shouldCommit) {
        if (!hapticLatched.value) runOnJS(pulse)();
        runOnJS(commit)(event.translationX < 0 || event.velocityX < -VELOCITY_THRESHOLD ? 'left' : 'right');
      } else {
        hapticLatched.value = false;
        translateX.value = withSpring(0, { stiffness: swipeTokens.motion.springStiffness, damping: swipeTokens.motion.springDamping, overshootClamping: true });
      }
    });

  const rotation = useDerivedValue(() => interpolate(translateX.value, [-cardWidth, 0, cardWidth], [-swipeTokens.motion.exitRotationDeg, 0, swipeTokens.motion.exitRotationDeg], Extrapolation.CLAMP));
  const progress = useDerivedValue(() => Math.min(1, Math.abs(translateX.value) / Math.max(threshold, 1)));
  const topStyle = useAnimatedStyle(() => ({ opacity: opacityValue.value, transform: reduceMotion ? [] : [{ translateX: translateX.value }, { rotate: `${rotation.value}deg` }] }));
  const behindStyle = useAnimatedStyle(() => ({ transform: [{ scale: reduceMotion ? swipeTokens.motion.scaleTo : interpolate(progress.value, [0, 1], [swipeTokens.motion.scaleFrom, swipeTokens.motion.scaleTo], Extrapolation.CLAMP) }] }));

  const undo = () => {
    if (state.passed.length === 0) return;
    dispatch({ type: 'undo' });
    props.onUndo();
    if (reduceMotion) {
      opacityValue.value = 0;
      opacityValue.value = withTiming(1, { duration: swipeTokens.motion.reducedFadeDurationMs });
    } else {
      translateX.value = -cardWidth * 2;
      translateX.value = withSpring(0, { stiffness: swipeTokens.motion.springStiffness, damping: swipeTokens.motion.springDamping, overshootClamping: true });
    }
  };

  const closeCooking = () => {
    dispatch({ type: 'cancellationRecovery' });
    resetMotion();
  };

  const confirmCooking = async () => {
    if (!state.pendingCook) return;
    setSaving(true);
    try {
      await props.onCook(state.pendingCook, servingsMade, servingsEaten);
      dispatch({ type: 'confirmCooked' });
      resetMotion();
    } finally {
      setSaving(false);
    }
  };

  if (!top) {
    return <EmptyDeck onRefresh={props.onRefresh} onManual={props.onManual} onUndo={undo} canUndo={state.passed.length > 0} />;
  }

  const budget = props.targetCalories !== null && props.consumedCalories !== null
    ? evaluateMealBudget(props.targetCalories, props.consumedCalories, top.kcalPerServing)
    : null;
  const provenance = nutritionProvenanceForSuggestion(top, props.canonicals);

  return <View style={styles.root} onLayout={(event) => setCardWidth(event.nativeEvent.layout.width)}>
    <View style={styles.stack}>
      {behind ? <Animated.View style={[styles.layer, behindStyle]} pointerEvents="none"><MealSwipeCard meal={behind} translateX={behindTranslateX} cardWidth={cardWidth} budget={null} provenance={nutritionProvenanceForSuggestion(behind, props.canonicals)} elevationLevel={1} onHandCanonicalIds={props.onHandCanonicalIds} /></Animated.View> : null}
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.layer, topStyle]}><MealSwipeCard meal={top} translateX={translateX} cardWidth={cardWidth} budget={budget} provenance={provenance} onHandCanonicalIds={props.onHandCanonicalIds} /></Animated.View>
      </GestureDetector>
    </View>
    <SwipeActionBar
      onPass={() => commit('left')}
      onDetails={finishAccept}
      onCook={() => commit('right')}
      onUndo={undo}
      canUndo={state.passed.length > 0}
      reduceMotion={reduceMotion}
    />
    <DeckCountIndicator remaining={state.meals.length} />
    <MealDetailSheet meal={state.pendingCook} canonicals={props.canonicals} onPass={() => { closeCooking(); commit('left'); }} servingsMade={servingsMade} servingsEaten={servingsEaten} saving={saving} onServingsMade={setServingsMade} onServingsEaten={setServingsEaten} onClose={closeCooking} onCook={() => void confirmCooking()} />
  </View>;
}

const styles = StyleSheet.create({
  root: { gap: space.base },
  stack: { height: layout.nutritionChartHeight + space.xxxl * 2, position: 'relative' },
  layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: space.base },
});
