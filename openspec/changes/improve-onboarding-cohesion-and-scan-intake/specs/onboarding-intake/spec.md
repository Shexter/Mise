## Purpose

Defines a cohesive energy-target introduction and a transparent, review-first
way to populate the existing DEXA and InBody energy inputs from report images.

## ADDED Requirements

### Requirement: The welcome screen explains one practical setup outcome
The system SHALL introduce onboarding around setting a useful daily energy
target so tracked meals have context. The copy MUST be calm, practical,
transparent, and non-judgmental, and MUST NOT use AI terminology, health
promises, or claims of precision.

#### Scenario: First-run purpose is clear
- **WHEN** a person opens the welcome screen before creating a profile
- **THEN** the screen explains why Mise needs an energy target
- **AND** presents one clear primary setup action

#### Scenario: Privacy is stated precisely
- **WHEN** the welcome screen describes local storage or report analysis
- **THEN** it distinguishes data kept on the phone from images explicitly sent to the person's selected provider

#### Scenario: The welcome does not evaluate the person
- **WHEN** energy-target setup is introduced
- **THEN** no copy diagnoses, scores, ranks, or judges the person's body, health, fitness, or progress

### Requirement: The estimated onboarding path keeps its behaviour
The system SHALL keep the existing estimated path as the primary entrance and
MUST preserve its route order, questions, required taps, calculations, and
resulting profile values.

#### Scenario: Primary setup follows the existing route
- **WHEN** the person chooses the primary setup action
- **THEN** the existing estimated onboarding route starts without an added routing screen or question

#### Scenario: Copy cohesion does not change calculation
- **WHEN** the same estimated inputs are entered before and after this change
- **THEN** the same target and profile values are produced

### Requirement: Scan intake is available where measured inputs are edited
The system SHALL offer report-image intake for the existing DEXA and InBody
sources during first-run onboarding and during later energy-source updates from
Settings. Manual entry MUST remain available without requiring image analysis.

#### Scenario: DEXA report can be selected during onboarding
- **GIVEN** the DEXA entrance was chosen
- **WHEN** the person opens the energy-input step
- **THEN** they can select a report image or enter the DEXA fields manually

#### Scenario: InBody report can be selected from Settings
- **GIVEN** a profile already exists
- **WHEN** the person edits the InBody source from Settings
- **THEN** they can select a report image or edit the InBody fields manually

#### Scenario: Image access is declined
- **WHEN** image-library or camera access is unavailable or declined
- **THEN** the person can continue with manual entry

### Requirement: Sending a report is an explicit provider request
The system SHALL send a selected report image only after an explicit analysis
action and only through the provider associated with the person's stored API
key. The image MUST NOT be sent to a Mise server, written to the database,
included in export, or logged.

#### Scenario: Selection alone sends nothing
- **WHEN** a person selects or previews a report image
- **THEN** no provider request is made until they choose to analyse it

#### Scenario: Analysis uses the selected provider
- **WHEN** report analysis starts
- **THEN** the image is sent through the same provider selection and error contract used by other vision features

#### Scenario: No usable key exists
- **WHEN** analysis is requested without a recognised API key
- **THEN** the system explains how to add a key
- **AND** preserves the image for review or manual entry

### Requirement: Extraction returns only the declared candidate fields
The system SHALL structure a report into candidate values for `provider`,
`weightKg`, `bodyFatPct`, `leanTissueKg`, `boneMineralContentKg`,
`fatFreeMassKg`, `bmrKcal`, and `confidence`. Missing, ambiguous, unreadable,
or unstated values MUST remain absent and MUST NOT be inferred from other
values merely to complete the response.

#### Scenario: DEXA fields are read in DEXA terms
- **WHEN** a readable DEXA report states weight, body-fat percentage, lean tissue, and bone mineral content
- **THEN** those stated values are returned as candidates
- **AND** an unrelated InBody-only value is not invented

#### Scenario: InBody fields are read in InBody terms
- **WHEN** a readable InBody report states weight, Fat Free Mass, and BMR
- **THEN** those stated values are returned as candidates
- **AND** skeletal muscle mass is not substituted for Fat Free Mass

#### Scenario: Provider cannot be established
- **WHEN** the report cannot be identified as DEXA or InBody
- **THEN** the provider candidate is `unknown`
- **AND** the person can choose a source manually

#### Scenario: Field is missing
- **WHEN** a declared field is not visible or not stated on the report
- **THEN** that field is absent rather than zero, estimated, or derived

#### Scenario: Response is not structurally readable
- **WHEN** the provider returns empty, malformed, or non-object content
- **THEN** extraction fails with the shared malformed-response error
- **AND** no candidate is applied

### Requirement: Candidate values are normalised defensively
The system SHALL convert explicitly imperial mass values to kilograms, discard
non-finite and structurally invalid values, and evaluate candidates against
named extraction bounds before offering automatic prefill. It MUST NOT silently
clamp or rewrite a value to fit a bound.

#### Scenario: Pounds are converted
- **WHEN** a report value is explicitly expressed in pounds
- **THEN** its kilogram candidate is calculated using the shared unit conversion

#### Scenario: Unit is not defensible
- **WHEN** a mass value has an unknown or contradictory unit
- **THEN** that candidate is absent

#### Scenario: Candidate is outside the extraction bounds
- **WHEN** a candidate such as weight at or below 20 kg or body fat outside 3-60 percent is returned
- **THEN** it is not automatically accepted as a confirmed value
- **AND** the review explains that the field needs manual checking

#### Scenario: Outlier is manually confirmed
- **GIVEN** an extracted candidate was withheld or flagged
- **WHEN** the person manually enters and confirms an outlying value
- **THEN** the existing energy-source warning contract applies
- **AND** the value is not silently clamped or rejected

### Requirement: Every extraction is reviewed before use
The system SHALL show the report preview, detected provider, confidence,
editable source-specific fields, and scan date before any candidate can affect
saved state. Extracted values MUST be treated as suggestions and MUST require an
explicit confirmation action.

#### Scenario: Readable report pre-populates review
- **WHEN** extraction returns usable candidates
- **THEN** source-relevant fields are pre-populated in an editable review
- **AND** the profile and saved measurements remain unchanged

#### Scenario: Low confidence remains editable
- **WHEN** extraction confidence is low
- **THEN** the review calls attention to checking the values
- **AND** manual editing and confirmation remain available

#### Scenario: Detected provider differs from selected source
- **GIVEN** the person selected DEXA and the report is detected as InBody, or the reverse
- **WHEN** review opens
- **THEN** the system discloses the mismatch
- **AND** does not silently switch the active source

#### Scenario: Scan date is confirmed separately
- **WHEN** report candidates are reviewed
- **THEN** the person can enter or confirm the measurement date
- **AND** the system does not invent a date when extraction did not return one

#### Scenario: Review is cancelled
- **WHEN** the person cancels or leaves without confirming
- **THEN** no extracted candidate, source change, or target change is saved

### Requirement: Confirmation maps into the existing energy-source model
The system SHALL map confirmed fields into the existing per-provider
measurement or stated-resting contracts and MUST NOT persist the raw extraction
response, confidence, thumbnail URI, or unused report fields.

#### Scenario: Confirmed DEXA measurement is saved
- **GIVEN** weight plus body-fat percentage, or weight plus lean tissue and bone mineral content, are confirmed
- **WHEN** the person saves the DEXA review
- **THEN** the existing DEXA derivation and per-provider replacement behaviour are used

#### Scenario: Confirmed InBody measurement is saved
- **GIVEN** weight and printed Fat Free Mass are confirmed
- **WHEN** the person saves the InBody review
- **THEN** the printed Fat Free Mass is used as given by the existing InBody path

#### Scenario: InBody BMR is explicitly chosen
- **GIVEN** a BMR candidate was read from an InBody report
- **WHEN** the person explicitly chooses to use it instead of the measurement path
- **THEN** it is stored as the existing stated resting figure
- **AND** it is not stored as an InBody measurement field

#### Scenario: Unused candidates are discarded
- **WHEN** a report contains both source-relevant and unrelated body-composition fields
- **THEN** only confirmed fields required by the chosen existing calculation path are persisted

#### Scenario: Existing provider switching remains non-destructive
- **WHEN** a confirmed scan replaces one provider's current measurement
- **THEN** the other provider's saved measurement remains unchanged

### Requirement: Extraction state is temporary and recoverable
The system SHALL preserve the selected image and editable draft during a
pending, retryable, or cancelled request, and SHALL clear transient extraction
state after a successful save, explicit discard, onboarding reset, or completed
source change.

#### Scenario: Provider request fails
- **WHEN** analysis fails because of network, timeout, rate limit, billing, or provider availability
- **THEN** the image and manual fields remain available
- **AND** the system offers the recovery action appropriate to that failure

#### Scenario: Request is cancelled
- **WHEN** the person cancels an in-flight analysis
- **THEN** the request stops through the cancellation signal
- **AND** the report remains available for retry or manual entry

#### Scenario: Confirmation succeeds
- **WHEN** a reviewed measurement or stated figure is saved successfully
- **THEN** the transient image URI, candidates, confidence, and extraction phase are cleared

### Requirement: Review states use Mise's accessible interface contract
The system SHALL use the existing semantic tokens and shared interface
components for default, pending, success, error, disabled, and focus states.
Report evidence MUST remain visually unaltered, and pending and error states
MUST have plain-language labels and accessible semantics.

#### Scenario: Analysis is pending
- **WHEN** report analysis is in progress
- **THEN** a labelled busy state is exposed visually and to assistive technology
- **AND** reduced-motion preferences receive a static treatment

#### Scenario: Text is enlarged
- **WHEN** the device uses large accessibility text
- **THEN** review fields, warnings, provider mismatch copy, and actions remain readable and operable without horizontal clipping

#### Scenario: Report evidence is shown
- **WHEN** the selected report is displayed during review
- **THEN** it is not recoloured, blurred, washed, or decorated in a way that obscures verification
