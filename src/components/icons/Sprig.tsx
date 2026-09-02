import Svg, { Path } from 'react-native-svg';

import { color } from '@/constants/theme';

/**
 * A herb sprig, drawn once at the top of the Pantry.
 *
 * The one piece of ornament the app allows itself, and it is here because the
 * Pantry header is otherwise a single word on an empty band. It is decorative
 * in the strict sense — it carries no state and is hidden from assistive
 * technology — so it never becomes a place meaning could hide.
 */
export function Sprig({
  size = 56,
  tint = color.olive,
}: {
  size?: number;
  tint?: string;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 56 56"
      fill="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* Stem, top-right down to bottom-left. */}
      <Path
        d="M45 7C39 19 32 31 13 49"
        stroke={tint}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      {/* Leaves, alternating either side. Each is two mirrored curves meeting
          at the tip and at the point where it joins the stem. */}
      <Path
        d="M41 15 Q47 6 53 9 Q50 18 41 15 Z"
        stroke={tint}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Path
        d="M36 25 Q27 17 21 21 Q25 30 36 25 Z"
        stroke={tint}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Path
        d="M29 34 Q38 27 43 33 Q37 41 29 34 Z"
        stroke={tint}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Path
        d="M22 41 Q13 35 9 40 Q14 48 22 41 Z"
        stroke={tint}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
