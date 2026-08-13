export const THEME_IDS = ['organic', 'utility', 'cool-organic', 'test-lab', 'coolors'] as const;
export type ThemeId = typeof THEME_IDS[number];

export interface ThemePalette {
  ground: string;
  surface: string;
  ink: string;
  muted: string;
  line: string;
  action: string;
  onAction: string;
  paprika: string;
  wheat: string;
  olive: string;
}

export const DEFAULT_THEME_ID: ThemeId = 'organic';

export const themePalettes: Record<ThemeId, ThemePalette> = {
  organic: {
    ground: '#F3EDE4', surface: '#EBE3D8', ink: '#211F1D', muted: '#756F68',
    line: '#D8CEC3', action: '#A95A35', onAction: '#FFFDFC',
    paprika: '#A45239', wheat: '#B68A43', olive: '#74825F',
  },
  utility: {
    ground: '#EDEAE4', surface: '#FFFFFF', ink: '#1C1A17', muted: '#8A857C',
    line: '#DCD8D0', action: '#1C1A17', onAction: '#FFFFFF',
    paprika: '#8C3F2B', wheat: '#C8992F', olive: '#5C6B33',
  },
  'cool-organic': {
    ground: '#F2F1EC', surface: '#FAFAF7', ink: '#202522', muted: '#68716B',
    line: '#D3D8D1', action: '#4F7067', onAction: '#FFFFFF',
    paprika: '#B96F4F', wheat: '#A98236', olive: '#6C7B52',
  },
  'test-lab': {
    ground: '#F2F0FA', surface: '#FFFFFF', ink: '#181526', muted: '#625B78',
    line: '#D9D5E6', action: '#5946D9', onAction: '#FFFFFF',
    paprika: '#D94F70', wheat: '#B77A1C', olive: '#327A68',
  },
  coolors: {
    ground: '#DDFFF7', surface: '#93E1D8', ink: '#462255', muted: '#6F587A',
    line: '#B7EEE7', action: '#AA4465', onAction: '#FFFFFF',
    paprika: '#AA4465', wheat: '#FFA69E', olive: '#93E1D8',
  },
};

export const themeOptions: readonly { id: ThemeId; label: string; detail: string }[] = [
  { id: 'organic', label: 'Organic', detail: 'Soft cream, sand, terracotta, and sage with less yellow warmth.' },
  { id: 'utility', label: 'Utility', detail: 'The original quiet putty, white, ink, and olive palette.' },
  { id: 'cool-organic', label: 'Cool Organic', detail: 'Neutral stone with juniper and restrained botanical colour.' },
  { id: 'test-lab', label: 'Test Lab', detail: 'Experimental indigo, lilac, coral, and teal direction for UI stress tests.' },
  { id: 'coolors', label: 'Coolors', detail: 'Aqua, mint, pink, berry, and plum from the supplied Coolors palette.' },
];

export function resolveThemeId(value: unknown): ThemeId {
  return typeof value === 'string' && THEME_IDS.includes(value as ThemeId)
    ? value as ThemeId
    : DEFAULT_THEME_ID;
}
