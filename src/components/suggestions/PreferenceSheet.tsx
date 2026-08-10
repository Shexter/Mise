import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { ChoiceList, Segmented } from '@/components/Choice';
import { Sheet } from '@/components/Sheet';
import { Body, SectionLabel } from '@/components/Type';
import { SUGGESTION_INTENT_POLICIES, SUGGESTION_SPEED_POLICIES } from '@/logic/suggestionTemplates';
import type { SuggestionBaseIntent, SuggestionPrepSpeed, TonightSuggestionPreference } from '@/types';

const INTENT_OPTIONS = Object.values(SUGGESTION_INTENT_POLICIES).map((policy) => ({
  value: policy.id,
  label: policy.label,
  detail: policy.description,
}));

const SPEED_OPTIONS = Object.values(SUGGESTION_SPEED_POLICIES).map((policy) => ({
  value: policy.id,
  label: policy.label,
}));

interface Props {
  visible: boolean;
  preference: TonightSuggestionPreference;
  recommendedIntent: SuggestionBaseIntent;
  onClose: () => void;
  onSave: (intent: SuggestionBaseIntent, speed: SuggestionPrepSpeed) => void;
  onUseRecommended: () => void;
}

/** Secondary tonight-only control: a recommendation first, tuning when wanted. */
export function SuggestionPreferenceSheet({
  visible,
  preference,
  recommendedIntent,
  onClose,
  onSave,
  onUseRecommended,
}: Props) {
  const [baseIntent, setBaseIntent] = useState(preference.baseIntent);
  const [prepSpeed, setPrepSpeed] = useState(preference.prepSpeed);

  useEffect(() => {
    if (!visible) return;
    setBaseIntent(preference.baseIntent);
    setPrepSpeed(preference.prepSpeed);
  }, [visible, preference]);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Tune dinner"
      footer={<Button label="Apply dinner preferences" onPress={() => onSave(baseIntent, prepSpeed)} />}
    >
      <Body>Choose what matters most tonight. These choices shape suggestions, not your targets.</Body>
      <View>
        <SectionLabel muted>Tonight’s focus</SectionLabel>
        <ChoiceList
          options={INTENT_OPTIONS}
          value={baseIntent}
          onChange={setBaseIntent}
        />
      </View>
      <View>
        <SectionLabel muted>Prep speed</SectionLabel>
        <Segmented options={SPEED_OPTIONS} value={prepSpeed} onChange={setPrepSpeed} />
      </View>
      <Button
        label={`Use recommended: ${SUGGESTION_INTENT_POLICIES[recommendedIntent].label}`}
        variant="ghost"
        onPress={onUseRecommended}
      />
    </Sheet>
  );
}
