## Purpose

Help people compare planned meals with existing nutrition targets and adjust portions while preserving uncertainty and the distinction between planned and eaten food.

## ADDED Requirements

### Requirement: Planned and eaten nutrition remain distinct
The system SHALL show estimated planned calories/protein/carbohydrates/fat against existing confirmed targets without writing target changes or consumed meals. Today projections SHALL count linked eaten entries once. Partial schedules and unknown nutrients SHALL be identified.

#### Scenario: Planned meal is logged
- **WHEN** a planned lunch is linked to a saved meal with a corrected portion
- **THEN** Eaten uses the saved meal and Projected uses that actual meal plus remaining unlogged plans
- **AND** lunch is not counted again at its planned amount

#### Scenario: Missing target or partial nutrition
- **WHEN** a person has no targets or any included entry lacks nutrient data
- **THEN** scheduling stays available and the comparison identifies unavailable targets or incomplete totals
- **AND** no complete daily fit or zero-valued missing nutrient is claimed

#### Scenario: Future target changes
- **WHEN** the profile target changes after a week is scheduled
- **THEN** future comparisons use the applicable target with projection/source disclosure
- **AND** recipe portions stay unchanged until the person approves an adjustment

### Requirement: Portion fitting is bounded and explicit
The system SHALL offer a reviewable adjustment for one selected unlocked meal using known positive targets and complete calories and P/C/F inputs. Automatic choices SHALL use multipliers from 0.5 to 2.0 in 0.25 steps. Preview SHALL show the multiplier, estimated nutrient changes, residual target differences, ingredient changes and grocery effects. Apply SHALL persist these consistently; cancel SHALL preserve the previous plan.

#### Scenario: Portion improvement is available
- **WHEN** complete nutrition and targets allow a better portion fit
- **THEN** the system proposes a bounded change with residuals and applies it only after confirmation
- **AND** profile targets and locked meals are not modified

#### Scenario: Macro ratio cannot fit
- **WHEN** scaling the chosen recipe cannot improve the target fit within the allowed range
- **THEN** the system explains the remaining difference and offers manual portions or another recipe
- **AND** it does not claim exact matching or silently substitute ingredients

#### Scenario: Data is insufficient for fitting
- **WHEN** included nutrition is incomplete or no positive known target is available
- **THEN** automatic fitting is unavailable with an explanation and manual planning remains available

### Requirement: Scaling uses actual accepted quantities
The system SHALL derive recipe ingredients, batch demand, and estimated nutrition from the same accepted quantities and yield. It SHALL reject nonpositive or nonfinite portion values and SHALL NOT invent raw/cooked, density, unit or package conversions.

#### Scenario: Production increases without changing eaten portions
- **WHEN** a four-portion batch is increased to six portions while lunch remains one portion
- **THEN** grocery demand scales by 1.5 while that lunch retains one portion's nutrition

#### Scenario: Rounding or conversion is unavailable
- **WHEN** a portion adjustment produces a fractional whole ingredient or an unsupported unit conversion
- **THEN** the app preserves the stated fraction or requests a reviewed amount instead of inventing a conversion
- **AND** nutrition is recomputed for accepted quantities or explicitly marked incomplete
