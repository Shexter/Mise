import { useState } from 'react';
import { Image, StyleSheet } from 'react-native';

import { radius, space } from '@/constants/theme';
import { TECHNIQUE_ILLUSTRATIONS, type TechniqueId } from '@/media/techniqueIllustrations';

interface Props {
  technique: TechniqueId;
}

/**
 * The painted mark for one recognised cooking technique.
 *
 * Decorative on purpose: the step's own text sits beside it and already says
 * what to do, so announcing the picture too would read the step twice. Renders
 * nothing if the bundled image cannot resolve — the step is complete as text,
 * which is exactly what it was before the artwork existed.
 *
 * Callers never pick the technique themselves; `resolveTechnique()` does, and
 * returns `null` rather than guessing.
 */
export function TechniqueIllustration({ technique }: Props) {
  const [failed, setFailed] = useState(false);
  const source = TECHNIQUE_ILLUSTRATIONS[technique];

  if (failed || source === undefined) return null;

  return (
    <Image
      source={source}
      style={styles.art}
      resizeMode="contain"
      onError={() => setFailed(true)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

const styles = StyleSheet.create({
  /**
   * Unframed and contained: the artwork's own warm paper is the surface, so a
   * step does not nest one painted tile inside the method card's panel.
   */
  art: {
    width: space.xxxl,
    height: space.xxxl,
    borderRadius: radius.input,
  },
});
