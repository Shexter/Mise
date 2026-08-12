import type { Product } from '@/types';

export const BARCODE_FACTUAL_RESULT_DISCLOSURE = 'Missing facts stay “Not provided.” Mise does not calculate a food score or grade.';

export function barcodeNutritionRows(product: Pick<Product, 'kcalPer100' | 'proteinPer100' | 'carbsPer100' | 'fatPer100'>): string[] {
  return [nutrition('Energy', product.kcalPer100, 'kcal'), nutrition('Protein', product.proteinPer100, 'g'), nutrition('Carbohydrate', product.carbsPer100, 'g'), nutrition('Fat', product.fatPer100, 'g')];
}

function nutrition(label: string, value: number | null, unit: string): string {
  return `${label}: ${value === null ? 'Not provided' : `${value} ${unit}`}`;
}
