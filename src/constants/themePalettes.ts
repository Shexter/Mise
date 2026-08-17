export const THEME_IDS = ['organic', 'utility', 'cool-organic', 'test-lab', 'coolors', 'midnight-organic'] as const;
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
    ground: '#F1EEF2', surface: '#F9F7F8', ink: '#2D2930', muted: '#746D76',
    line: '#DDD6DF', action: '#8B6F8D', onAction: '#FFFFFF',
    paprika: '#A86F79', wheat: '#B59A71', olive: '#7C927F',
  },
  coolors: {
    ground: '#EEF5F3', surface: '#E2EFEC', ink: '#313B3A', muted: '#6F7C7A',
    line: '#CBDDD8', action: '#9A6378', onAction: '#FFFFFF',
    paprika: '#A87883', wheat: '#C3A17D', olive: '#86A49A',
  },
  'midnight-organic': {
    ground: '#1D211F', surface: '#272D2A', ink: '#F4F1EA', muted: '#B9BDB7',
    line: '#3B4540', action: '#D08A68', onAction: '#201B18',
    paprika: '#D58A73', wheat: '#D2B16F', olive: '#A8B68B',
  },
};

export const themeOptions: readonly { id: ThemeId; label: string; detail: string }[] = [
  { id: 'organic', label: 'Organic', detail: 'Soft cream, sand, terracotta, and sage with less yellow warmth.' },
  { id: 'utility', label: 'Utility', detail: 'The original quiet putty, white, ink, and olive palette.' },
  { id: 'cool-organic', label: 'Cool Organic', detail: 'Neutral stone with juniper and restrained botanical colour.' },
  { id: 'test-lab', label: 'Soft Studio', detail: 'A quiet lilac, clay, oat, and eucalyptus palette for gentle contrast testing.' },
  { id: 'coolors', label: 'Misted Mint', detail: 'A softened aqua, rose, oat, and sage palette with low-saturation contrast.' },
  { id: 'midnight-organic', label: 'Midnight Organic', detail: 'A dark kitchen-at-night palette with warm ember actions and calm botanical accents.' },
];

export function resolveThemeId(value: unknown): ThemeId {
  return typeof value === 'string' && THEME_IDS.includes(value as ThemeId)
    ? value as ThemeId
    : DEFAULT_THEME_ID;
}
