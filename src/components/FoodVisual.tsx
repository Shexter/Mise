import { useCallback, useState } from "react";
import {
  Image,
  StyleSheet,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Feather } from "@expo/vector-icons";

import { color } from "@/constants/theme";
import {
  foodVisualImageKey,
  resolveFoodVisualAccessibility,
  resolveFoodVisualWithFailures,
  resolveSizeDimensions,
  type FoodVisualSize,
  type ResolveFoodVisualInput,
} from "@/media/foodVisuals";

export interface FoodVisualProps extends ResolveFoodVisualInput {
  size?: FoodVisualSize;
  /**
   * Screen-reader label. Omit it — as nearly every surface should — and the
   * visual is hidden from assistive tech as decorative, because the food's name
   * is already adjacent text or on a labelled pressable parent. Pass it only
   * when the visual carries meaning that surrounding text does not.
   */
  alt?: string;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  bordered?: boolean;
}

export function FoodVisual({
  photoUri,
  productImageUrl,
  canonicalId,
  category,
  size = "md",
  alt,
  style,
  imageStyle,
  bordered = true,
}: FoodVisualProps) {
  // Which image identities have failed, not merely whether one has: a row whose
  // photo is replaced must attempt the new URI rather than stay on its fallback.
  const [failedKeys, setFailedKeys] = useState<readonly string[]>([]);
  const dimensions = resolveSizeDimensions(size);

  const resolved = resolveFoodVisualWithFailures(
    { photoUri, productImageUrl, canonicalId, category },
    failedKeys,
  );

  const imageKey = foodVisualImageKey(resolved);
  const onError = useCallback(() => {
    if (imageKey === null) return;
    setFailedKeys((prev) => (prev.includes(imageKey) ? prev : [...prev, imageKey]));
  }, [imageKey]);

  const a11y = resolveFoodVisualAccessibility(alt);
  const a11yProps = a11y.announced
    ? ({
        accessible: true,
        accessibilityRole: "image",
        accessibilityLabel: a11y.label,
      } as const)
    : ({
        accessibilityElementsHidden: true,
        importantForAccessibility: "no-hide-descendants",
      } as const);

  const containerStyle: StyleProp<ViewStyle> = [
    styles.container,
    {
      width: dimensions.dimension,
      height: dimensions.dimension,
      borderRadius: dimensions.borderRadius,
    },
    bordered && styles.bordered,
    style,
  ];

  const resolvedImageStyle = [
    styles.image,
    {
      width: dimensions.dimension,
      height: dimensions.dimension,
      borderRadius: dimensions.borderRadius,
    },
    imageStyle,
  ];

  if ((resolved.kind === "photo" || resolved.kind === "product") && resolved.uri) {
    return (
      <View style={containerStyle} {...a11yProps}>
        <Image
          source={{ uri: resolved.uri }}
          style={resolvedImageStyle}
          resizeMode="cover"
          onError={onError}
        />
      </View>
    );
  }

  if (resolved.kind === "illustration" && resolved.source) {
    return (
      <View style={containerStyle} {...a11yProps}>
        <Image
          source={resolved.source}
          style={resolvedImageStyle}
          resizeMode="contain"
          onError={onError}
        />
      </View>
    );
  }

  // Tier 4: Category Fallback Badge
  const icon = (resolved.iconName as keyof typeof Feather.glyphMap) || "package";
  const iconColor = resolved.iconColor ?? color.olive;

  return (
    <View
      style={[
        containerStyle,
        styles.fallbackContainer,
        { backgroundColor: resolved.backgroundColor ?? color.surface },
      ]}
      {...a11yProps}
    >
      <Feather name={icon} size={dimensions.iconSize} color={iconColor} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    backgroundColor: color.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  bordered: {
    borderWidth: 1,
    borderColor: color.line,
  },
  image: {
    backgroundColor: color.surface,
  },
  fallbackContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
});
