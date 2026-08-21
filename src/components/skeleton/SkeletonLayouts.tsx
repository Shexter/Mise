import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/Card';
import { Skeleton, SkeletonLine, SkeletonText } from '@/components/Skeleton';
import { color, layout, macroColor, radius, space } from '@/constants/theme';

export function NutritionSkeleton() {
  return (
    <Card title="Nutrition">
      <View style={styles.nutritionTotal}>
        <Skeleton width={112} height={32} />
        <SkeletonText width={56} />
      </View>
      <View style={styles.macroRows}>
        {(['protein', 'carbs', 'fat'] as const).map((macro) => (
          <View key={macro} style={styles.macroRow}>
            <View style={[styles.dot, { backgroundColor: macroColor[macro] }]} />
            <SkeletonText width={72} />
            <SkeletonLine width="42%" />
          </View>
        ))}
      </View>
    </Card>
  );
}

export function MealSuggestionSkeleton() {
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel="Loading meal suggestions" accessibilityState={{ busy: true }}>
      <View style={styles.suggestionCard}>
        <View style={styles.suggestionHeader}>
          <Skeleton width={92} height={space.lg} radius={radius.full} />
          <SkeletonText width={72} />
        </View>
        <Skeleton width="78%" height={32} />
        <View style={styles.chips}>
          <Skeleton width={84} height={space.lg} radius={radius.full} />
          <Skeleton width={76} height={space.lg} radius={radius.full} />
          <Skeleton width={64} height={space.lg} radius={radius.full} />
        </View>
        <SkeletonLine width="55%" />
        <SkeletonLine width="88%" />
      </View>
    </View>
  );
}

export function ReviewSkeleton({ onDark = false, label = 'Analyzing nutrition data' }: { onDark?: boolean; label?: string }) {
  return (
    <View style={[styles.review, onDark && styles.reviewDark]} accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityState={{ busy: true }}>
      <Skeleton onDark={onDark} width="42%" height={28} />
      <View style={styles.reviewGrid}>
        <Skeleton onDark={onDark} width="100%" height={88} />
        <Skeleton onDark={onDark} width="100%" height={88} />
      </View>
      <SkeletonLine onDark={onDark} width="82%" />
      <SkeletonLine onDark={onDark} width="64%" />
      <SkeletonLine onDark={onDark} width="74%" />
    </View>
  );
}

export function ReceiptReviewSkeleton() {
  return (
    <View style={styles.receipt} accessible accessibilityRole="progressbar" accessibilityLabel="Loading receipt review" accessibilityState={{ busy: true }}>
      <Skeleton width="58%" height={28} />
      <SkeletonText width="38%" />
      {[0, 1, 2, 3, 4].map((row) => (
        <View key={row} style={styles.receiptRow}>
          <SkeletonText width={row % 2 === 0 ? '52%' : '66%'} />
          <SkeletonText width="18%" />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  nutritionTotal: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  macroRows: { marginTop: space.lg, gap: space.md },
  macroRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: space.sm, height: space.sm, borderRadius: radius.full },
  suggestionCard: {
    minHeight: 280,
    padding: space.lg,
    gap: space.lg,
    borderRadius: radius.card,
    backgroundColor: color.surface,
  },
  suggestionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chips: { flexDirection: 'row', gap: space.sm },
  review: { padding: layout.cardPadding, gap: space.lg },
  reviewDark: { backgroundColor: 'transparent' },
  reviewGrid: { flexDirection: 'row', gap: space.md },
  receipt: { width: '100%', padding: layout.cardPadding, gap: space.lg },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: layout.minRowHeight, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.line },
});
