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
  /**
   * Soft washes that group a row by meaning rather than decorate it — the add
   * surface's four intake methods, a pantry thumbnail's ground, a selected
   * location pill. Each is a low-chroma tint of the accent it is named for, so
   * `ink` clears 4.5:1 on every one of them. They are fills only: never a text,
   * icon, or border colour, because at this chroma nothing reads on them.
   */
  tintPaprika: string;
  tintBlue: string;
  tintOlive: string;
  tintWheat: string;
  /**
   * On-track, affirming figures — the remaining-calories hero. Distinct from
   * `olive`, which carries fat's macro meaning, and from the chart scale, whose
   * values are chosen to sit beside each other rather than to carry text.
   */
  positive: string;
  /**
   * Chrome that floats above the page — the bottom navigation and any sheet.
   * It sits a step *lighter* than `ground`, which is what separates it from
   * `surface`: a card is a darker inset, a raised surface is a lighter overlay.
   */
  raised: string;
  raisedLine: string;
  /**
   * The analytical blue every nutrient meter fills with. Uniform on purpose —
   * the row's own label already says which nutrient it is, so a colour per
   * metric would be decoration. Dark enough to carry the percentage as text.
   */
  measure: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
}

export const DEFAULT_THEME_ID: ThemeId = 'organic';

export const themePalettes: Record<ThemeId, ThemePalette> = {
  organic: {
    ground: '#F3EDE4', surface: '#EBE3D8', ink: '#211F1D', muted: '#756F68',
    line: '#D8CEC3', action: '#A95A35', onAction: '#FFFDFC',
    paprika: '#A45239', wheat: '#B68A43', olive: '#74825F',
    tintPaprika: '#F6E3D8', tintBlue: '#DFE7F0', tintOlive: '#E5EBDC', tintWheat: '#F4E9D4',
    positive: '#1F7A45', raised: '#F8F4ED', raisedLine: '#DED4C8', measure: '#0E6E8C',
    chart1: '#A6672E', chart2: '#8C6BB8', chart3: '#1E8F68', chart4: '#A8452F', chart5: '#0F7C9E',
  },
  utility: {
    ground: '#EDEAE4', surface: '#FFFFFF', ink: '#1C1A17', muted: '#8A857C',
    line: '#DCD8D0', action: '#1C1A17', onAction: '#FFFFFF',
    paprika: '#8C3F2B', wheat: '#C8992F', olive: '#5C6B33',
    tintPaprika: '#F7E4DE', tintBlue: '#E2E9F2', tintOlive: '#E6EBDC', tintWheat: '#F6ECD6',
    positive: '#1B6B3A', raised: '#FFFFFF', raisedLine: '#DCD8D0', measure: '#0E6E8C',
    chart1: '#A6672E', chart2: '#8C6BB8', chart3: '#1E8F68', chart4: '#A8452F', chart5: '#0F7C9E',
  },
  'cool-organic': {
    ground: '#F2F1EC', surface: '#FAFAF7', ink: '#202522', muted: '#68716B',
    line: '#D3D8D1', action: '#4F7067', onAction: '#FFFFFF',
    paprika: '#B96F4F', wheat: '#A98236', olive: '#6C7B52',
    tintPaprika: '#F5E5DC', tintBlue: '#E1E9EF', tintOlive: '#E5EADD', tintWheat: '#F2EAD8',
    positive: '#2A6B54', raised: '#FBFBF8', raisedLine: '#D8DCD6', measure: '#0E6E8C',
    chart1: '#A6672E', chart2: '#8C6BB8', chart3: '#1E8F68', chart4: '#A8452F', chart5: '#0F7C9E',
  },
  'test-lab': {
    ground: '#F1EEF2', surface: '#F9F7F8', ink: '#2D2930', muted: '#746D76',
    line: '#DDD6DF', action: '#8B6F8D', onAction: '#FFFFFF',
    paprika: '#A86F79', wheat: '#B59A71', olive: '#7C927F',
    tintPaprika: '#F3E5E7', tintBlue: '#E4E5F0', tintOlive: '#E7EDE7', tintWheat: '#F2EADD',
    positive: '#3F7357', raised: '#FAF8FA', raisedLine: '#DFD8E1', measure: '#0E6E8C',
    chart1: '#A6672E', chart2: '#8C6BB8', chart3: '#1E8F68', chart4: '#A8452F', chart5: '#0F7C9E',
  },
  coolors: {
    ground: '#EEF5F3', surface: '#E2EFEC', ink: '#313B3A', muted: '#6F7C7A',
    line: '#CBDDD8', action: '#9A6378', onAction: '#FFFFFF',
    paprika: '#A87883', wheat: '#C3A17D', olive: '#86A49A',
    tintPaprika: '#F2E4E7', tintBlue: '#DFEAEF', tintOlive: '#E3EDE6', tintWheat: '#F0E9DA',
    positive: '#2C6B58', raised: '#F5FAF8', raisedLine: '#CDDDD8', measure: '#0E6E8C',
    chart1: '#A6672E', chart2: '#8C6BB8', chart3: '#1E8F68', chart4: '#A8452F', chart5: '#0F7C9E',
  },
  'midnight-organic': {
    ground: '#1D211F', surface: '#272D2A', ink: '#F4F1EA', muted: '#B9BDB7',
    line: '#3B4540', action: '#D08A68', onAction: '#201B18',
    paprika: '#D58A73', wheat: '#D2B16F', olive: '#A8B68B',
    // Dark washes, not lightened ones: a tint on this theme sits above `surface`
    // by warmth rather than by luminance, so `ink` still reads on it.
    tintPaprika: '#3A2C27', tintBlue: '#26313A', tintOlive: '#2B342A', tintWheat: '#383124',
    positive: '#7FC99B', raised: '#232825', raisedLine: '#3B4540', measure: '#6FC3DE',
    chart1: '#C07F3F', chart2: '#9A78CC', chart3: '#2FA890', chart4: '#C05F4A', chart5: '#2E9DBF',
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
