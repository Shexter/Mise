import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { looksLikeApiKey, setApiKey } from '@/api/keyStore';
import { VisionError, verifyApiKey } from '@/api/vision';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Body, Caption } from '@/components/Type';
import { color, opacity, space } from '@/constants/theme';

const CONSOLE_URL = 'https://console.anthropic.com/settings/keys';
const GEMINI_CONSOLE_URL = 'https://aistudio.google.com/apikey';

type TestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'passed' }
  | { status: 'failed'; message: string };

interface Props {
  /** Called once a key has been stored, whether or not it was tested. */
  onSaved: () => void;
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

  const shaped = looksLikeApiKey(value);

  const runTest = async () => {
    setTest({ status: 'testing' });
    try {
      await setApiKey(value);
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
              ? 'The key works, but the account has no API credits. Add credits at console.anthropic.com → Plans & Billing.'
              : `Test failed — kind: ${kind}. ${detail}`,
      });
    }
  };

  const save = async () => {
    await setApiKey(value);
    onSaved();
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
        placeholder="sk-ant-… or a Google AI key"
        secureTextEntry
        autoFocus
        hint={
          shaped || value.length === 0
            ? 'Anthropic or Google Gemini. Stored in this phone’s keychain; it never leaves the device except to call that provider.'
            : undefined
        }
        error={
          value.length > 0 && !shaped
            ? 'That doesn’t look like an Anthropic (sk-ant-…) or Google AI key.'
            : undefined
        }
      />

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
            Snap calls the provider directly from your phone with your own key —
            no server in between. Use an Anthropic key, or a Google AI (Gemini)
            key, which has a free tier. Create one, copy it once, and paste it
            here.
          </Body>
          <Button
            label="Anthropic console"
            variant="secondary"
            onPress={() => void Linking.openURL(CONSOLE_URL)}
          />
          <Button
            label="Google AI Studio (free)"
            variant="secondary"
            onPress={() => void Linking.openURL(GEMINI_CONSOLE_URL)}
          />
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
