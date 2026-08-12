import { reloadAppAsync } from 'expo';
import { useEffect, useState } from 'react';

import { ChoiceList } from '@/components/Choice';
import { Sheet } from '@/components/Sheet';
import { Body } from '@/components/Type';
import { themeOptions, type ThemeId } from '@/constants/themePalettes';
import { writeThemePreference } from '@/constants/themePreference';

interface Props {
  visible: boolean;
  activeTheme: ThemeId;
  onClose: () => void;
  onError: () => void;
}

const OPTIONS = themeOptions.map(({ id, label, detail }) => ({ value: id, label, detail }));

/** Theme selection is stored locally, then a reload recreates every static StyleSheet. */
export function ThemeSheet({ visible, activeTheme, onClose, onError }: Props) {
  const [selected, setSelected] = useState(activeTheme);

  useEffect(() => setSelected(activeTheme), [activeTheme, visible]);

  const choose = async (theme: ThemeId) => {
    if (theme === activeTheme) {
      onClose();
      return;
    }
    setSelected(theme);
    try {
      writeThemePreference(theme);
      await reloadAppAsync(`Apply Mise theme: ${theme}`);
    } catch {
      try {
        writeThemePreference(activeTheme);
      } catch {
        // The visible palette remains active even if storage is unavailable.
      }
      setSelected(activeTheme);
      onError();
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Appearance">
      <Body muted>Choose a colour theme. Mise reloads once so every screen changes together.</Body>
      <ChoiceList options={OPTIONS} value={selected} onChange={(theme) => void choose(theme)} />
    </Sheet>
  );
}
