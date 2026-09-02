import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { color } from '@/constants/theme';

/**
 * The five bottom-navigation glyphs.
 *
 * These are hand-drawn rather than pulled from Feather because the navigation
 * is the one place the app's identity has to survive being 24px tall, and a
 * stock icon set reads as whichever app you last used it in. Everything above
 * the tab bar still uses Feather; this is the exception, not a new convention.
 *
 * Each glyph has an outline and a filled variant. The filled one marks the
 * active destination, so selection is carried by weight as well as by colour.
 */

export interface NavIconProps {
  /** Stroke, and fill when `filled`. */
  tint: string;
  /** What a knocked-out detail inside a filled glyph shows through to. */
  knockout?: string;
  size?: number;
  filled?: boolean;
}

const STROKE = 1.7;

function Frame({
  size = 24,
  children,
}: {
  size?: number;
  children: React.ReactNode;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {children}
    </Svg>
  );
}

/** Today — a calendar leaf. */
export function TodayIcon({
  tint,
  knockout = color.raised,
  size,
  filled = false,
}: NavIconProps) {
  return (
    <Frame size={size}>
      <Rect
        x={3}
        y={5}
        width={18}
        height={16}
        rx={3}
        stroke={tint}
        strokeWidth={STROKE}
        fill={filled ? tint : 'none'}
      />
      <Path
        d="M3.6 10.2H20.4"
        stroke={filled ? knockout : tint}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
      <Path
        d="M8 3v4M16 3v4"
        stroke={tint}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
      {filled ? (
        <Circle cx={12} cy={15.6} r={1.7} fill={knockout} />
      ) : null}
    </Frame>
  );
}

/** Pantry — a shelf unit, the thing the tab actually catalogues. */
export function PantryIcon({
  tint,
  knockout = color.raised,
  size,
  filled = false,
}: NavIconProps) {
  return (
    <Frame size={size}>
      <Rect
        x={3.5}
        y={3}
        width={17}
        height={18}
        rx={2.5}
        stroke={tint}
        strokeWidth={STROKE}
        fill={filled ? tint : 'none'}
      />
      <Path
        d="M3.9 9.6h16.2M3.9 15h16.2"
        stroke={filled ? knockout : tint}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
      {/* Three jars on the top shelf, and nothing on the two below. Drawing
          contents on every shelf turned the glyph into a grid at 24px; leaving
          the lower shelves bare keeps it a cupboard with things in it. */}
      <G fill={filled ? knockout : tint}>
        <Rect x={6.6} y={5.6} width={2.6} height={2.9} rx={0.8} />
        <Rect x={10.7} y={5.1} width={2.6} height={3.4} rx={0.8} />
        <Rect x={14.8} y={5.9} width={2.6} height={2.6} rx={0.8} />
      </G>
    </Frame>
  );
}

/** Shop — a basket on wheels. */
export function ShopIcon({
  tint,
  knockout = color.raised,
  size,
  filled = false,
}: NavIconProps) {
  return (
    <Frame size={size}>
      <Path
        d="M2.6 3.4h2.1a1 1 0 0 1 .97.76l.44 1.84"
        stroke={tint}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
      <Path
        d="M6.1 6h14.1a1 1 0 0 1 .97 1.24l-1.5 6a1 1 0 0 1-.97.76H8.7a1 1 0 0 1-.97-.76L6.1 6Z"
        stroke={tint}
        strokeWidth={STROKE}
        strokeLinejoin="round"
        fill={filled ? tint : 'none'}
      />
      {filled ? (
        <Path
          d="M10.6 8.4v3M14 8.4v3M17.4 8.4v3"
          stroke={knockout}
          strokeWidth={1.4}
          strokeLinecap="round"
        />
      ) : null}
      <Circle
        cx={10.2}
        cy={19.4}
        r={1.6}
        stroke={tint}
        strokeWidth={STROKE}
        fill={filled ? tint : 'none'}
      />
      <Circle
        cx={17.6}
        cy={19.4}
        r={1.6}
        stroke={tint}
        strokeWidth={STROKE}
        fill={filled ? tint : 'none'}
      />
    </Frame>
  );
}

/** Settings — a cog with eight teeth. */
export function SettingsIcon({
  tint,
  knockout = color.raised,
  size,
  filled = false,
}: NavIconProps) {
  const teeth = [0, 45, 90, 135, 180, 225, 270, 315];

  return (
    <Frame size={size}>
      <G>
        {teeth.map((angle) => (
          <Rect
            key={angle}
            x={10.85}
            y={1.6}
            width={2.3}
            height={4.2}
            rx={1.1}
            fill={tint}
            origin="12, 12"
            rotation={angle}
          />
        ))}
      </G>
      <Circle
        cx={12}
        cy={12}
        r={6.4}
        stroke={tint}
        strokeWidth={STROKE}
        fill={filled ? tint : 'none'}
      />
      <Circle
        cx={12}
        cy={12}
        r={2.5}
        stroke={filled ? knockout : tint}
        strokeWidth={STROKE}
        fill={filled ? knockout : 'none'}
      />
    </Frame>
  );
}

/** The centre add action. Always drawn on the action fill, so it is one weight. */
export function PlusIcon({ tint, size = 28 }: { tint: string; size?: number }) {
  return (
    <Frame size={size}>
      <Path
        d="M12 5.2v13.6M5.2 12h13.6"
        stroke={tint}
        strokeWidth={2.4}
        strokeLinecap="round"
      />
    </Frame>
  );
}
