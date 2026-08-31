## Purpose

Defines a calm, progressive, and privacy-transparent energy-intake experience
that remains usable without a vision API key and never exposes database-backed
onboarding before local storage is ready.

## Requirements

### Requirement: Scan intake establishes key readiness before report selection
For a DEXA or InBody intake, the system SHALL determine whether a supported
vision-provider API key is available before offering camera or photo-library
selection. While key readiness is unknown, the system SHALL show a stable
loading state and SHALL NOT offer an action that can send a report.

#### Scenario: Existing key proceeds to scan choice
- **WHEN** a person enters DEXA or InBody intake and a supported key is already stored
- **THEN** the system shows the scan-or-manual choice without requiring key setup again
- **AND** the scan choice states the provider disclosure before any send action

#### Scenario: Missing key shows guidance first
- **WHEN** a person enters DEXA or InBody intake and no supported key is stored
- **THEN** the system shows the API-key explainer before camera or photo-library actions
- **AND** offers “Set up an API key” and “Enter values manually” as clear actions

#### Scenario: Key readiness check fails
- **WHEN** secure key storage cannot be read
- **THEN** the system explains that key readiness could not be checked
- **AND** offers retry and immediate manual entry without treating the failure as proof that no key exists

### Requirement: API-key guidance is truthful, practical, and provider-neutral
The system SHALL explain that report extraction needs a user-owned vision API
key, that the same key can support later photo meal logging and calorie
estimation, and that a selected report is sent directly from the device to the
provider associated with that key. It MUST NOT describe provider-backed report
extraction as wholly on-device or imply that Mise operates a relay server.

The system MAY recommend Gemini as the quickest documented setup path, but it
SHALL continue to accept every supported provider and SHALL qualify pricing,
limits, setup-time, and provider data-handling statements as current
third-party terms.

#### Scenario: Person reads the no-key explainer
- **WHEN** the no-key guidance is displayed
- **THEN** it explains why the key is needed, its later reuse, the direct-to-provider data path, and the availability of manual entry
- **AND** it does not claim that the scan stays entirely on-device

#### Scenario: Gemini is recommended
- **WHEN** the guidance presents Gemini as the low-friction option
- **THEN** it describes the current free tier and approximate setup time without promising permanent price or availability
- **AND** provides access to current provider terms or documentation
- **AND** does not hide or disable Anthropic or OpenAI setup

#### Scenario: Report is about to be sent
- **WHEN** a person has selected a report image and reaches the explicit extraction action
- **THEN** the system repeats which data leaves the phone and that provider terms apply
- **AND** sends nothing until the person invokes that action

### Requirement: Manual entry is never blocked by API-key setup
DEXA and InBody intake SHALL provide an immediate manual path when the key is
missing, unreadable, rejected, or intentionally deferred. Choosing manual
entry SHALL neither open the image picker nor invoke a provider and SHALL not
prevent later key setup from onboarding or Settings.

#### Scenario: Person chooses manual entry from the explainer
- **WHEN** the person selects “Enter values manually”
- **THEN** the system immediately starts the source-specific manual flow
- **AND** performs no image or provider operation

#### Scenario: Person leaves key setup
- **WHEN** the person cancels or backs out of key setup initiated from scan intake
- **THEN** the system returns to the same DEXA or InBody intake
- **AND** keeps manual entry available without requiring another key attempt

#### Scenario: Provider rejects a configured key
- **WHEN** extraction fails because the stored key is invalid, unauthorized, or unsupported
- **THEN** the system offers key repair, retry where meaningful, and manual entry
- **AND** does not discard the selected report or already confirmed manual values

### Requirement: Key setup returns to the initiating intake
The system SHALL carry a bounded, transient return intent when API-key setup is
opened from energy intake. Successful save, cancellation, and back navigation
SHALL return to the initiating onboarding or Settings energy flow rather than
advance through an unrelated default onboarding route. Arbitrary external or
unrecognised return destinations MUST NOT be followed.

#### Scenario: Onboarding scan user saves a key
- **WHEN** a DEXA or InBody onboarding user completes key setup
- **THEN** the system returns to the same source's scan-or-manual choice
- **AND** preserves any transient source selection and report draft that remains valid

#### Scenario: Settings user saves a key
- **WHEN** key setup was initiated from the Settings energy editor
- **THEN** the system returns to that editor rather than the first-run dietary step

#### Scenario: Return intent is invalid
- **WHEN** key setup receives an absent, expired, or unrecognised return intent
- **THEN** the system uses the existing safe default key-setup destination
- **AND** never treats the value as an arbitrary route or URL

### Requirement: Energy inputs use progressive disclosure
The system SHALL present one focused question or one tightly related choice at
a time. A later question SHALL appear only after its prerequisite answer is
confirmed, except that a review summary MAY show confirmed values together.
Back navigation SHALL preserve confirmed and in-progress transient answers
until the person cancels or completes the flow.

#### Scenario: Estimated onboarding remains focused
- **WHEN** a person chooses the estimated entrance
- **THEN** formula sex, birthday/age, height, weight, activity, and goal remain focused steps in the existing order
- **AND** scan-specific questions add no step or tap to that path

#### Scenario: Manual DEXA intake requests only DEXA inputs
- **WHEN** a person chooses manual DEXA intake
- **THEN** the system progressively requests measurement date, weight, and either body-fat percentage or lean tissue plus bone mineral content
- **AND** does not request formula sex, age, height, InBody Fat Free Mass, or printed BMR

#### Scenario: Manual InBody intake requests only InBody inputs
- **WHEN** a person chooses manual InBody intake
- **THEN** the system progressively requests measurement date, weight, printed Fat Free Mass, and the existing optional printed-BMR choice
- **AND** does not request formula sex, age, height, DEXA lean tissue, DEXA bone mineral content, or body-fat percentage

#### Scenario: Scan review has missing required data
- **WHEN** extraction produces only some fields required by the selected source
- **THEN** the system first shows the review evidence and then focuses manual input on each missing or rejected field
- **AND** does not manufacture, pre-confirm, or require unused values

### Requirement: Picker anchors never become invented profile data
Height, weight, and body-fat controls MAY open at a sensible population anchor
to reduce scrolling, but the anchor SHALL remain unconfirmed until the person
adjusts it or explicitly accepts it. Continue and save actions MUST remain
disabled for an unanswered field. An existing saved, typed, or accepted
extracted value SHALL take precedence over an anchor.

#### Scenario: Person opens a fresh numeric picker
- **WHEN** a numeric input has no saved, typed, or accepted extracted value
- **THEN** the control opens near its documented neutral anchor
- **AND** the flow does not store or submit that value until the person adjusts or explicitly confirms it

#### Scenario: Existing value is edited
- **WHEN** a Settings user opens a field with a saved value
- **THEN** the picker starts at that saved value and marks it as existing data
- **AND** cancelling leaves the saved value unchanged

#### Scenario: Units are switched
- **WHEN** a person switches between metric and imperial display units
- **THEN** the system represents the same underlying confirmed measurement in the new unit
- **AND** does not reset the control to its neutral anchor or introduce conversion drift across repeated switches

### Requirement: Formula sex and birthday controls are explicit and minimal
The estimated path SHALL present the existing formula-sex options as an
accessible segmented or scroll choice with no inferred or preselected answer.
The copy SHALL explain that this value is used only by the selected energy
formula and SHALL not present it as gender identity.

Birthday entry SHALL use ergonomic year, month, and day selection, compute age
deterministically using the device's local calendar date, and persist only the
integer age required by the existing profile model. The system MUST NOT retain
the full birth date after age is confirmed.

#### Scenario: Formula sex has not been answered
- **WHEN** the formula-sex step first opens without a saved value
- **THEN** neither option is selected and Continue is disabled
- **AND** the helper explains why the formula asks for the value

#### Scenario: Birthday is confirmed
- **WHEN** a person confirms a valid year, month, and day
- **THEN** the system calculates an age within the accepted age range using the local calendar date
- **AND** stores only the resulting integer age in the onboarding draft and eventual profile

#### Scenario: Leap-day birthday is evaluated
- **WHEN** a valid February 29 birthday is confirmed in a non-leap current year
- **THEN** the age calculation follows one documented, deterministic local-calendar rule
- **AND** produces the same result in pure logic tests and the UI

#### Scenario: Birthday implies an unsupported age
- **WHEN** the selected birthday implies an age outside the existing accepted range
- **THEN** the system explains the accepted range and prevents confirmation
- **AND** does not silently replace the birthday or age

### Requirement: Body-fat input is adjustable without body judgement
The DEXA body-fat path SHALL support coarse quick adjustment and precise
manual decimal entry across the existing 3% to 60% automatic-entry range. Its
neutral starting anchor MAY depend on an already confirmed formula-sex value
but SHALL use one documented neutral fallback when that input is unavailable.
The helper SHALL state the accepted range, explain that reports and reference
bands vary, and avoid grading the person's body.

#### Scenario: Confirmed formula sex informs the anchor
- **WHEN** the DEXA body-fat picker has no actual value and formula sex was previously confirmed
- **THEN** the picker uses the documented sex-specific starting anchor
- **AND** does not treat the anchor as an answer

#### Scenario: Formula sex is unavailable
- **WHEN** the DEXA entrance skipped estimated-profile questions and no body-fat value exists
- **THEN** the picker uses the documented neutral fallback anchor
- **AND** does not ask for formula sex solely to choose an anchor

#### Scenario: Person needs decimal precision
- **WHEN** the report contains a body-fat value that the quick control cannot express exactly
- **THEN** manual entry accepts a finite decimal within 3% to 60%
- **AND** preserves the typed value without rounding it into a different stored measurement

#### Scenario: Person enters an outlier
- **WHEN** a manually typed value falls outside the automatic-entry range
- **THEN** the system does not silently clamp it
- **AND** applies the existing energy-source warning and explicit-confirmation policy rather than presenting an invented replacement

### Requirement: Every field has contextual, non-judgmental guidance
Each focused input SHALL state why it is needed and either its accepted range,
valid options, or report vocabulary. Numeric validation SHALL use the existing
named domain bounds. Population references, when shown, MUST be sourced,
qualified by applicable age/sex context, and phrased as descriptive context
rather than a target, score, diagnosis, or recommendation.

#### Scenario: Numeric field is in range
- **WHEN** a person enters a value within that field's accepted range
- **THEN** the helper remains concise and the input can be confirmed without congratulatory or evaluative language

#### Scenario: Numeric field is invalid
- **WHEN** a value is empty, non-finite, or outside an automatically accepted range
- **THEN** the system identifies the field and accepted range in plain language
- **AND** does not silently clamp, replace, or infer a value

#### Scenario: Reference context is displayed
- **WHEN** a field includes a population reference band
- **THEN** the wording identifies the source and relevant population context
- **AND** makes clear that the band is not a personalised assessment

### Requirement: Extracted values remain reviewable evidence
An extracted report value SHALL remain an unconfirmed candidate until the
person reviews it. The system SHALL preserve the existing provider-mismatch,
confidence, missing-field, physiological-warning, and explicit-confirmation
contracts. The progressive editor SHALL not change the persisted measurement,
active target source, or calorie target until final save succeeds.

#### Scenario: Extraction returns accepted candidates
- **WHEN** report extraction completes with one or more usable values
- **THEN** the system shows the report evidence, detected provider, confidence, and editable candidates
- **AND** requires human confirmation before persistence or target recalculation

#### Scenario: Extracted provider conflicts with selected source
- **WHEN** the detected provider differs from the selected DEXA or InBody source
- **THEN** the system explains the mismatch and offers an explicit source switch or continued manual correction
- **AND** does not switch sources automatically

#### Scenario: Person abandons review
- **WHEN** the person cancels the intake without saving
- **THEN** the previously persisted measurement and calorie target remain unchanged

### Requirement: Database-backed onboarding waits for actual readiness
The application SHALL expose an explicit local-database lifecycle with at
least opening, ready, and unavailable states. It MUST NOT mount a DB-dependent
route, execute a DB query, or enable a DB-backed save merely because a startup
timeout elapsed. The energy route SHALL also check readiness before loading or
saving measurements.

#### Scenario: Database opens slowly
- **WHEN** database opening takes longer than the former startup timeout
- **THEN** the system keeps DB-dependent routes behind the readiness surface
- **AND** issues no query and shows no “Database used before it was opened” toast

#### Scenario: Database opening fails
- **WHEN** local database opening rejects or becomes unavailable
- **THEN** the system shows a calm storage-unavailable state with Retry
- **AND** does not render an apparently usable energy editor that will fail on read or save

#### Scenario: Retry succeeds
- **WHEN** the person retries after a transient database failure and opening succeeds
- **THEN** the system loads the intended onboarding or Settings destination once
- **AND** DB-backed reads begin only after readiness is published

#### Scenario: Energy route is reached during an opening transition
- **WHEN** navigation or state restoration attempts to render energy intake before readiness
- **THEN** the route-level guard shows the shared readiness state and performs no measurement read or write

### Requirement: Progressive controls are accessible and resilient
All new controls SHALL support screen-reader labels, selected/value state,
adjustable or button actions, dynamic text, keyboard/manual entry where
applicable, reduced motion, and touch targets from the existing accessibility
contract. Progress SHALL remain understandable without colour, animation, or
haptics, and interruption SHALL not write partial data.

#### Scenario: Screen reader adjusts a picker
- **WHEN** a screen-reader user focuses a numeric picker
- **THEN** the current value, unit, accepted range, and confirmation state are announced
- **AND** increment, decrement, manual-entry, and confirmation actions are operable

#### Scenario: Reduced motion is enabled
- **WHEN** the operating system requests reduced motion
- **THEN** progressive disclosure and picker settling avoid non-essential motion
- **AND** preserve the same sequence, state, and feedback

#### Scenario: App is interrupted before save
- **WHEN** the app backgrounds, the route unmounts, or the person navigates back before final save
- **THEN** no unconfirmed anchor, full birth date, scan candidate, or partial measurement is persisted

### Requirement: First-run and Settings use the same intake contract
First-run onboarding and later profile/energy updates SHALL share validation,
unit conversion, source-specific questions, key guidance, scan review, and
database readiness behavior. Settings SHALL seed controls from persisted values
and SHALL not overwrite them until an explicit save succeeds.

#### Scenario: Existing profile opens energy intake from Settings
- **WHEN** a person edits DEXA or InBody inputs after onboarding
- **THEN** the system loads that provider's existing measurement after database readiness
- **AND** uses it instead of a population anchor

#### Scenario: Settings edit is cancelled
- **WHEN** the person changes one or more transient fields and then cancels
- **THEN** the persisted profile, measurement, active source, and target remain unchanged

#### Scenario: Source is switched and later revisited
- **WHEN** a person switches between DEXA and InBody and later returns to a provider
- **THEN** that provider's existing saved measurement remains available under the non-destructive energy-source contract

### Requirement: First-run presents starting-point choice with dual setup paths
The system SHALL present a first-run starting-point choice ("Where would you like to start?") letting a person choose between "Daily calorie & macro target" and "Kitchen & meal prep".

#### Scenario: Person chooses calorie targets as starting point
- **WHEN** a person selects "Daily calorie & macro target" on the first screen
- **THEN** the system SHALL immediately start the calorie target setup path (basic calculation or DEXA/InBody scan)
- **AND** it SHALL not require kitchen appliance or pantry setup before calculating the daily target

#### Scenario: Person chooses kitchen & meal prep as starting point
- **WHEN** a person selects "Kitchen & meal prep" on the first screen
- **THEN** the system SHALL immediately start the kitchen setup path (dietary preferences, appliances, starter pantry, and first plan)
- **AND** it SHALL not require body metrics, DEXA scans, or calorie targets before generating the initial plan

### Requirement: Post-milestone bridges offer next setup or direct app entry
Upon completing the chosen starting-point setup milestone, the system SHALL offer a clear choice to continue with the remaining setup or head straight to the app.

#### Scenario: Person finishes calorie target calculation and continues to kitchen
- **WHEN** a person finishes the calorie calculation on the results screen and taps "Set up kitchen & meal prep"
- **THEN** the system SHALL navigate into the kitchen setup path (appliances, starter pantry, first plan)
- **AND** preserve the calculated nutrition profile

#### Scenario: Person finishes calorie target calculation and heads straight to app
- **WHEN** a person finishes the calorie calculation on the results screen and taps "Head straight to the app"
- **THEN** the system SHALL persist the profile and navigate into the main app tabs
- **AND** the pantry tab SHALL display a resumable prompt to configure kitchen appliances and stock later

#### Scenario: Person finishes first meal prep plan and continues to calorie setup
- **WHEN** a person completes the first cooking plan and taps "Set up daily calorie target"
- **THEN** the system SHALL navigate into the calorie setup path
- **AND** preserve the confirmed kitchen appliances and pantry inventory

#### Scenario: Person finishes first meal prep plan and heads straight to app
- **WHEN** a person completes the first cooking plan and taps "Head straight to the app"
- **THEN** the system SHALL persist cooking preferences and navigate into the main app tabs
- **AND** the today tab SHALL display a resumable prompt to configure calorie targets later

### Requirement: Navigation stack is deterministic and non-recursive
All onboarding forward transitions and back navigation SHALL navigate between distinct routes without self-referential redirect loops or trapped states.

#### Scenario: Continuing from starting point choice
- **WHEN** a person selects an initial starting point and taps Continue
- **THEN** the system SHALL push the distinct initial route for that flow
- **AND** back navigation SHALL return cleanly to the starting point choice
