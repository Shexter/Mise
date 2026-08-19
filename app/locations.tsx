import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card, Divider } from '@/components/Card';
import { ChoiceList, Segmented } from '@/components/Choice';
import { Field } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { useToast } from '@/components/Toast';
import { Caption, RowTitle, ScreenTitle, SectionLabel } from '@/components/Type';
import { color, layout, opacity, space } from '@/constants/theme';
import { capitalise } from '@/logic/dates';
import { usePantryStore } from '@/store/pantryStore';
import { LOCATION_KINDS, type Location, type LocationKind } from '@/types';

const KIND_OPTIONS = LOCATION_KINDS.map((kind) => ({
  value: kind,
  label: kind === 'ambient' ? 'Cupboard' : capitalise(kind),
}));

/**
 * Storage location management (decision 16): rename, add, remove. Removing
 * a location never deletes its items — the user picks where they now live.
 */
export default function LocationsScreen() {
  const toast = useToast();
  const locations = usePantryStore((state) => state.locations);
  const refresh = usePantryStore((state) => state.refresh);
  const add = usePantryStore((state) => state.addLocation);
  const rename = usePantryStore((state) => state.renameLocation);
  const remove = usePantryStore((state) => state.removeLocation);

  const [editing, setEditing] = useState<Location | null>(null);
  const [editName, setEditName] = useState('');
  const [removing, setRemoving] = useState<Location | null>(null);
  const [addingName, setAddingName] = useState('');
  const [addingKind, setAddingKind] = useState<LocationKind>('ambient');

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onRename = () => {
    const target = editing;
    const name = editName.trim();
    setEditing(null);
    if (!target || name.length === 0 || name === target.name) return;
    void rename(target.id, name);
  };

  const onAdd = () => {
    const name = addingName.trim();
    if (name.length === 0) return;
    setAddingName('');
    void add(name, addingKind).then(() => {
      toast.show({ message: `${name} added.` });
    });
  };

  const onReassign = (destination: Location) => {
    const target = removing;
    setRemoving(null);
    if (!target) return;
    void remove(target.id, destination.id).then(() => {
      toast.show({
        message: `${target.name} removed — items moved to ${destination.name}.`,
      });
    });
  };

  return (
    <Screen scroll>
      <View style={styles.sections}>
      <ScreenTitle>Storage spots</ScreenTitle>
      <Caption muted>
        Name them the way your kitchen works. The type decides how long food
        keeps there.
      </Caption>

      <Card padded={false}>
        {locations.map((location, index) => (
          <View key={location.id}>
            {index > 0 ? <Divider /> : null}
            <View style={styles.row}>
              <Pressable
                onPress={() => {
                  setEditing(location);
                  setEditName(location.name);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Rename ${location.name}`}
                style={({ pressed }) => [
                  styles.rowMain,
                  pressed && { opacity: opacity.pressed },
                ]}
              >
                <RowTitle>{location.name}</RowTitle>
                <Caption muted>
                  {KIND_OPTIONS.find((k) => k.value === location.kind)?.label}
                </Caption>
              </Pressable>
              {locations.length > 1 ? (
                <Pressable
                  onPress={() => setRemoving(location)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${location.name}`}
                  hitSlop={space.sm}
                  style={({ pressed }) => [
                    styles.removeButton,
                    pressed && { opacity: opacity.pressed },
                  ]}
                >
                  <Feather name="x" size={18} color={color.muted} />
                </Pressable>
              ) : null}
            </View>
          </View>
        ))}
      </Card>

      <View style={styles.addBlock}>
        <SectionLabel muted>Add a spot</SectionLabel>
        <Field
          value={addingName}
          onChangeText={setAddingName}
          placeholder="e.g. Chest freezer"
        />
        <Segmented
          options={KIND_OPTIONS}
          value={addingKind}
          onChange={setAddingKind}
        />
        <Button
          label="Add"
          onPress={onAdd}
          disabled={addingName.trim().length === 0}
        />
      </View>
      </View>

      <Sheet
        visible={editing !== null}
        onClose={() => setEditing(null)}
        title="Rename"
        footer={<Button label="Save" onPress={onRename} />}
      >
        <Field value={editName} onChangeText={setEditName} autoFocus />
      </Sheet>

      <Sheet
        visible={removing !== null}
        onClose={() => setRemoving(null)}
        title={`Remove ${removing?.name ?? ''}`}
      >
        <Caption muted>
          Anything stored there moves to the spot you pick. Nothing is
          deleted.
        </Caption>
        <ChoiceList
          options={locations
            .filter((location) => location.id !== removing?.id)
            .map((location) => ({
              value: location.id,
              label: location.name,
            }))}
          value={null}
          onChange={(id) => {
            const destination = locations.find((l) => l.id === id);
            if (destination) onReassign(destination);
          }}
        />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sections: { marginTop: space.base, gap: space.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: space.md,
  },
  rowMain: {
    flex: 1,
    minHeight: layout.minRowHeight,
    paddingHorizontal: layout.cardPadding,
    paddingVertical: space.md,
    justifyContent: 'center',
    gap: space.xs,
  },
  removeButton: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBlock: { gap: space.sm },
});
