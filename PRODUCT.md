# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

Home cooks who want one dependable place to understand what food they have, what needs attention, what they spend, and what they eat. They use Mise in short, repeated moments around shopping, cooking, eating, and putting groceries away.

## Product Purpose

Mise connects pantry stock, meal logging, receipts, nutrition, and dinner decisions on one device. Success means the app becomes more useful through ordinary food routines without demanding a second inventory-maintenance habit.

## Positioning

Meal logging doubles as evidence of pantry depletion, while later receipts reset uncertain estimates to known purchases. Mise is differentiated by honest uncertainty, a dinner decision rather than a recipe browser, and deep Asian pantry coverage that preserves ingredient names in their original scripts.

## Operating Context

People use Mise while handling food and receipts, often one-handed and in short bursts. Important flows include capturing a meal or receipt, correcting inferred results, saving a meal, checking today's nutrition, reviewing pantry attention, and choosing what to cook.

## Capabilities and Constraints

- Expo and React Native serve Android and iOS from one codebase while preserving platform-native behavior.
- Core records stay on-device with no Mise account or backend.
- Provider requests use the person's own API key. Barcode recovery may query Open Food Facts.
- Inferred food, quantity, nutrition, venue, and pantry data must remain reviewable and correctable before it changes a record.
- The interface must not present uncertain estimates as exact facts.
- Existing product behavior and privacy boundaries remain authoritative during the design experiment.

## Brand Commitments

The product name comes from *mise en place*: everything in its place. The voice is calm, practical, specific, and truthful. Mise is a kitchen tool, not a clinician, coach, mascot, or body-evaluation product.

The current warm organic visual system is evidence, not binding authority for this experiment. The replacement direction may be substantially bolder, but it must remain useful during repeated daily operation and must not collapse into a generic SaaS or wellness aesthetic.

## Evidence on Hand

- Implemented product flows and copy in `app/` and `src/components/`.
- Product decisions in `docs/product-decisions.md`.
- Interaction quality constraints in `docs/premium-experience-playbook.md`.
- Existing semantic tokens in `src/constants/theme.ts` and `src/constants/themePalettes.ts`.
- No testimonials, clinical outcomes, quantified inventory accuracy claims, or server-backed user profiles may be invented.

## Product Principles

1. Make ordinary food routines maintain the system.
2. Show only what the available evidence can defend.
3. Keep private household data local by default.
4. Make inferred results easy to review and correct.
5. Spend craft on repeated decisions and transitions, not decoration.

## Accessibility & Inclusion

Support screen readers, reduced motion, dynamic content lengths, platform-appropriate touch targets, and readable contrast across supported themes. Ingredient coverage and naming must not treat Western food databases or romanization as the default.
