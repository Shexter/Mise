## ADDED Requirements

### Requirement: Approximate matching works for non-Latin scripts

The system SHALL score textual similarity in a way suited to the script of the
text being compared, so that approximate matching of non-Latin references is
comparable in quality to matching of Latin ones.

A reference written in an ideographic or syllabic script SHALL be matchable
against a stored alias in the same script without an exact match, at scores that
reach the same confidence bands the Latin path uses.

The system MUST NOT transliterate non-Latin text in order to score it.

#### Scenario: An in-script reference matches a stored alias approximately

- **GIVEN** a stored alias in Chinese for oyster sauce
- **WHEN** a reference containing a brand prefix and that product name in
  Chinese is resolved
- **THEN** it matches the correct canonical ingredient above the confirm
  threshold

#### Scenario: A short ideographic phrase is scored meaningfully

- **WHEN** a two-character ideographic product name is compared with a stored
  alias for the same food
- **THEN** the resulting score reflects their similarity rather than collapsing
  toward zero

#### Scenario: Scoring never romanises

- **WHEN** any non-Latin reference is scored
- **THEN** no romanised form of it is produced or stored

### Requirement: Mixed-script references are matched on their meaningful part

The system SHALL handle references combining scripts — a Latin brand with an
in-script product name, or the reverse — without one script's contribution
overwhelming the other.

#### Scenario: A Latin brand does not drown an in-script product name

- **WHEN** a reference pairs a Latin brand with an in-script product name
- **THEN** it resolves to the canonical ingredient the product name denotes
- **AND** not to whichever canonical ingredient the brand text happens to
  resemble

#### Scenario: Width and form variants fold together

- **WHEN** a reference uses full-width Latin or half-width Kana characters
- **THEN** it matches the stored alias written in ordinary forms

### Requirement: Han variant forms match one another

The system SHALL match a Han reference against a stored alias written in the
other variant form, so that a traditional-character reference and a
simplified-character alias for the same ingredient resolve to the same canonical
ingredient.

Variant folding SHALL apply to matching only. Stored aliases and displayed names
SHALL keep the form they were written in.

#### Scenario: A simplified reference matches a traditional alias

- **WHEN** a reference is written in simplified characters
- **AND** the stored alias for that ingredient is written in traditional
  characters
- **THEN** they match

#### Scenario: The reverse also matches

- **WHEN** a reference is written in traditional characters
- **AND** the stored alias is written in simplified characters
- **THEN** they match

#### Scenario: Display keeps the original form

- **WHEN** a reference is matched through variant folding
- **THEN** neither the stored alias nor the displayed name is converted

### Requirement: Romanised references resolve to the ingredients they name

The system SHALL resolve a Latin-script reference that romanises a non-Latin
ingredient name to that ingredient, including where the romanisation differs
from the seeded one in spelling, spacing, or hyphenation.

#### Scenario: A spelling variant resolves

- **WHEN** a reference romanises an ingredient with a spelling other than the
  seeded one
- **THEN** it resolves to that ingredient

#### Scenario: Spacing and hyphenation do not defeat a match

- **WHEN** a romanised reference differs from the seeded form only in spacing or
  hyphenation
- **THEN** it resolves to the same ingredient

#### Scenario: Distinct ingredients with similar romanisations stay distinct

- **GIVEN** two different ingredients whose romanisations are similar
- **WHEN** either is referenced
- **THEN** it does not resolve to the other

### Requirement: Candidate retrieval is script-independent

The system SHALL retrieve candidate aliases for scoring using a method that
works for the script of the reference, so that a correct candidate is never
withheld from the scorer because the reference is not Latin.

#### Scenario: A non-Latin reference retrieves its correct candidate

- **WHEN** candidates are retrieved for an in-script reference whose canonical
  ingredient has an in-script alias
- **THEN** that alias is among the candidates handed to the scorer

#### Scenario: Retrieval stays bounded

- **WHEN** candidates are retrieved for any reference
- **THEN** the candidate set remains bounded rather than the whole alias table

### Requirement: Confidence thresholds are justified per script

The system SHALL establish that its accept and confirm thresholds are
appropriate for each script it scores, rather than assuming values tuned on one
script transfer to another.

Where a script requires different thresholds, they SHALL be named and adjustable
in the same way the existing ones are.

#### Scenario: Non-Latin thresholds are evidenced

- **WHEN** the thresholds applied to non-Latin scoring are reviewed
- **THEN** they are supported by measurements over a non-Latin fixture corpus

#### Scenario: The Latin path is unchanged

- **WHEN** Latin references from the existing corpus are scored
- **THEN** their band placement is unchanged from before this change
