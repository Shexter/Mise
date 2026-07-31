import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Body, RowTitle } from '@/components/Type';
import { space } from '@/constants/theme';

interface Props {
  title: string;
  detail?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Empty states are invitations with an action, not decoration. */
export function EmptyState({ title, detail, actionLabel, onAction }: Props) {
  return (
    <View style={styles.root}>
      <RowTitle>{title}</RowTitle>
      {detail ? (
        <Body muted style={styles.detail}>
          {detail}
        </Body>
      ) : null}
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          block={false}
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', paddingVertical: space.xl, gap: space.sm },
  detail: { textAlign: 'center' },
  action: { marginTop: space.md },
});
