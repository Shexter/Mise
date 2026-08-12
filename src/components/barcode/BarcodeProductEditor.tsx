import { StyleSheet, View } from 'react-native';

import { OPEN_FOOD_FACTS_ATTRIBUTION } from '@/api/openFoodFacts';
import { Card } from '@/components/Card';
import { Segmented } from '@/components/Choice';
import { Field } from '@/components/Field';
import { Caption, RowTitle, SectionLabel } from '@/components/Type';
import { space } from '@/constants/theme';
import { BARCODE_FACTUAL_RESULT_DISCLOSURE, barcodeNutritionRows } from '@/logic/barcodePresentation';
import { BARCODE_REVIEW_UNITS, type BarcodeResultOrigin } from '@/store/barcodeCaptureStore';
import type { MeasureUnit, Product } from '@/types';

export type ProductCorrection = Pick<Product, 'name' | 'brand' | 'pkgQty' | 'pkgUnit' | 'containerCount'>;

interface Props {
  product: Product;
  origin: BarcodeResultOrigin;
  onChange: (correction: Partial<ProductCorrection>) => void;
}

const UNIT_OPTIONS = BARCODE_REVIEW_UNITS.map((value) => ({ value, label: value }));

/** The same factual, editable product contract for single and batch review. */
export function BarcodeProductEditor({ product, origin, onChange }: Props) {
  return (
    <View style={styles.root}>
      <Card>
        <Caption muted>{originLabel(origin)}</Caption>
        <RowTitle>{product.name || 'Unnamed product'}</RowTitle>
        {product.brand ? <Caption muted>{product.brand}</Caption> : null}
        {product.source === 'barcode' ? <Caption muted>{OPEN_FOOD_FACTS_ATTRIBUTION}</Caption> : null}
      </Card>
      <Field label="Product name" value={product.name} onChangeText={(name) => onChange({ name })} />
      <Field label="Brand" value={product.brand ?? ''} onChangeText={(brand) => onChange({ brand: brand.trim() || null })} />
      <Field label="Package size" value={product.pkgQty?.toString() ?? ''} onChangeText={(value) => onChange({ pkgQty: positiveNumber(value) })} keyboardType="decimal-pad" suffix={product.pkgUnit ?? undefined} hint="Leave blank when the package size is unknown." />
      <Segmented options={UNIT_OPTIONS} value={(product.pkgUnit ?? 'piece') as MeasureUnit} onChange={(pkgUnit) => onChange({ pkgUnit })} />
      <Field label="Containers in pack" value={product.containerCount?.toString() ?? ''} onChangeText={(value) => onChange({ containerCount: positiveInteger(value) })} keyboardType="number-pad" hint="Leave blank when the pack count is unknown; Mise will add one item." />
      <View style={styles.nutrition}>
        <SectionLabel muted>Nutrition per 100</SectionLabel>
        {barcodeNutritionRows(product).map((row) => <Caption key={row}>{row}</Caption>)}
        <Caption muted>{BARCODE_FACTUAL_RESULT_DISCLOSURE}</Caption>
      </View>
    </View>
  );
}

export function originLabel(origin: BarcodeResultOrigin): string {
  if (origin === 'open-food-facts') return 'Found in Open Food Facts';
  if (origin === 'user') return 'Identified by you on this device';
  return 'Recognised locally';
}

export function positiveNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function positiveInteger(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

const styles = StyleSheet.create({
  root: { gap: space.base },
  nutrition: { gap: space.xs },
});
