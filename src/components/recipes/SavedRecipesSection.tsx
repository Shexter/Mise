import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, Divider } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Caption, RowTitle } from '@/components/Type';
import { color, layout, opacity, space } from '@/constants/theme';
import type { Recipe } from '@/types';

interface Props {
  recipes: readonly Recipe[];
  showHeaderAction?: boolean;
}

/** One saved-recipe collection UI, shared by Pantry and the legacy route. */
export function SavedRecipesSection({ recipes, showHeaderAction = true }: Props) {
  const router = useRouter();
  return (
    <View style={styles.section}>
      {showHeaderAction ? (
        <View style={styles.actions}>
          <RowTitle>Saved recipes</RowTitle>
          <Pressable
            onPress={() => router.push('/recipe-intake')}
            accessibilityRole="button"
            accessibilityLabel="Save a recipe"
            style={styles.add}
          >
            <Feather name="plus" size={22} color={color.ink} />
          </Pressable>
        </View>
      ) : null}
      {recipes.length === 0 ? (
        <EmptyState
          title="Save a recipe you found"
          detail="Bring a caption, a link, or a screenshot. Mise keeps the source alongside your ingredients."
          actionLabel="Save a recipe"
          onAction={() => router.push('/recipe-intake')}
        />
      ) : (
        <Card padded={false}>
          {recipes.map((recipe, index) => (
            <View key={recipe.id}>
              {index > 0 ? <Divider /> : null}
              <Pressable
                onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: recipe.id } })}
                accessibilityRole="button"
                accessibilityLabel={recipe.title}
                accessibilityHint="Opens recipe details and pantry coverage."
                style={({ pressed }) => [styles.row, pressed && { opacity: opacity.pressed }]}
              >
                <View style={styles.text}>
                  <RowTitle>{recipe.title}</RowTitle>
                  <Caption muted>{recipe.status === 'awaiting_content' ? 'Needs ingredients' : recipe.sourceLink ? 'Source saved' : 'No source link'}</Caption>
                </View>
                <Feather name="chevron-right" size={18} color={color.muted} />
              </Pressable>
            </View>
          ))}
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.base },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  add: { width: layout.minTouchTarget, height: layout.minTouchTarget, alignItems: 'center', justifyContent: 'center' },
  row: { minHeight: layout.minRowHeight, paddingHorizontal: layout.cardPadding, paddingVertical: space.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  text: { flex: 1, gap: space.xs },
});
