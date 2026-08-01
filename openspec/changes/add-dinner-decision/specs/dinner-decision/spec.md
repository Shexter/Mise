## Purpose

Answers "what should I cook tonight" from what is actually in the kitchen,
weighted toward what is about to be wasted. It is also how the app learns what
went into a dish precisely enough to debit seasonings, which a photograph of
finished food can never do.

## ADDED Requirements

### Requirement: Suggestions must use stock that is about to expire

The system SHALL classify in-stock ingredients by urgency, and every suggestion
it offers SHALL use at least one ingredient from the most urgent group whenever
that group is non-empty.

Urgency SHALL account for the value of what would be wasted, not the expiry date
alone, so that a costly item and a cheap one expiring together are not treated
as equally pressing.

An ingredient that can be frozen SHALL be treated as less urgent than one that
cannot, since freezing rescues it without cooking.

#### Scenario: Every suggestion clears something urgent

- **GIVEN** the kitchen holds ingredients expiring within a few days
- **WHEN** suggestions are produced
- **THEN** each one uses at least one of those ingredients

#### Scenario: Value separates equally-dated items

- **GIVEN** an expensive protein and a cheap vegetable expiring on the same day
- **WHEN** urgency is ranked
- **THEN** the expensive item ranks as more urgent

#### Scenario: Freezable stock is less pressing

- **GIVEN** two ingredients expiring on the same day, one freezable
- **WHEN** urgency is ranked
- **THEN** the freezable one ranks as less urgent

#### Scenario: Nothing urgent still yields suggestions

- **GIVEN** no ingredient is close to expiry
- **WHEN** suggestions are produced
- **THEN** suggestions are still offered from available stock

### Requirement: Suggestions reflect what this person actually cooks

The system SHALL use the user's own meal history to shape suggestions,
preferring dishes consistent with what they cook, avoiding what they have eaten
in the last few days, and mixing familiar dishes with at least one less
familiar one.

#### Scenario: Suggestions follow the user's cooking

- **GIVEN** a history dominated by one style of cooking
- **WHEN** suggestions are produced
- **THEN** they are consistent with that style

#### Scenario: Recently eaten dishes are suppressed

- **GIVEN** a dish eaten within the last few days
- **WHEN** suggestions are produced
- **THEN** that dish is not among them

#### Scenario: Familiar and unfamiliar are mixed

- **WHEN** a set of suggestions is produced
- **THEN** it contains both dishes resembling the user's history and at least
  one that does not

### Requirement: Calories inform suggestions without restricting them

The system SHALL make the calories and macros remaining in the day available to
suggestion generation, and SHALL show how each suggestion fits.

The system MUST NOT exclude a suggestion solely because it exceeds the remaining
calories. Where a dish overshoots, the system SHALL offer a smaller portion
rather than withholding the dish.

#### Scenario: An overshooting dish is offered with its fit shown

- **GIVEN** few calories remain in the day
- **WHEN** suggestions are produced
- **THEN** dishes exceeding the remainder may still appear
- **AND** each shows how it fits the remaining allowance

#### Scenario: A portion is offered instead of exclusion

- **WHEN** a suggested dish exceeds the remaining calories
- **THEN** a smaller portion is offered

### Requirement: Every suggestion states why it was chosen

The system SHALL present, with each suggestion, at least one reason drawn from
the facts that selected it — the stock it clears, the value it saves, its fit
against the remaining allowance, or its resemblance to what the user cooks.

#### Scenario: A reason accompanies each suggestion

- **WHEN** a suggestion is displayed
- **THEN** at least one reason for its selection is shown

#### Scenario: Reasons are drawn from real facts

- **WHEN** a suggestion cites the stock it clears
- **THEN** that ingredient is in the kitchen and is approaching expiry

### Requirement: A suggestion names the ingredients it uses by identity

Each suggestion SHALL identify the ingredients it consumes by their canonical
identity and by amount, not by loose description.

Where a suggestion needs something the kitchen does not have, the system SHALL
state that plainly rather than silently omitting it or excluding the suggestion.

#### Scenario: Consumed ingredients are identified precisely

- **WHEN** a suggestion is produced
- **THEN** each ingredient it consumes is identified as a specific catalogued
  ingredient with an amount

#### Scenario: A missing ingredient is disclosed

- **GIVEN** a suggestion requiring one ingredient not in the kitchen
- **WHEN** it is displayed
- **THEN** the missing ingredient is shown as missing

### Requirement: Cooking a suggestion logs it with stated quantities

The system SHALL let the user record that they cooked a suggestion, producing a
logged meal whose items carry the ingredients and amounts the suggestion stated.

Those items SHALL retain the canonical identity the suggestion named, so that
stock is debited against the intended ingredient rather than one inferred from
its name.

The user SHALL be able to say how many servings the dish produced, and stock
SHALL be debited for the whole amount cooked.

#### Scenario: Cooking produces a logged meal

- **WHEN** the user records cooking a suggestion
- **THEN** a meal is logged containing the suggestion's ingredients and amounts

#### Scenario: Stock is debited by identity, not by name

- **WHEN** a cooked suggestion debits stock
- **THEN** the ingredient debited is the one the suggestion named
- **AND** no name matching is required to determine it

#### Scenario: A batch debits the batch

- **GIVEN** a cooked suggestion recorded as producing several servings
- **WHEN** stock is debited
- **THEN** it is debited for every serving produced, not one

#### Scenario: A seasoning is debited from a cooked suggestion

- **GIVEN** a suggestion using a seasoning in a stated amount
- **WHEN** the user records cooking it
- **THEN** that seasoning's stock reflects the use

#### Scenario: A photograph of the result overrides the estimate

- **GIVEN** a meal logged from a cooked suggestion
- **WHEN** the user photographs the finished dish and accepts the estimate
- **THEN** the photographed estimate replaces the suggestion's figures

### Requirement: Suggestions can be planned to last until a date

The system SHALL offer a mode producing a set of dinners cookable from current
stock without shopping, and SHALL state honestly where stock does not stretch
far enough.

#### Scenario: A plan is produced from stock alone

- **WHEN** the user asks for meals to last until a chosen day
- **THEN** a set of dinners is produced requiring no purchases

#### Scenario: A shortfall is stated

- **GIVEN** stock insufficient to reach the chosen day
- **WHEN** the plan is produced
- **THEN** the shortfall is stated rather than padded with dishes that cannot be
  cooked

### Requirement: Suggestions are reused rather than regenerated

The system SHALL reuse a generated set of suggestions rather than producing new
ones each time the surface is opened, regenerating when stock has changed
materially, when a meal has been logged, or when the user explicitly asks.

#### Scenario: Reopening does not regenerate

- **GIVEN** suggestions produced earlier the same day
- **WHEN** the user reopens the surface with nothing changed
- **THEN** the existing suggestions are shown without new generation

#### Scenario: A material change regenerates

- **WHEN** an ingredient is consumed, added, or becomes urgent
- **THEN** the next viewing produces fresh suggestions

#### Scenario: The user can ask for different ones

- **WHEN** the user requests different suggestions
- **THEN** a new set is produced

### Requirement: Suggestions are presented as ideas, not tested recipes

The system SHALL present suggestions as starting points rather than verified
recipes, and MUST NOT imply that quantities or method have been tested.

#### Scenario: Framing does not overclaim

- **WHEN** a suggestion's method is displayed
- **THEN** it is presented as an idea rather than a tested recipe

### Requirement: Suggestion generation degrades without a provider

Where suggestions cannot be generated — no key configured, or no connection —
the system SHALL say so plainly and leave the rest of the application working.

#### Scenario: No key still leaves the app usable

- **GIVEN** no API key is configured
- **WHEN** the user opens the suggestion surface
- **THEN** they are told suggestions need a key
- **AND** the pantry and calorie features continue to work

#### Scenario: Cached suggestions survive going offline

- **GIVEN** suggestions generated earlier
- **WHEN** the connection is lost
- **THEN** those suggestions remain readable
