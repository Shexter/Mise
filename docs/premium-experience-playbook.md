# Premium experience playbook

This playbook turns the lessons from Chris Raroque's video, [How I Make Apps
FEEL Premium (5 examples)](https://www.youtube.com/watch?v=MXLF8b15GhQ), into
rules for Mise.

It is a product-quality guide, not permission to add decoration. Mise stays
local-first, calm, accessible, and honest about nutrition uncertainty.

## The working rule

Ship the useful version first. Then revisit the interactions people repeat and
ask one question: **what would make this feel clearer, faster, or more cared
for?**

Do not call a feature complete because it works. Complete it only after its
feedback, empty state, error state, reduced-motion behavior, and return path
have been reviewed on a device.

## What the video teaches

### 1. Motion must explain a change

An action without feedback leaves the person to infer what happened. Generic
motion is better than none, but deliberate motion makes the result legible.

For Mise:

- Animate a confirmed change in the object that changed. Examples include a
  saved meal row, the calorie balance, a pantry-item count, and a scan result.
- Use motion to show cause and effect. Do not animate decoration that delays
  logging food or reviewing a capture.
- Keep motion short and interruptible. Every new motion must respect the
  existing reduced-motion setting.
- Prefer the existing shared motion tokens and components. Do not introduce a
  one-off animation style for a single screen.

### 2. A visual asset needs a coherent role

One generated image does not create a visual identity. A small, consistent set
of assets can make a difficult moment feel intentional.

For Mise:

- Add illustration only when it helps a person understand a state or continue
  after a setback. Good candidates are an empty pantry, a completed first log,
  or an unusable capture.
- Define the asset's subject, palette, line weight, framing, and motion before
  generating or commissioning it. Create variants and review them together.
- Do not use a mascot, health claims, or body-evaluating imagery. Mise is a
  practical kitchen tool, not a coach or clinician.
- Reuse an approved asset system. Do not add isolated AI-style illustrations to
  onboarding, capture, or suggestions.

### 3. Study high-quality interactions, then adapt their principle

Small interaction details become noticeable after repeated use. A default system
control may be correct for version one but may not be the best long-term flow.

For Mise:

- Prioritise the high-frequency paths: open capture, take or choose a photo,
  wait for analysis, correct a result, save a meal, and return to Today.
- Inspect good reference interactions frame by frame before changing timing,
  affordances, or transitions. Adapt the underlying principle. Do not copy a
  competitor's screen or assets.
- Keep the platform camera and picker where they are more reliable or more
  accessible. A custom camera is justified only when it materially improves the
  capture and review loop on both iOS and Android.
- Preserve a stable working path while an enhanced path is evaluated. Do not
  replace a reliable capture route with an untested visual experiment.

### 4. Invisible context can create a pleasant surprise

The strongest polish may be a correct result that needs no extra explanation.
Use context that the person already gave the app. Never create surprise by
collecting hidden data.

For Mise:

- Use existing on-device context first: selected meal type, local time, pantry
  contents, confirmed dietary rules, saved recipes, prior corrections, units,
  and an explicit home or eating-out choice.
- Improve suggestions, parsing, and defaults with that context. Keep a clear
  review or correction point before changing a meal or pantry record.
- Do not add background location lookup, contact access, tracking, or a server
  profile merely to make a result feel clever. These conflict with the
  local-first product boundary.
- Treat uncertainty honestly. A confident transition cannot turn an unknown
  macro, quantity, or venue into a known fact.

### 5. Craft is iterative and is not limited to the UI

The video repeatedly returns to the same discipline: make a working result,
study it, and improve the small detail that changes the experience. The first
AI or implementation output is a starting point, not a finish line.

For Mise:

- Add a premium pass to each UI-facing OpenSpec change before it is accepted.
- Test the highest-frequency flow on a real device, including slow network,
  failure, cancellation, a return visit, and reduced motion where relevant.
- Record what feels unclear, abrupt, slow, or repetitive in the owner app-test
  checklist or the change's task file. Convert confirmed issues into scoped
  work rather than vague polish debt.
- Spend polish effort where Mise is differentiated: trustworthy capture,
  frictionless meal logging, believable pantry state, and useful dinner
  decisions. Do not spend it on features the app does not need.

## Required premium pass for future UI work

Before marking a UI-facing change complete, answer each question in its design
or task file.

Use the [Premium interaction pass](./owner-app-test-checklist.md#premium-interaction-pass)
to record the required device evidence.

1. What exact user action changes state?
2. What visible feedback confirms that change?
3. Does the feedback explain the result without slowing the task?
4. Does it work with reduced motion, screen readers, a slow provider, and an
   error or cancellation?
5. What existing context improves the result without requesting new sensitive
   data?
6. Is the enhanced interaction better than the reliable baseline on both
   Android and iOS?
7. Is any illustration part of an approved, reusable visual system?
8. Can the person correct every inferred result before it changes their record?

## Mise priority order

Apply this playbook in this order when a relevant feature is ready for device
testing:

1. **Capture feedback.** Make capture, analysis, review, correction, and save
   feel connected. The result must never appear to change without an explained
   transition.
2. **Meal-log confirmation.** Make saved meals and their calorie and pantry
   effects immediately visible, reversible, and calm.
3. **Onboarding clarity.** Keep the regular personal-details route primary.
   Keep DEXA, InBody, and known-calorie routes clearly optional.
4. **Useful empty and recovery states.** Give an actionable next step after an
   empty pantry, a failed lookup, an unusable photo, or a partial suggestion.
5. **A measured visual system.** Decide whether Mise needs a small illustration
   system only after the functional loops above have been tested.

## What this does not adopt

- It does not require a mascot, generative imagery, a particular animation
  tool, or a custom camera.
- It does not replace product decisions, accessibility requirements, or the
  owner acceptance checks.
- It does not make the app more clinical, more persuasive, or less truthful in
  order to feel polished.
