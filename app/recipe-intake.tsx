import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { extractCapture } from '@/api/capture';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { useToast } from '@/components/Toast';
import { Body, Caption, ScreenTitle } from '@/components/Type';
import { space } from '@/constants/theme';
import {
  saveLinkAwaitingContent,
  saveRecipeFromCapture,
  saveRecipeFromText,
  splitSharedPayload,
  type SavedRecipeResult,
} from '@/logic/recipeIntake';
import { deletePhoto, preparePhoto } from '@/media/photos';

/** One user-supplied payload: URL, text, a share-sheet text payload, or a screenshot. */
export default function RecipeIntakeScreen() {
  const router = useRouter();
  const toast = useToast();
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [reading, setReading] = useState(false);
  const busy = saving || reading;

  const openSaved = (result: SavedRecipeResult) => {
    toast.show({
      kind: 'success',
      message: result.confirmations > 0
        ? `Recipe saved. ${result.confirmations} ingredient${result.confirmations === 1 ? '' : 's'} needs a match check.`
        : 'Recipe saved.',
    });
    router.replace({ pathname: '/recipe/[id]', params: { id: result.recipe.id } });
  };

  const save = async () => {
    if (busy) return;
    const { link, content } = splitSharedPayload(input);
    if (!link && !content) return;
    setSaving(true);
    try {
      // A link is still worth filing when a platform shared no caption. There
      // is intentionally no fetch, preview request, or platform API call here.
      if (link && !content) {
        const recipe = await saveLinkAwaitingContent(link);
        toast.show({ message: 'Link saved. Paste the ingredients or add a screenshot when you have them.' });
        router.replace({ pathname: '/recipe/[id]', params: { id: recipe.id } });
        return;
      }
      openSaved(await saveRecipeFromText(content, link));
    } catch (error) {
      toast.show({ message: error instanceof Error ? error.message : 'That recipe could not be saved.' });
    } finally {
      setSaving(false);
    }
  };

  /**
   * The screenshot route. It picks from the library because that is where a
   * screenshot lives, then hands the image to the same capture extraction
   * the pantry uses — there is deliberately no second image pipeline here.
   * Any link already typed above is kept, so a shared post keeps its
   * attribution even when its ingredients arrived as a picture.
   */
  const useScreenshot = async () => {
    if (busy) return;
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    const asset = picked.assets?.[0];
    if (picked.canceled || !asset) return;
    setReading(true);
    let imageUri: string | null = null;
    try {
      const prepared = await preparePhoto(
        { uri: asset.uri, width: asset.width, height: asset.height },
        'recipes',
      );
      imageUri = prepared.uri;
      const { link } = splitSharedPayload(input);
      const capture = await extractCapture(prepared.base64);
      const result = await saveRecipeFromCapture({ capture, imageUri: prepared.uri, link });
      if (result.recipe.status === 'awaiting_content') {
        toast.show({ message: 'No ingredient list was readable there. The screenshot was kept — paste the ingredients when you can.' });
        router.replace({ pathname: '/recipe/[id]', params: { id: result.recipe.id } });
        return;
      }
      openSaved(result);
    } catch (error) {
      if (imageUri) deletePhoto(imageUri);
      toast.show({
        kind: 'recoverable-error',
        message: error instanceof Error ? error.message : 'That screenshot could not be read.',
      });
    } finally {
      setReading(false);
    }
  };

  return (
    <Screen scroll footer={<Button label="Save recipe" loading={saving} disabled={busy || !input.trim()} onPress={() => void save()} />}>
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
        <View style={styles.alternative}>
          <Caption muted>Got a screenshot of the ingredients instead?</Caption>
          <Button
            label="Read a screenshot"
            variant="secondary"
            loading={reading}
            disabled={busy}
            onPress={() => void useScreenshot()}
          />
        </View>
        <Caption muted>Only the text or screenshot you provide is sent to your configured extraction provider.</Caption>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: space.base, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  content: { gap: space.base, marginTop: space.lg },
  alternative: { gap: space.sm },
});
