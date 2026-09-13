# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

Home cooks who want one dependable place to decide what they are going to eat, understand what food they have, what needs attention, what they spend, and what they ate. They use Mise in short, repeated moments around planning, shopping, cooking, eating, and putting groceries away.

## Product Purpose

Mise connects a week's meal plan, pantry stock, meal logging, receipts, nutrition, and dinner decisions on one device. Success means the app becomes more useful through ordinary food routines without demanding a second inventory-maintenance habit — or a second planning habit.

## Positioning

Mise leads with planning a week of meals and turning it into the groceries to buy, then keeps that plan honest as the week is actually cooked and eaten. Meal logging doubles as evidence of pantry depletion, while later receipts reset uncertain estimates to known purchases. Mise is differentiated by honest uncertainty, a plan that ends in a defensible shopping list rather than a recipe browser, a pantry-led dinner decision retained for spontaneous cooking, and deep Asian coverage that preserves ingredient names in their original scripts.

## Operating Context

People use Mise while handling food and receipts, often one-handed and in short bursts — choosing meals on the sofa, checking a list in a shop, opening a cooking guide at the stove. Important flows include planning meals into dated slots, reviewing the groceries a plan requires, capturing a meal or receipt, correcting inferred results, saving a meal, checking today's nutrition, reviewing pantry attention, and choosing what to cook tonight.

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
- Native captures of the incumbent Today, Shop, recipe and dinner surfaces in `docs/ui-overhaul/planner-baseline/`, with their build and device provenance.
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
