## Purpose

What the user cannot or will not eat, and what the app does with that. The app
cannot make food safe. It can decline to suggest an ingredient the user told it
to avoid, and it can be honest about the difference between the two.

## ADDED Requirements

### Requirement: Dietary rules are recorded in three distinct kinds

The system SHALL record dietary rules as one of three kinds — allergen,
restriction, or dislike — and MUST NOT store them as a single undifferentiated
list.

Each kind SHALL have its own enforcement policy as specified below, and the
kind SHALL be chosen by the user when the rule is created.

#### Scenario: A rule carries its kind

- **WHEN** the user records something they avoid
- **THEN** the rule is stored with one of the three kinds
- **AND** the kind is what the user chose

#### Scenario: The kind is changeable

- **WHEN** the user changes a rule's kind
- **THEN** the rule is enforced under the new kind's policy from then on

#### Scenario: Kinds are not merged for enforcement

- **GIVEN** an allergen rule and a dislike rule
- **WHEN** suggestions are produced
- **THEN** the allergen rule excludes
- **AND** the dislike rule does not exclude

### Requirement: A rule resolves to canonical identity, not to text

The system SHALL resolve a dietary rule to a canonical ingredient through the
existing resolution path, and SHALL apply the rule by canonical identity.

Where a rule cannot be resolved to a canonical ingredient, the system SHALL
retain the user's text and apply the rule by normalised name, and SHALL treat
that as a weaker match rather than an equivalent one.

#### Scenario: A recorded rule resolves

- **WHEN** the user records a rule naming a known ingredient
- **THEN** it is stored against that canonical ingredient

#### Scenario: An unresolvable rule is still enforced

- **WHEN** the user records a rule that resolves to no canonical ingredient
- **THEN** the rule is retained
- **AND** is applied by normalised name

#### Scenario: A rule survives a name the user did not use

- **GIVEN** a rule against a canonical ingredient
- **WHEN** a suggestion names that ingredient by a known alias
- **THEN** the rule applies

### Requirement: Exclusion covers derivatives of an excluded ingredient

The system SHALL hold a derivative relation between canonical ingredients, and
SHALL exclude the derivatives of an excluded ingredient as well as the
ingredient itself.

The relation SHALL be transitive.

#### Scenario: A derivative is excluded with its parent

- **GIVEN** a rule against an ingredient that has derivatives
- **WHEN** a suggestion contains one of those derivatives
- **THEN** the suggestion is excluded

#### Scenario: A derivative of a derivative is excluded

- **GIVEN** an ingredient derived from another that is itself derived from an
  excluded ingredient
- **WHEN** a suggestion contains it
- **THEN** the suggestion is excluded

#### Scenario: A parent is not excluded by its derivative

- **GIVEN** a rule against a derivative only
- **WHEN** a suggestion contains the ingredient it derives from
- **THEN** the suggestion is not excluded on that basis

### Requirement: Exclusion is enforced locally after generation

The system SHALL apply allergen and restriction rules to a generated suggestion
locally, after the response is received, and MUST NOT rely on the request having
stated them.

Stating the rules in the request is permitted and expected, but SHALL NOT be the
mechanism by which exclusion is guaranteed.

#### Scenario: A violating suggestion is dropped regardless of the request

- **GIVEN** rules were stated in the request
- **WHEN** a returned suggestion contains an excluded ingredient
- **THEN** it is not shown

#### Scenario: Exclusion needs no network

- **WHEN** exclusion is applied
- **THEN** it requires no request of any kind

#### Scenario: Every suggestion is checked

- **WHEN** a set of suggestions is returned
- **THEN** each is checked independently

### Requirement: An unidentifiable ingredient excludes where allergens are recorded

Where the user has at least one allergen rule and a suggestion contains an
ingredient the system cannot resolve to a canonical ingredient, the system SHALL
exclude that suggestion.

Where the user has no allergen rules, an unresolved ingredient SHALL NOT cause
exclusion.

#### Scenario: Unknown excludes under an allergen rule

- **GIVEN** the user has recorded an allergen
- **WHEN** a suggestion contains an ingredient that resolves to nothing
- **THEN** the suggestion is excluded

#### Scenario: Unknown passes without allergen rules

- **GIVEN** the user has recorded no allergens
- **WHEN** a suggestion contains an ingredient that resolves to nothing
- **THEN** the suggestion is not excluded on that basis

#### Scenario: Restrictions alone do not trigger the strict reading

- **GIVEN** the user has recorded restrictions but no allergens
- **WHEN** a suggestion contains an unresolved ingredient
- **THEN** the suggestion is not excluded on that basis

### Requirement: Dislikes reduce ranking rather than excluding

The system SHALL treat a dislike as a negative ranking signal, and MUST NOT
exclude a suggestion solely because it contains a disliked ingredient.

#### Scenario: A disliked dish ranks lower

- **GIVEN** two otherwise equivalent suggestions, one containing a disliked
  ingredient
- **WHEN** they are ranked
- **THEN** the one containing it ranks lower

#### Scenario: A disliked dish is still reachable

- **GIVEN** every available suggestion contains a disliked ingredient
- **WHEN** suggestions are shown
- **THEN** suggestions are still shown

### Requirement: Too few suggestions survive exclusion is reported, not padded

Where exclusion leaves fewer suggestions than the surface expects, the system
SHALL show what survived and say that rules were applied, and MUST NOT reinstate
an excluded suggestion to fill the space.

#### Scenario: A short list is shown short

- **WHEN** exclusion leaves fewer suggestions than expected
- **THEN** the surviving suggestions are shown
- **AND** the user is told rules were applied

#### Scenario: Nothing survives

- **WHEN** exclusion leaves no suggestions
- **THEN** the user is told, and offered another attempt
- **AND** no excluded suggestion is shown

### Requirement: Logging is never filtered by dietary rules

The system SHALL record any meal the user logs, and MUST NOT block, alter, or
refuse a meal because it contains an ingredient the user has a rule against.

The system MAY note the rule against the logged meal, and SHALL NOT require the
user to act on the note.

#### Scenario: A meal against a rule is logged

- **GIVEN** a rule against an ingredient
- **WHEN** the user logs a meal containing it
- **THEN** the meal is recorded unchanged

#### Scenario: A note does not obstruct

- **WHEN** a logged meal matches a rule
- **THEN** any note shown does not prevent saving

#### Scenario: The pantry is unaffected

- **WHEN** the user adds an item matching a rule
- **THEN** it enters the pantry normally

### Requirement: The app describes what it filtered, never that food is safe

The system SHALL describe the effect of dietary rules in terms of what it
excluded, and MUST NOT state or imply that a suggestion, ingredient, or meal is
safe, suitable, or free from anything.

#### Scenario: Filtering is described as filtering

- **WHEN** the effect of a rule is shown
- **THEN** it describes what was excluded

#### Scenario: No safety claim is made

- **WHEN** a suggestion is shown to a user with allergen rules
- **THEN** it is not described as safe or free from any ingredient

#### Scenario: The limits are stated where rules are entered

- **WHEN** the user records an allergen
- **THEN** they are told the app filters suggestions and cannot verify food

### Requirement: Rules are asked for once and editable thereafter

The system SHALL offer to record dietary rules during onboarding, SHALL allow
that to be skipped, and SHALL make rules editable afterwards.

A user with no rules SHALL see no dietary behaviour anywhere in the app.

#### Scenario: Onboarding asks

- **WHEN** the user completes onboarding
- **THEN** they have been given the opportunity to record dietary rules

#### Scenario: Skipping costs nothing

- **WHEN** the user skips the question
- **THEN** onboarding completes
- **AND** no rules are recorded

#### Scenario: Rules are editable later

- **WHEN** the user opens settings
- **THEN** they can add, change, and remove rules

#### Scenario: No rules means no dietary behaviour

- **GIVEN** no rules are recorded
- **WHEN** suggestions are produced
- **THEN** nothing is excluded or re-ranked on dietary grounds
