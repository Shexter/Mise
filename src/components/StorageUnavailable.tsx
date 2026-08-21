import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Body, ScreenTitle } from '@/components/Type';
import { color, layout, space } from '@/constants/theme';
import type { DatabaseReadiness } from '@/db/readiness';

export function StorageUnavailable({ readiness, onRetry }: { readiness: DatabaseReadiness; onRetry: () => void }) {
  return <View style={styles.root} accessibilityRole="alert">
    <ScreenTitle>Storage is unavailable</ScreenTitle>
    <Body muted>Mise could not open its on-device database. Your data has not been replaced. Try opening it again.</Body>
    <Button label={readiness.phase === 'opening' ? 'Trying again…' : 'Retry'} disabled={readiness.phase === 'opening'} onPress={onRetry} />
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', gap: space.base, paddingHorizontal: layout.screenGutter, backgroundColor: color.ground },
});
