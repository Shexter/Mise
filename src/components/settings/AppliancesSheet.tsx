import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Sheet } from '@/components/Sheet';
import { Body, Caption } from '@/components/Type';
import { color, opacity, radius, space } from '@/constants/theme';
import { useCookingPreferencesStore } from '@/store/cookingPreferencesStore';
import { APPLIANCE_CATALOGUE } from '@/types';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function AppliancesSheet({ visible, onClose }: Props) {
  const ownedApplianceIds = useCookingPreferencesStore((state) => state.ownedApplianceIds);
  const setAppliance = useCookingPreferencesStore((state) => state.setAppliance);

  return (
    <Sheet visible={visible} onClose={onClose} title="Kitchen appliances">
      <Body muted>
        Select the appliances in your kitchen. Mise uses this to filter meal-prep and cooking recommendations.
      </Body>

      <View style={styles.list}>
        {APPLIANCE_CATALOGUE.map((app) => {
          const owned = ownedApplianceIds.has(app.id);
          return (
            <Pressable
              key={app.id}
              onPress={() => void setAppliance(app.id, !owned)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: owned }}
              accessibilityLabel={`${app.label}, ${owned ? 'owned' : 'not owned'}`}
              style={({ pressed }) => [
                styles.row,
                owned && styles.rowSelected,
                pressed && { opacity: opacity.pressed },
              ]}
            >
              <View style={styles.rowText}>
                <Body style={[styles.label, owned && styles.labelSelected]}>
                  {app.label}
                </Body>
                <Caption muted>{app.detail}</Caption>
              </View>
              <View style={[styles.checkbox, owned && styles.checkboxSelected]}>
                {owned ? <Feather name="check" size={16} color={color.surface} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: space.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: space.md,
    backgroundColor: color.surface,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderColor: color.line,
  },
  rowSelected: {
    borderColor: color.action,
    backgroundColor: color.surface,
  },
  rowText: {
    flex: 1,
    gap: space.xs,
    marginRight: space.md,
  },
  label: {
    fontWeight: '500',
    color: color.ink,
  },
  labelSelected: {
    color: color.action,
    fontWeight: '600',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.input,
    borderWidth: 1.5,
    borderColor: color.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface,
  },
  checkboxSelected: {
    backgroundColor: color.action,
    borderColor: color.action,
  },
});
