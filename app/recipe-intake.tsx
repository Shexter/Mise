import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { extractRecipe } from '@/api/recipe';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { useToast } from '@/components/Toast';
import { Body, Caption, ScreenTitle } from '@/components/Type';
import { space } from '@/constants/theme';
import { insertRecipe } from '@/db/queries';
import { resolveIngredientReferences } from '@/logic/resolution';

/** One user-supplied payload: URL, text, or a share-sheet text payload. */
export default function RecipeIntakeScreen() {
  const router = useRouter();
  const toast = useToast();
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const supplied = input.trim();
    if (!supplied || saving) return;
    setSaving(true);
    try {
      const link = sourceLinkFrom(supplied);
      const content = link ? supplied.replace(link, '').trim() : supplied;
      // A link is still worth filing when a platform shared no caption. There
      // is intentionally no fetch, preview request, or platform API call here.
      if (link && !content) {
        const recipe = await insertRecipe({
          title: 'Recipe to add later', sourceLink: link, status: 'awaiting_content',
        });
        toast.show({ message: 'Link saved. Paste the ingredients when you have them.' });
        router.replace({ pathname: '/recipe/[id]', params: { id: recipe.id } });
        return;
      }

      const extracted = await extractRecipe(content);
      const outcomes = await resolveIngredientReferences(
        extracted.ingredients.map((ingredient) => ({ raw: ingredient.name })),
        'user',
      );
      const recipe = await insertRecipe({
        title: extracted.title,
        sourceLink: link,
        steps: extracted.steps,
        ingredients: extracted.ingredients.map((ingredient, index) => {
          const outcome = outcomes[index];
          return {
            ...ingredient,
            canonicalId: outcome?.status === 'resolved' ? outcome.canonicalId : null,
          };
        }),
      });
      const confirmations = outcomes.filter((outcome) => outcome?.status === 'needs_confirmation').length;
      toast.show({
        kind: 'success',
        message: confirmations > 0
          ? `Recipe saved. ${confirmations} ingredient${confirmations === 1 ? '' : 's'} needs a match check.`
          : 'Recipe saved.',
      });
      router.replace({ pathname: '/recipe/[id]', params: { id: recipe.id } });
    } catch (error) {
      toast.show({ message: error instanceof Error ? error.message : 'That recipe could not be saved.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scroll footer={<Button label="Save recipe" loading={saving} disabled={!input.trim()} onPress={() => void save()} />}>
      <View style={styles.header}>
        <ScreenTitle>Save a recipe</ScreenTitle>
        <Button label="Close" variant="ghost" block={false} onPress={() => router.back()} />
      </View>
      <View style={styles.content}>
        <Body>Paste a recipe caption, notes, or a shared link. Mise never opens or requests the link.</Body>
        <Field
          label="Recipe text or link"
          value={input}
          onChangeText={setInput}
          multiline
          autoFocus
          placeholder="Paste what you received…"
          hint="A link without ingredients is saved so you can fill it in later."
        />
        <Caption muted>Only the text you provide is sent to your configured extraction provider.</Caption>
      </View>
    </Screen>
  );
}

function sourceLinkFrom(input: string): string | null {
  const match = input.match(/https?:\/\/[^\s]+/i);
  if (!match) return null;
  try {
    const url = new URL(match[0]);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

const styles = StyleSheet.create({
  header: { marginTop: space.base, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  content: { gap: space.base, marginTop: space.lg },
});
