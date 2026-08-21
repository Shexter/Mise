import { Linking, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ProcessingIndicator } from '@/components/ProcessingIndicator';
import { Body, Caption, RowTitle, SectionLabel } from '@/components/Type';
import { space } from '@/constants/theme';
import {
  KEY_EXPLAINER,
  PROVIDER_GUIDANCE,
  PROVIDER_ORDER,
  RECOMMENDED_PROVIDER,
  REVIEWED_ON,
} from '@/copy/providerGuidance';

/** Mirrors the key-readiness controller's states (task 3.3). */
export type KeyReadiness = 'checking' | 'present' | 'missing' | 'unavailable';

interface Props {
  status: KeyReadiness;
  onSetUpKey: () => void;
  onEnterManually: () => void;
  /** Offered when readiness could not be determined, not when it says "no key". */
  onRetry?: () => void;
}

/**
 * What is shown before a report can be selected, when there is no usable key.
 *
 * The two actions carry equal weight on purpose. Manual entry is not a
 * consolation prize here — it reaches the identical result, and saying so is
 * the difference between offering a choice and steering someone into signing
 * up for a third-party account they did not want.
 *
 * The provider copy is deliberately hedged and dated: prices and free tiers
 * belong to the providers and change without telling us. See
 * `src/copy/providerGuidance.ts`.
 */
export function ApiKeyExplainer({ status, onSetUpKey, onEnterManually, onRetry }: Props) {
  if (status === 'checking') {
    return (
      <View style={styles.root}>
        <ProcessingIndicator label="Checking whether a key is set up" />
        <Button
          label="Enter values manually"
          detail="Same result, no account needed"
          variant="secondary"
          onPress={onEnterManually}
        />
      </View>
    );
  }

  const recommended = PROVIDER_GUIDANCE[RECOMMENDED_PROVIDER];

  return (
    <View style={styles.root}>
      {status === 'unavailable' ? (
        <Card>
          <RowTitle>Could not check your key</RowTitle>
          <Body muted>
            Secure storage did not answer, so we cannot tell whether a key is set
            up. That is not the same as not having one — nothing has been changed
            or removed.
          </Body>
          {onRetry ? <Button label="Try again" variant="secondary" onPress={onRetry} /> : null}
        </Card>
      ) : null}

      <Card>
        <RowTitle>Reading a report needs your own API key</RowTitle>
        <Body muted>{KEY_EXPLAINER.why}</Body>
        <Body muted>{KEY_EXPLAINER.dataPath}</Body>
        <Body muted>{KEY_EXPLAINER.reuse}</Body>
      </Card>

      <View style={styles.actions}>
        <Button label="Set up an API key" onPress={onSetUpKey} />
        <Button
          label="Enter values manually"
          detail="Same result, no account needed"
          variant="secondary"
          onPress={onEnterManually}
        />
      </View>
      <Caption muted>{KEY_EXPLAINER.manualAlways}</Caption>

      <Card>
        <SectionLabel muted>Choosing a provider</SectionLabel>
        <Body muted>{KEY_EXPLAINER.recommendation}</Body>
        {PROVIDER_ORDER.map((provider) => {
          const guidance = PROVIDER_GUIDANCE[provider];
          return (
            <View key={provider} style={styles.provider}>
              <RowTitle>
                {guidance.displayName}
                {provider === RECOMMENDED_PROVIDER ? ' · suggested' : ''}
              </RowTitle>
              <Caption muted>{guidance.setupNote}</Caption>
              <Caption muted>{guidance.costNote}</Caption>
              <Button
                label={`Open ${guidance.displayName} docs`}
                variant="ghost"
                block={false}
                onPress={() => void Linking.openURL(guidance.docsUrl)}
              />
              <Button
                label="Current pricing and limits"
                variant="ghost"
                block={false}
                onPress={() => void Linking.openURL(guidance.pricingUrl)}
              />
            </View>
          );
        })}
        <Caption muted>
          Provider details last checked on {REVIEWED_ON}. They are set by{' '}
          {recommended.displayName} and the others, not by Mise, and can change at
          any time.
        </Caption>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.base },
  actions: { gap: space.sm },
  provider: { gap: space.xs, paddingTop: space.md },
});
