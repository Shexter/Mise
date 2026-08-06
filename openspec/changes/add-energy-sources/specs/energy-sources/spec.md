## Purpose

Where the calorie target comes from, for people who already have better
information than a form can collect — with a separate way in for each kind of
information, and without the regular onboarding changing at all.

## ADDED Requirements

### Requirement: The regular onboarding is unchanged

The system SHALL keep the existing onboarding flow exactly as it is, and MUST
NOT add, remove, or reorder any question in it.

#### Scenario: The default path is identical

- **WHEN** a user completes the regular onboarding
- **THEN** they answer the same questions, in the same order, as before

#### Scenario: No routing question is inserted

- **WHEN** the regular onboarding runs
- **THEN** the user is not asked which source they want

#### Scenario: The resulting target is unchanged

- **GIVEN** the same answers as before this change
- **WHEN** the regular onboarding completes
- **THEN** the calculated target is the same

### Requirement: The entrance offers a separate way in per source

The system SHALL present, at the entrance to onboarding, a distinct entry point
for each supported source, with the regular flow as the primary one.

#### Scenario: Entry points are offered

- **WHEN** the entrance is shown
- **THEN** a way in is offered for each supported source

#### Scenario: The regular flow is primary

- **WHEN** the entrance is shown
- **THEN** the regular flow is the most prominent option

#### Scenario: Choosing an entrance starts that flow

- **WHEN** the user chooses a source's entry point
- **THEN** that source's flow begins

### Requirement: Each measurement provider has its own flow and its own fields

The system SHALL provide a distinct flow per measurement provider, asking for
the fields that provider prints, and SHALL derive fat-free mass with logic
specific to that provider.

The system MUST NOT ask one provider's user for another provider's fields.

#### Scenario: A provider is asked for what it prints

- **WHEN** a provider's flow runs
- **THEN** it asks for fields that provider reports

#### Scenario: Derivation is provider-specific

- **GIVEN** two providers reporting equivalent information in different fields
- **WHEN** fat-free mass is derived
- **THEN** each is derived by its own provider's logic

#### Scenario: A directly reported fat-free mass is used as reported

- **GIVEN** a provider that reports fat-free mass directly
- **WHEN** its flow runs
- **THEN** the reported value is used
- **AND** it is not recomputed from other fields

#### Scenario: Bone mineral content is accounted for where it is reported separately

- **GIVEN** a provider reporting lean tissue and bone mineral content separately
- **WHEN** fat-free mass is derived
- **THEN** both are accounted for

#### Scenario: Adding a source without its logic is a build failure

- **WHEN** a source is added to the supported set
- **THEN** omitting its derivation is a compile-time error

### Requirement: A flow asks only for what its source needs

The system SHALL ask, in each flow, only for the inputs that source's
calculation requires, and MUST NOT collect fields on the possibility of a later
change of source.

Where a later change of source requires inputs not previously collected, the
system SHALL ask for them at that point.

#### Scenario: A measured flow does not ask for unused details

- **WHEN** a measurement flow runs
- **THEN** it does not ask for details its calculation does not use

#### Scenario: Switching later asks for what is newly needed

- **GIVEN** a user whose source did not require some details
- **WHEN** they change to a source that requires them
- **THEN** they are asked for them at that point

#### Scenario: Uncollected details are absent, not zero

- **WHEN** a detail was never collected
- **THEN** it is stored as absent
- **AND** it is not stored as zero

### Requirement: One measurement is retained per provider

The system SHALL retain at most one current measurement per provider, and
SHALL NOT discard one provider's measurement when another provider becomes
active.

#### Scenario: Switching provider preserves the previous measurement

- **GIVEN** a measurement from one provider
- **WHEN** the user switches to another provider
- **THEN** the first measurement is retained

#### Scenario: Switching back needs no re-entry

- **GIVEN** measurements from two providers
- **WHEN** the user switches back to the earlier one
- **THEN** its measurement is used without being re-entered

#### Scenario: A new measurement replaces its own provider's

- **GIVEN** a measurement from a provider
- **WHEN** a newer measurement from that same provider is entered
- **THEN** it replaces the previous one

#### Scenario: Only the active provider computes the target

- **GIVEN** measurements from two providers
- **WHEN** the target is computed
- **THEN** only the active provider's measurement is used

### Requirement: The source and its inputs are changeable in settings

The system SHALL allow the user to change the active source, enter or replace a
measurement, and change a stated figure, from settings.

#### Scenario: The active source is changeable

- **WHEN** the user changes the active source in settings
- **THEN** the target is produced by the new source

#### Scenario: A measurement is replaceable

- **WHEN** the user enters a new measurement in settings
- **THEN** it replaces that provider's previous one

#### Scenario: Returning to estimation is possible

- **WHEN** the user changes the source to estimation
- **THEN** the target is estimated from the profile

#### Scenario: The active source is visible

- **WHEN** the user views their calorie target
- **THEN** they can see which source produced it

### Requirement: A stated figure is qualified before it is used

Where the user states a figure, the system SHALL ask what that figure
represents — resting energy, total daily energy, or an already-adjusted target
— and SHALL apply only the transformations appropriate to that kind.

#### Scenario: The kind is asked

- **WHEN** the user states a figure
- **THEN** they are asked what kind of figure it is

#### Scenario: A resting figure is scaled and adjusted

- **GIVEN** a figure stated as resting energy
- **THEN** the activity level and the goal are applied

#### Scenario: A total figure is adjusted only

- **GIVEN** a figure stated as total daily energy
- **THEN** the goal is applied
- **AND** the activity level is not applied again

#### Scenario: An adjusted target is used as given

- **GIVEN** a figure stated as an already-adjusted target
- **THEN** the figure is used unchanged

### Requirement: An implausible value is questioned, never silently changed

Where a supplied value falls outside a plausible range for what it claims to be,
the system SHALL tell the user and SHALL allow them to proceed.

The system MUST NOT silently adjust, clamp, or reject the value.

#### Scenario: An implausible value is flagged

- **WHEN** a supplied value is outside the plausible range
- **THEN** the user is told

#### Scenario: The user may proceed anyway

- **GIVEN** a flagged value
- **WHEN** the user confirms it
- **THEN** it is used as given

#### Scenario: Nothing is silently clamped

- **WHEN** an out-of-range value is accepted
- **THEN** the stored value is the value the user gave

#### Scenario: A very low target is flagged prominently

- **WHEN** a resulting target falls below the app's minimum
- **THEN** the user is told before it is applied

### Requirement: Every computable estimate is shown when choosing a source

Where more than one source can produce a target, the system SHALL show what each
would produce at the point the user chooses between them.

#### Scenario: Alternatives are shown

- **WHEN** the user changes source
- **THEN** what each available source would produce is shown

#### Scenario: The user's choice is not overridden

- **GIVEN** a chosen source differing from another available one
- **WHEN** the target is set
- **THEN** the chosen source is used

#### Scenario: An uncomputable source is not shown as zero

- **WHEN** a source cannot be computed
- **THEN** no figure is shown for it

### Requirement: Recalculation respects the active source

Where the profile changes, the system SHALL recompute the target only where the
active source derives it, and MUST NOT overwrite a stated figure.

#### Scenario: A stated target survives an unrelated edit

- **GIVEN** a target from a stated figure
- **WHEN** the user changes their weight
- **THEN** the stated target is unchanged

#### Scenario: An estimated target still recalculates

- **GIVEN** an estimated target
- **WHEN** the user changes their weight
- **THEN** the target is recomputed

#### Scenario: A measured target recalculates from its measurement

- **GIVEN** a measured target
- **WHEN** the user changes their activity level
- **THEN** the target is recomputed from that provider's measurement

#### Scenario: Past days keep their target

- **WHEN** a target changes for any reason
- **THEN** days already recorded keep the target that was active then

### Requirement: A stale measurement is disclosed, not silently trusted

Where the user's current weight has diverged materially from the weight recorded
at measurement, the system SHALL tell the user the derived target is less
reliable and SHALL offer to update the measurement.

#### Scenario: Divergence is disclosed

- **GIVEN** a measurement taken at a materially different weight
- **WHEN** the target is shown
- **THEN** the user is told it is less reliable

#### Scenario: The target still works

- **GIVEN** a stale measurement
- **WHEN** the target is used
- **THEN** it is still applied

#### Scenario: Updating clears the disclosure

- **WHEN** the user supplies a current measurement
- **THEN** the disclosure is no longer shown

### Requirement: Only the fields that compute something are stored

The system SHALL store only the measurement fields a calorie target is computed
from, and MUST NOT store or display other body-composition metrics.

#### Scenario: Unused metrics are not collected

- **WHEN** a measurement is entered
- **THEN** only fields the target is computed from are asked for

#### Scenario: No assessment is derived

- **WHEN** a measurement is held
- **THEN** no rating, score, or evaluation of the user's body is produced

### Requirement: The app computes a target and evaluates nobody

The system SHALL describe a calorie target as a calculation and its inputs as
inputs, and MUST NOT state or imply an assessment of the user's body, health,
fitness, or progress.

#### Scenario: No evaluation is offered

- **WHEN** a measurement is entered
- **THEN** no judgement about the user's body is shown

#### Scenario: No health claim accompanies a target

- **WHEN** a calorie target is shown
- **THEN** no claim about health, fitness, or a medical outcome is made

#### Scenario: A more precise input does not become a stronger claim

- **GIVEN** a target derived from a measurement
- **WHEN** it is described
- **THEN** it is described as a calculation
- **AND** not as a diagnosis, assessment, or recommendation
