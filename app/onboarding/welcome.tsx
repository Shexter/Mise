import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Sheet } from '@/components/Sheet';
import { StepShell } from '@/components/StepShell';
import { Body, Caption, RowTitle } from '@/components/Type';
import { color, opacity, radius, space } from '@/constants/theme';
import { ONBOARDING_ENTRY_ROUTES, useOnboardingStore } from '@/store/onboardingStore';
import type { OnboardingIntent, TargetSource } from '@/types';

const SOURCE_LABEL: Readonly<Record<TargetSource, string>> = {
  estimated: 'Basic calculation',
  dexa: 'DEXA or InBody report',
  inbody: 'DEXA or InBody report',
  stated: 'Known calorie target',
};

export default function Welcome() {
  const router = useRouter();
  const [startingPoint, setStartingPoint] = useState<OnboardingIntent>('calories');
  const [targetSource, setTargetSource] = useState<TargetSource>('estimated');
  const [methodSheetOpen, setMethodSheetOpen] = useState(false);
  const set = useOnboardingStore((state) => state.set);
  const selectStartingPoint = useOnboardingStore((state) => state.selectStartingPoint);
  const setMeasuredFlowOrigin = useOnboardingStore((state) => state.setMeasuredFlowOrigin);

  const continueSetup = () => {
    selectStartingPoint(startingPoint);
    if (startingPoint === 'meal_prep') {
      router.push('/onboarding/dietary');
      return;
    }

    if (targetSource === 'dexa' || targetSource === 'inbody') {
      setMeasuredFlowOrigin('onboarding');
    }
    set({ targetSource });
    router.push(ONBOARDING_ENTRY_ROUTES[targetSource]);
  };

  const chooseMethod = (source: TargetSource) => {
    setTargetSource(source);
    setStartingPoint('calories');
    setMethodSheetOpen(false);
  };

  return (
    <>
      <StepShell
        step="welcome"
        showBack={false}
        title="Where would you like to start?"
        detail="Choose what would be most useful right now. You can set up the other next."
        primaryLabel="Continue"
        onPrimary={continueSetup}
      >
        <View style={styles.cards}>
          <StartingPointCard
            intent="calories"
            selected={startingPoint === 'calories'}
            icon="activity"
            title="Daily calorie & macro target"
            onSelect={() => setStartingPoint('calories')}
            methodLabel={SOURCE_LABEL[targetSource]}
            onChooseMethod={() => {
              setStartingPoint('calories');
              setMethodSheetOpen(true);
            }}
          />
          <StartingPointCard
            intent="meal_prep"
            selected={startingPoint === 'meal_prep'}
            icon="coffee"
            title="Kitchen & meal prep"
            onSelect={() => setStartingPoint('meal_prep')}
          />
        </View>
      </StepShell>

      <Sheet
        visible={methodSheetOpen}
        onClose={() => setMethodSheetOpen(false)}
        title="How should we set your target?"
      >
        <MethodRow
          label="Basic calculation"
          detail="Use age, sex, height, weight and activity"
          selected={targetSource === 'estimated'}
          onPress={() => chooseMethod('estimated')}
        />
        <MethodRow
          label="Scan a body composition report"
          detail="DEXA or InBody"
          selected={targetSource === 'dexa' || targetSource === 'inbody'}
          onPress={() => chooseMethod('dexa')}
        />
        <MethodRow
          label="Enter a known calorie target"
          detail="Use an exact daily calorie goal or resting BMR"
          selected={targetSource === 'stated'}
          onPress={() => chooseMethod('stated')}
        />
        <Caption muted>
          Your diary stays on this phone, with no Mise account or server. A report
          you choose to analyse is sent to the provider for your own API key.
        </Caption>
      </Sheet>
    </>
  );
}

function StartingPointCard({
  intent,
  selected,
  icon,
  title,
  onSelect,
  methodLabel,
  onChooseMethod,
}: {
  intent: OnboardingIntent;
  selected: boolean;
  icon: keyof typeof Feather.glyphMap;
  title: string;
  onSelect: () => void;
  methodLabel?: string;
  onChooseMethod?: () => void;
}) {
  return (
    <View style={[styles.card, selected && styles.cardSelected]}>
      <Pressable
        onPress={onSelect}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={title}
        testID={`starting-point-${intent}`}
        style={({ pressed }) => [styles.cardChoice, pressed && { opacity: opacity.pressed }]}
      >
        <View style={[styles.check, selected && styles.checkSelected]}>
          {selected ? <Feather name="check" size={18} color={color.onAction} /> : null}
        </View>
        <View style={styles.illustrationSlot}>
          <Feather name={icon} size={64} color={selected ? color.action : color.muted} />
        </View>
        <RowTitle style={styles.cardTitle}>{title}</RowTitle>
      </Pressable>
      {methodLabel && onChooseMethod ? (
        <Pressable
          onPress={onChooseMethod}
          accessibilityRole="button"
          accessibilityLabel={`Calorie target method: ${methodLabel}`}
          accessibilityHint="Choose a different method"
          style={({ pressed }) => [styles.methodButton, pressed && { opacity: opacity.pressed }]}
        >
          <Caption style={styles.methodText}>{methodLabel}</Caption>
          <Feather name="chevron-right" size={16} color={color.action} />
        </Pressable>
      ) : (
        <View style={styles.methodSpacer} />
      )}
    </View>
  );
}

function MethodRow({
  label,
  detail,
  selected,
  onPress,
}: {
  label: string;
  detail: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      style={({ pressed }) => [
        styles.methodRow,
        selected && styles.methodRowSelected,
        pressed && { opacity: opacity.pressed },
      ]}
    >
      <View style={styles.methodCopy}>
        <Body>{label}</Body>
        <Caption muted>{detail}</Caption>
      </View>
      {selected ? <Feather name="check" size={20} color={color.action} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cards: { flexDirection: 'row', gap: space.md },
  card: {
    flex: 1,
    minWidth: 0,
    backgroundColor: color.surface,
    borderWidth: 1.5,
    borderColor: color.line,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  cardSelected: { borderColor: color.action },
  cardChoice: { flex: 1, minHeight: 240, padding: space.md },
  check: {
    width: 28,
    height: 28,
    borderRadius: radius.input,
    borderWidth: 1.5,
    borderColor: color.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkSelected: { backgroundColor: color.action, borderColor: color.action },
  illustrationSlot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { textAlign: 'center', fontWeight: '600' },
  methodButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    borderTopWidth: 1,
    borderTopColor: color.line,
  },
  methodText: { color: color.action, textAlign: 'center', flexShrink: 1 },
  methodSpacer: { height: 48 },
  methodRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.base,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.input,
  },
  methodRowSelected: { borderColor: color.action },
  methodCopy: { flex: 1, gap: space.xs },
});
