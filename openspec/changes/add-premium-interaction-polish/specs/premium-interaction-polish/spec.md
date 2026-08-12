## Purpose

Make Mise's repeated capture and logging interactions clear, recoverable, and
accessible without changing what the app can truthfully claim or store.

## ADDED Requirements

### Requirement: A completed action visibly confirms its own effect

The system SHALL confirm a user-initiated save with feedback that names the
changed record or the affected local state. It MUST make automatic pantry
effects visible without presenting an undefendable quantity.

#### Scenario: A photographed meal is saved
- **WHEN** a user saves a reviewed photographed meal
- **THEN** the app confirms the meal was saved and shows the refreshed Today
  view with its updated daily totals
- **AND** any pantry effect is described as an effect of that saved meal

#### Scenario: A meal has no pantry effect
- **WHEN** a user saves a meal that does not change pantry stock
- **THEN** the app confirms the meal without claiming that pantry stock moved

#### Scenario: A pantry review is accepted
- **WHEN** a user confirms one or more pantry items from review
- **THEN** the app confirms how many items were added and returns to a pantry
  view that includes them

### Requirement: Capture communicates its lifecycle

The system SHALL communicate the transition from capture through preparation,
analysis, review, and completion. It MUST keep the existing camera and library
routes available while an enhanced feedback treatment is used.

#### Scenario: A capture is being prepared or analysed
- **WHEN** a user submits a meal or pantry photo
- **THEN** the app shows that the submitted photo is being prepared or read
- **AND** prevents a duplicate submission

#### Scenario: Capture analysis reaches review
- **WHEN** an analysis produces a meal, pantry, barcode, or receipt result
- **THEN** the app transitions to the applicable review surface
- **AND** no inferred record is written before that review's existing
  confirmation action

#### Scenario: A capture cannot finish now
- **WHEN** a capture cannot be analysed because of a missing key, network
  failure, timeout, or provider failure
- **THEN** the app explains the current state and offers the applicable retry,
  manual-entry, settings, or saved-for-later path

### Requirement: Recovery states explain what remains possible

The system SHALL use a consistent recovery state for an empty, unavailable, or
recoverably failed capture or suggestion result. The state MUST name the
condition and provide an actionable next step when one exists.

#### Scenario: A suggestion request has no usable result
- **WHEN** a suggestion surface has no key, an error, insufficient data, or no
  eligible suggestion
- **THEN** the app explains that specific condition
- **AND** offers only an action that can address it

#### Scenario: A capture result is unusable
- **WHEN** a capture contains no usable food or receipt, or cannot be
  classified
- **THEN** the app preserves no unsupported inferred data
- **AND** offers a retry, manual path, or explicit route choice

### Requirement: Feedback is accessible and respects reduced motion

The system SHALL expose status feedback to assistive technology. It MUST reduce
nonessential motion when the operating system requests reduced motion.

#### Scenario: A status message appears
- **WHEN** the app announces a save, failure, pending state, or actionable
  recovery state
- **THEN** a screen reader can discover the message and its available action

#### Scenario: Reduced motion is enabled
- **WHEN** the operating system has reduced motion enabled
- **THEN** the same state transition remains understandable without a large
  movement or delayed action

### Requirement: Contextual polish remains local and correctable

The system SHALL use only existing on-device context to improve a default,
explanation, or recovery action. It MUST preserve a correction or review point
before an inferred result changes a durable meal or pantry record.

#### Scenario: Existing context improves a default
- **WHEN** the app uses known local context such as time, pantry stock, a saved
  preference, or an explicit venue selection
- **THEN** it improves a relevant default or explanation without requesting new
  sensitive data

#### Scenario: Context is uncertain
- **WHEN** the app cannot establish a contextual fact with confidence
- **THEN** it does not present that fact as known or use it to bypass user
  review

### Requirement: UI-facing changes receive a premium acceptance pass

The system SHALL record a premium acceptance pass for every UI-facing OpenSpec
change before it is accepted. The pass MUST cover feedback, error and
cancellation, return visits, reduced motion, screen readers, and real-device
review where applicable.

#### Scenario: A UI-facing change is ready for acceptance
- **WHEN** implementation tasks for a UI-facing OpenSpec change are complete
- **THEN** its task file or owner app-test checklist records the premium
  acceptance checks and their results

### Requirement: Today reveals useful nutrition detail progressively
The system SHALL present the current day's known energy, protein, carbohydrate,
fat, and fibre against their applicable daily targets in a glanceable summary.
It MUST preserve nullable nutrition and MUST NOT display an unknown contribution
as zero, a nutrition score, a food grade, or a good/bad colour verdict.

#### Scenario: A supported daily target is visible
- **WHEN** Today has logged nutrition and a recorded target
- **THEN** the summary shows the known consumed value and that target
- **AND** progress remains understandable without relying on colour

#### Scenario: daily nutrition is incomplete
- **WHEN** one or more logged items have no value for a displayed nutrient
- **THEN** the summary identifies the nutrient total as incomplete
- **AND** does not treat the missing values as zero

#### Scenario: a person asks what contributed
- **WHEN** the person selects a supported nutrient from the summary
- **THEN** the app opens Nutrition Analytics for that nutrient and day
- **AND** shows the day's meals or items with known contributions to that nutrient
- **AND** explains that unknown contributors are excluded

### Requirement: Meal summaries stay factual and compact
The system SHALL show a factual known subtotal for each logged meal while
keeping detailed nutrients behind progressive disclosure. It MUST NOT invent a
subtotal where required values are unknown.

#### Scenario: a meal has known energy
- **WHEN** a logged meal is listed on Today
- **THEN** its known energy subtotal is visible without opening the meal

#### Scenario: a person asks for more nutrition detail
- **WHEN** the person activates a meal or metric's nutrition-detail action
- **THEN** the app opens the applicable meal detail or Nutrition Analytics view
- **AND** unknown fields are labelled as unknown rather than zero

#### Scenario: overview density is constrained
- **WHEN** Today is shown at large text or on a narrow device
- **THEN** the energy summary, target strip, and meal list remain readable
- **AND** charts, report tables, and configuration controls remain off Today
- **AND** additional nutrient evidence remains available through Nutrition Analytics

### Requirement: Nutrition analysis has a dedicated destination
The system SHALL place nutrition contributors, historical charts, chart
configuration, and report-style summaries on a dedicated Nutrition Analytics
page. Today MUST remain focused on the current day's glanceable summary, meal
list, and primary meal actions.

#### Scenario: a person opens Nutrition Analytics
- **WHEN** the person follows a nutrition-detail or analytics action from Today
- **THEN** a dedicated page provides contributor, trend, and report content
- **AND** returning restores the person's Today context

#### Scenario: Today is kept glanceable
- **WHEN** nutrition analytics features are available
- **THEN** Today does not embed a historical chart, report table, range selector, aggregation selector, or chart-form selector
- **AND** existing meal actions are not displaced by the analytics entry point

### Requirement: Historical nutrition charts are configurable and truthful
The system SHALL let a person chart known energy, protein, carbohydrate, fat,
or fibre across a selected historical period. It SHALL support 7-day, 30-day,
90-day, and custom ranges; daily or weekly aggregation; and bar or line form.
Changing chart configuration MUST NOT change meal records or nutrition targets.

#### Scenario: a person configures a trend
- **WHEN** the person selects a supported metric, period, aggregation, and chart form
- **THEN** the chart updates from existing on-device meal and target records
- **AND** makes no provider or network request

#### Scenario: a chart period contains missing nutrition
- **WHEN** a bucket is incomplete, unknown, or has no logged meal
- **THEN** the chart distinguishes those states from a known zero
- **AND** does not interpolate a continuous trend through unknown data

#### Scenario: historical targets changed during the period
- **WHEN** the selected period includes more than one recorded daily target
- **THEN** comparisons use the targets recorded for their respective dates
- **AND** the chart or supporting summary discloses that the target changed

#### Scenario: a chart is used without sight or colour
- **WHEN** the chart is read with a screen reader or without distinguishing its colours
- **THEN** an equivalent ordered summary or data table exposes values, units, dates, targets, and coverage

### Requirement: Nutrition history has a structured personal report view
The system SHALL provide a report-style summary for the selected period and
metric. It SHALL identify the report period, units, known average, applicable
recorded-target context, data coverage, and defensible period values. It MUST
describe itself as a summary of logged data and MUST NOT present a diagnosis,
risk classification, treatment recommendation, invented clinical reference
range, or claim that it replaces professional medical advice.

#### Scenario: a report has complete coverage
- **WHEN** every logged contribution for the selected metric and period is known
- **THEN** the report shows the known average and period values with their units
- **AND** identifies the applicable recorded-target context separately from measured intake

#### Scenario: a report has partial coverage
- **WHEN** one or more logged contributions are unknown
- **THEN** the report labels its coverage as incomplete
- **AND** does not present the known subtotal as the complete intake

#### Scenario: report styling remains factual
- **WHEN** the report is displayed under any Mise theme
- **THEN** it uses structured headings, restrained tables, semantic chart roles, and plain limitation copy
- **AND** does not use red/green judgment, diagnostic labels, or medical authority cues

### Requirement: Insight preferences remain local and non-destructive
The system SHALL keep chart display preferences on the device and SHALL derive
all report content from existing local meal and target records. Clearing or
changing a display preference MUST NOT delete or rewrite nutrition history.

#### Scenario: a chart preference is remembered
- **WHEN** the person returns to Nutrition Analytics after selecting a metric and view
- **THEN** the app may restore that local display configuration
- **AND** the underlying meals and targets remain unchanged

### Requirement: Pantry contains distinct Stock and Recipes subsections
The system SHALL present saved recipes as a Recipes subsection within Pantry,
alongside a distinct Stock subsection. It MUST preserve the existing recipe
intake, detail, attribution, coverage, and local-storage behavior, and MUST NOT
treat a recipe as pantry inventory.

#### Scenario: a person switches Pantry subsections
- **WHEN** the person switches between Stock and Recipes
- **THEN** the selected subsection shows only its applicable collection, empty state, and actions
- **AND** switching does not add, delete, or rewrite stock or recipes

#### Scenario: the Recipes subsection is used
- **WHEN** the person opens, adds, or reviews a saved recipe from Pantry
- **THEN** the existing recipe detail or intake route handles the action
- **AND** recipe source attribution and pantry-coverage information remain available

#### Scenario: Stock actions stay scoped to Stock
- **WHEN** the Recipes subsection is selected
- **THEN** pending receipt and capture banners, storage-location controls, and stock-add controls are not presented as recipe actions
- **AND** those controls remain available from Stock
