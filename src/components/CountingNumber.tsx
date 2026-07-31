import { useEffect, useRef, useState } from 'react';

import { Hero } from '@/components/Type';
import { duration } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface Props {
  value: number;
  /** Renders in ink at reduced opacity — used when the day goes over target. */
  dimmed?: boolean;
  accessibilityLabel?: string;
}

/**
 * The hero figure. Counts to its new value over 600ms, or sets it directly when
 * Reduce Motion is on. Tabular figures come from the Hero role, so the digits
 * never shift horizontally while it runs.
 */
export function CountingNumber({ value, dimmed, accessibilityLabel }: Props) {
  const reduceMotion = useReducedMotion();
  const [displayed, setDisplayed] = useState(value);
  const frame = useRef<number | null>(null);
  const from = useRef(value);

  useEffect(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);

    if (reduceMotion || from.current === value) {
      from.current = value;
      setDisplayed(value);
      return;
    }

    const start = Date.now();
    const origin = from.current;
    const delta = value - origin;

    const step = () => {
      const elapsed = Date.now() - start;
      const t = Math.min(1, elapsed / duration.count);
      // Ease-out cubic: fast off the mark, settled at the end.
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayed(Math.round(origin + delta * eased));
      if (t < 1) {
        frame.current = requestAnimationFrame(step);
      } else {
        from.current = value;
        frame.current = null;
      }
    };

    frame.current = requestAnimationFrame(step);

    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [value, reduceMotion]);

  return (
    <Hero
      dimmed={dimmed}
      accessibilityLabel={accessibilityLabel}
      accessibilityLiveRegion="polite"
    >
      {displayed}
    </Hero>
  );
}
