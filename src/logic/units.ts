import type { Units } from '@/types';

const CM_PER_INCH = 2.54;
const INCHES_PER_FOOT = 12;
const KG_PER_LB = 0.45359237;

export interface FeetInches {
  feet: number;
  inches: number;
}

export function cmToFeetInches(cm: number): FeetInches {
  const totalInches = Math.round(cm / CM_PER_INCH);
  return {
    feet: Math.floor(totalInches / INCHES_PER_FOOT),
    inches: totalInches % INCHES_PER_FOOT,
  };
}

export function feetInchesToCm({ feet, inches }: FeetInches): number {
  return Math.round((feet * INCHES_PER_FOOT + inches) * CM_PER_INCH * 10) / 10;
}

export function kgToLb(kg: number): number {
  return Math.round(kg / KG_PER_LB);
}

export function lbToKg(lb: number): number {
  return Math.round((lb * KG_PER_LB) * 10) / 10;
}

export function formatHeight(cm: number, units: Units): string {
  if (units === 'metric') return `${Math.round(cm)} cm`;
  const { feet, inches } = cmToFeetInches(cm);
  return `${feet}′ ${inches}″`;
}

export function formatWeight(kg: number, units: Units): string {
  return units === 'metric' ? `${Math.round(kg)} kg` : `${kgToLb(kg)} lb`;
}

export const HEIGHT_RANGE_CM = { min: 120, max: 230 } as const;
export const WEIGHT_RANGE_KG = { min: 30, max: 300 } as const;
