## Purpose

Where the calorie target comes from, for people who already have better
information than a form can collect — without making the form worse for
everyone else, and without the app starting to evaluate anybody.

## ADDED Requirements

### Requirement: A calorie target has a recorded source

The system SHALL record which of three sources produced the current calorie
target: estimated from the profile, derived from a body-composition
measurement, or stated by the user.

The source SHALL be visible to the user and SHALL be changeable.

#### Scenario: The source is recorded

- **WHEN** a calorie target is set
- **THEN** the source that produced it is recorded

#### Scenario: The source is visible

- **WHEN** the user views their calorie target
- **THEN** they can see where it came from

#### Scenario: The source can be changed

- **WHEN** the user changes the source
- **THEN** the target is produced by the new source

### Requirement: The existing path stays the default and does not get longer

The system SHALL keep estimation from the profile as the default source, and
MUST NOT add required questions to that path.

A user who does not have a measurement or a figure SHALL complete onboarding
with no more steps than before, plus the single question that selects a source.

#### Scenario: The default path is unchanged

- **GIVEN** a user with no measurement and no figure
- **WHEN** they complete onboarding
- **THEN** they answer the same questions as before, plus the source question

#### Scenario: The default is preselected

- **WHEN** the source question is shown
- **THEN** estimation from the profile is already selected

#### Scenario: Branch questions are not asked of the default path

- **GIVEN** the user chose estimation
- **THEN** they are not asked for a body fat percentage or a stated figure

### Requirement: A body-composition measurement derives resting energy from fat-free mass

Where the user supplies a body fat percentage, the system SHALL derive resting
energy from fat-free mass rather than inferring composition from height and
weight.

The system SHALL record the weight at which the measurement was taken and the
date it was taken.

#### Scenario: A measurement produces a target

- **GIVEN** a body fat percentage, a measurement weight, and a date
- **WHEN** the target is computed
- **THEN** it is derived from fat-free mass

#### Scenario: The measurement date is required

- **WHEN** the user supplies a body fat percentage
- **THEN** they are asked when it was measured

#### Scenario: Activity and goal still apply

- **WHEN** a target is derived from a measurement
- **THEN** the activity level and the goal are applied to it

#### Scenario: A measurement can be replaced

- **WHEN** the user supplies a newer measurement
- **THEN** it replaces the previous one

### Requirement: Only the fields that compute something are stored

The system SHALL store body fat percentage, the weight at measurement, and the
measurement date, and MUST NOT store or display other body-composition metrics.

#### Scenario: Unused metrics are not collected

- **WHEN** the user enters a measurement
- **THEN** they are asked only for fields the target is computed from

#### Scenario: No assessment is derived

- **WHEN** a measurement is held
- **THEN** no rating, score, or evaluation of the user's body is produced

### Requirement: A stated figure is qualified before it is used

Where the user states a figure, the system SHALL ask what that figure
represents — resting energy, total daily energy, or an already-adjusted target
— and SHALL apply only the transformations appropriate to that kind.

#### Scenario: The kind is asked

- **WHEN** the user states a figure
- **THEN** they are asked what kind of figure it is

#### Scenario: A resting figure is scaled and adjusted

- **GIVEN** a figure stated as resting energy
- **WHEN** the target is computed
- **THEN** the activity level and the goal are applied

#### Scenario: A total figure is adjusted only

- **GIVEN** a figure stated as total daily energy
- **WHEN** the target is computed
- **THEN** the goal is applied
- **AND** the activity level is not applied again

#### Scenario: An adjusted target is used as given

- **GIVEN** a figure stated as an already-adjusted target
- **WHEN** the target is computed
- **THEN** the figure is used unchanged

### Requirement: An implausible figure is questioned, never silently changed

Where a supplied figure or measurement falls outside a plausible range for the
kind it was stated to be, the system SHALL tell the user and SHALL allow them to
proceed.

The system MUST NOT silently adjust, clamp, or reject the value.

#### Scenario: An implausible figure is flagged

- **WHEN** a stated figure is outside the plausible range for its kind
- **THEN** the user is told

#### Scenario: The user may proceed anyway

- **GIVEN** a flagged figure
- **WHEN** the user confirms it
- **THEN** it is used as given

#### Scenario: Nothing is silently clamped

- **WHEN** a figure outside the range is accepted
- **THEN** the stored value is the value the user gave

#### Scenario: A very low target is flagged prominently

- **WHEN** a resulting target falls below the app's minimum
- **THEN** the user is told before it is applied

### Requirement: Every computable estimate is shown when the source is chosen

Where more than one source can produce a target, the system SHALL show what each
would produce at the point the user chooses between them.

#### Scenario: Alternatives are shown

- **GIVEN** the profile can produce an estimate
- **WHEN** the user states a figure
- **THEN** the estimate from the profile is also shown

#### Scenario: The user's choice is not overridden

- **GIVEN** a stated figure differing from the app's estimate
- **WHEN** the target is set
- **THEN** the stated figure is used

#### Scenario: An uncomputable source is not shown as zero

- **WHEN** a source cannot be computed
- **THEN** no figure is shown for it

### Requirement: Recalculation respects the source

Where the profile changes, the system SHALL recompute the target only where the
recorded source derives it, and MUST NOT overwrite a stated figure.

#### Scenario: A stated target survives an unrelated edit

- **GIVEN** a target from a stated figure
- **WHEN** the user changes their weight
- **THEN** the stated target is unchanged

#### Scenario: An estimated target still recalculates

- **GIVEN** a target estimated from the profile
- **WHEN** the user changes their weight
- **THEN** the target is recomputed

#### Scenario: A derived target recalculates from the measurement

- **GIVEN** a target derived from a measurement
- **WHEN** the user changes their activity level
- **THEN** the target is recomputed from the measurement

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
