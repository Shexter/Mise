import { useState } from "react";
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { color } from "@/constants/theme";
import {
  buildPlateGeometry,
  buildPlateWedgePaths,
  resolveDishVisual,
  type ResolveDishVisualInput,
} from "@/media/dishVisuals";
import { resolveFoodVisualAccessibility, resolveSizeDimensions, type FoodVisualSize } from "@/media/foodVisuals";

export interface DishVisualProps extends ResolveDishVisualInput {
  size?: FoodVisualSize;
  /**
   * Screen-reader label. Omit it wherever the dish name is already adjacent
   * text or on a labelled parent — the plate is then hidden as decorative, the
   * same rule `<FoodVisual />` follows.
   */
  alt?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * A dish, drawn as a plate seen from above.
 *
 * Ingredients are rounded thumbnails; dishes are circles. The distinction is
 * deliberate — it separates a thing you have from a thing you could cook.
 *
 * The well is divided by the dish's own food-class mix, in the same colours
 * those classes carry as ingredient badges, so a vegetable-forward dish and a
 * protein-forward one are told apart at a glance without either claiming to be
 * a picture of the food.
 */
export function DishVisual({ photoUri, dish, foodClasses, size = "md", alt, style }: DishVisualProps) {
  // Track which URI failed, not merely that one did, so a replacement photo is
  // attempted rather than inheriting the previous one's failure.
  const [failedUri, setFailedUri] = useState<string | null>(null);

  const { dimension } = resolveSizeDimensions(size);
  const resolved = resolveDishVisual({ photoUri, dish, foodClasses });

  const a11y = resolveFoodVisualAccessibility(alt);
  const a11yProps = a11y.announced
    ? ({ accessible: true, accessibilityRole: "image", accessibilityLabel: a11y.label } as const)
    : ({ accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" } as const);

  const containerStyle: StyleProp<ViewStyle> = [
    styles.container,
    { width: dimension, height: dimension, borderRadius: dimension / 2 },
    style,
  ];

  if (resolved.kind === "photo" && resolved.uri && resolved.uri !== failedUri) {
    const uri = resolved.uri;
    return (
      <View style={containerStyle} {...a11yProps}>
        <Image
          source={{ uri }}
          style={{ width: dimension, height: dimension, borderRadius: dimension / 2 }}
          resizeMode="cover"
          onError={() => setFailedUri(uri)}
        />
      </View>
    );
  }

  const geometry = buildPlateGeometry(dimension);
  const wedges = buildPlateWedgePaths(resolved.wedges, geometry, resolved.rotation);
  // Wide, round-joined separators break the wedges into portions and blunt the
  // sharp convergence at the centre that would otherwise read as a pie chart.
  const separatorWidth = Math.max(1, Math.round(dimension * 0.045));

  return (
    <View style={containerStyle} {...a11yProps}>
      <Svg width={dimension} height={dimension}>
        {/* The rim: a filled disc whose margin around the well reads as ceramic. */}
        <Circle
          cx={geometry.center}
          cy={geometry.center}
          r={geometry.rimRadius}
          fill={color.surface}
          stroke={color.line}
          strokeWidth={geometry.rimStrokeWidth}
        />
        {wedges.length === 0 ? (
          // Nothing resolved, so nothing is claimed: an empty plate.
          <Circle cx={geometry.center} cy={geometry.center} r={geometry.wellRadius} fill={color.ground} />
        ) : (
          wedges.map((wedge) =>
            wedge.path === null ? (
              <Circle
                key={wedge.category}
                cx={geometry.center}
                cy={geometry.center}
                r={geometry.wellRadius}
                fill={wedge.color}
              />
            ) : (
              <Path
                key={wedge.category}
                d={wedge.path}
                fill={wedge.color}
                stroke={color.surface}
                strokeWidth={separatorWidth}
                strokeLinejoin="round"
              />
            ),
          )
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
});
