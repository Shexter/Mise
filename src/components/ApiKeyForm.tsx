import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { looksLikeApiKey, PROVIDERS, providerForKey, setApiKey, setOpenAIEndpoint } from '@/api/keyStore';
import { VisionError, verifyApiKey } from '@/api/vision';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Body, Caption } from '@/components/Type';
import { color, opacity, space } from '@/constants/theme';

type TestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'passed' }
  | { status: 'failed'; message: string };

interface Props {
  /** Called once a key has been stored, whether or not it was tested. */
  onSaved: () => void | Promise<void>;
  saveLabel?: string;
}

/**
 * Key entry, shared by onboarding and Settings. The key goes straight to
 * `keyStore` and is never lifted into component state beyond this form.
 */
export function ApiKeyForm({ onSaved, saveLabel = 'Save key' }: Props) {
  const [value, setValue] = useState('');
  const [test, setTest] = useState<TestState>({ status: 'idle' });
  const [helpOpen, setHelpOpen] = useState(false);
  const [endpoint, setEndpoint] = useState('');

  const shaped = looksLikeApiKey(value);
  const provider = providerForKey(value);
  const isOpenAI = provider === 'openai';
  const providers = Object.values(PROVIDERS);
  const keyFormats = providers.map((provider) => provider.keyFormat).join(', ');
  const providerNames = providers.map((provider) => provider.displayName).join(', ');
  const freeProvider = providers.find((provider) => provider.freeTier);

  const runTest = async () => {
    setTest({ status: 'testing' });
    try {
      await setApiKey(value);
      if (isOpenAI) await setOpenAIEndpoint(endpoint);
      await verifyApiKey();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTest({ status: 'passed' });
    } catch (error) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      // Surface the underlying cause instead of one blanket message — the kind
      // and the raw error tell network apart from timeout apart from a bad key.
      const kind = error instanceof VisionError ? error.kind : 'unknown';
      const detail =
        error instanceof Error ? error.message : String(error);
      setTest({
        status: 'failed',
        message:
          kind === 'unauthorized'
            ? 'That key was rejected. Check you copied all of it.'
            : kind === 'billing'
              ? `The key works, but the account has no API credits. Add credits at ${provider ? PROVIDERS[provider].billingLocation : 'your provider’s billing page'}.`
              : `Test failed — kind: ${kind}. ${detail}`,
      });
    }
  };

  const save = async () => {
    await setApiKey(value);
    if (isOpenAI) await setOpenAIEndpoint(endpoint);
    await onSaved();
  };

  return (
    <View style={styles.root}>
      <Field
        value={value}
        onChangeText={(next) => {
          setValue(next);
          setTest({ status: 'idle' });
        }}
        label="API key"
        placeholder={keyFormats}
        secureTextEntry
        autoFocus
        hint={
          shaped || value.length === 0
            ? `${providerNames}. Stored in this phone’s keychain; it never leaves the device except to call that provider.`
            : undefined
        }
        error={
          value.length > 0 && !shaped
            ? `That key was not recognised. Use ${keyFormats}.`
            : undefined
        }
      />
      {isOpenAI ? (
        <Field
          value={endpoint}
          onChangeText={setEndpoint}
          label="OpenAI endpoint (optional)"
          placeholder="https://api.openai.com/v1"
          hint="Leave blank for OpenAI’s standard endpoint. This is saved locally and is not tested here."
        />
      ) : null}

      <Pressable
        onPress={() => setHelpOpen((open) => !open)}
        accessibilityRole="button"
        accessibilityLabel="Where do I get this?"
        accessibilityState={{ expanded: helpOpen }}
        style={({ pressed }) => [
          styles.help,
          pressed && { opacity: opacity.pressed },
        ]}
      >
        <Body>Where do I get this?</Body>
        <Feather
          name={helpOpen ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={color.muted}
        />
      </Pressable>

      {helpOpen ? (
        <View style={styles.helpBody}>
          <Body muted>
            Mise calls the provider directly from your phone with your own key —
            no server in between. Create a key, copy it once, and paste it here.
            {freeProvider ? ` ${freeProvider.displayName} has a free tier.` : ''}
          </Body>
          {providers.map((provider) => (
            <Button
              key={provider.displayName}
              label={`${provider.displayName}${provider.freeTier ? ' (free tier)' : ''}`}
              variant="secondary"
              onPress={() => void Linking.openURL(provider.consoleUrl)}
            />
          ))}
        </View>
      ) : null}

      {test.status === 'passed' ? (
        <Caption style={styles.passed}>Key works.</Caption>
      ) : test.status === 'failed' ? (
        <Caption style={styles.failed}>{test.message}</Caption>
      ) : null}

      <View style={styles.actions}>
        <Button
          label="Test key"
          variant="secondary"
          onPress={() => void runTest()}
          disabled={!shaped}
          loading={test.status === 'testing'}
        />
        <Button
          label={saveLabel}
          onPress={() => void save()}
          disabled={!shaped || test.status === 'testing'}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.base },
  help: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  helpBody: { gap: space.md },
  actions: { gap: space.sm },
  passed: { color: color.olive },
  failed: { color: color.paprika },
});
