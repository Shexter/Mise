import {
  AGE_RANGE,
  BODY_FAT_RANGE,
  HEIGHT_RANGE_CM,
  WEIGHT_RANGE_KG,
} from '@/logic/onboardingDomain';

/**
 * Guidance copy lives next to the domain bounds it quotes, so a range can
 * never drift out of step with the validation that enforces it.
 *
 * Two rules hold across every string here, and `test/onboarding-controls.test.ts`
 * enforces both:
 *
 * 1. Nothing grades a body. No "healthy", "ideal", "athletic", "average", or
 *    "normal" range — those turn a calculation input into a verdict about the
 *    person, which is not something this app is entitled to deliver.
 * 2. A population reference may appear only with a named source and the
 *    population it applies to, phrased as context rather than a target.
 */

export type GuidanceField =
  | 'formula-sex'
  | 'birthday'
  | 'height'
  | 'weight'
  | 'body-fat'
  | 'dexa-measurement-date'
  | 'dexa-lean-tissue'
  | 'dexa-bone-mineral-content'
  | 'inbody-measurement-date'
  | 'inbody-fat-free-mass'
  | 'inbody-bmr';

export interface FieldGuidanceCopy {
  /** Why the flow is asking at all. */
  purpose: string;
  /** The accepted range, the valid options, or where to read the value off. */
  accepted: string;
  /** The report's own wording, where the field mirrors a printed line. */
  vocabulary?: string;
}

export const FIELD_GUIDANCE: Record<GuidanceField, FieldGuidanceCopy> = {
  'formula-sex': {
    purpose:
      'The Mifflin-St Jeor equation uses a different constant for each option. It is a term in the arithmetic, not a question about who you are.',
    accepted: 'Pick the constant the formula should use. Nothing else in Mise reads this value.',
  },
  birthday: {
    purpose:
      'The same equation uses your age. Mise keeps only the number of years and discards the date once you confirm it.',
    accepted: `Ages ${AGE_RANGE.min} to ${AGE_RANGE.max} are supported.`,
  },
  height: {
    purpose: 'One of the four inputs to your daily energy estimate.',
    accepted: `${HEIGHT_RANGE_CM.min} to ${HEIGHT_RANGE_CM.max} cm.`,
  },
  weight: {
    purpose: 'Feeds the energy estimate, and is what pantry portions are measured against.',
    accepted: `${WEIGHT_RANGE_KG.min} to ${WEIGHT_RANGE_KG.max} kg. A rough figure is fine — you can change it whenever it moves.`,
  },
  'body-fat': {
    purpose:
      'Used to work out your lean mass, which the Katch-McArdle equation needs. It is a calculation input, not a score.',
    accepted: `Picker range: ${BODY_FAT_RANGE.min}-${BODY_FAT_RANGE.max}%. Reports and reference ranges vary by age, sex, and measurement method.`,
    vocabulary: 'On a DEXA report this is usually printed as "Body Fat %" or "% Fat".',
  },
  'dexa-measurement-date': {
    purpose: 'Kept with the reading so a later scan can be told apart from this one.',
    accepted: 'The date printed on the report, not the date you are entering it.',
  },
  'dexa-lean-tissue': {
    purpose: 'One half of the lean-mass figure, when you would rather enter the report totals than a percentage.',
    accepted: 'Enter the total in kilograms, as printed.',
    vocabulary: 'DEXA reports print this as "Lean Tissue" or "Lean Soft Tissue".',
  },
  'dexa-bone-mineral-content': {
    purpose: 'Added to lean tissue to give fat-free mass.',
    accepted: 'Enter the total in kilograms, as printed.',
    vocabulary: 'DEXA reports print this as "BMC" or "Bone Mineral Content".',
  },
  'inbody-measurement-date': {
    purpose: 'Kept with the reading so a later scan can be told apart from this one.',
    accepted: 'The date printed on the result sheet, not the date you are entering it.',
  },
  'inbody-fat-free-mass': {
    purpose: 'The lean-mass figure the Katch-McArdle equation needs, taken straight off the sheet.',
    accepted: 'Enter the total in kilograms, as printed.',
    vocabulary: 'InBody sheets print this as "Fat Free Mass". It is not the same line as "Skeletal Muscle Mass".',
  },
  'inbody-bmr': {
    purpose:
      'Optional. If your sheet prints a basal metabolic rate, Mise can use that figure directly instead of calculating one.',
    accepted: 'Leave this blank to have Mise calculate from fat-free mass instead.',
    vocabulary: 'InBody sheets print this as "BMR" or "Basal Metabolic Rate".',
  },
};

export const GUIDANCE_FIELDS = Object.keys(FIELD_GUIDANCE) as GuidanceField[];
