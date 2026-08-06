## Why

A personal trainer looked at onboarding and said it does not ask enough to work
out what someone needs. They are right, and the reason is structural.

`energyTargets` runs Mifflin-St Jeor over sex, age, height and weight. That
formula's entire job is to *guess* body composition, because height and weight
are all it has. Two people of the same age, sex, height and weight can differ by
several hundred calories a day depending on how much of that weight is muscle.

Some people already have that measured, from a DEXA scan or an InBody. Others
have a figure from a ring or a health app. The app ignores all of it and asks
them to guess along with everyone else.

## What Changes

- **The regular onboarding is untouched.** Not one extra screen, not one extra
  tap. It stays exactly as it is.
- **The entrance offers separate ways in.** The welcome screen gains buttons for
  a DEXA scan, an InBody, and an already-known figure, beside the existing one.
- **DEXA and InBody are different flows, not one flow with a provider label.**
  They print different fields, in different vocabularies, with different
  reliability. Treating them as one thing means silently mixing quantities.
- **The scan flows are shorter than the regular one.** Katch-McArdle needs
  fat-free mass and nothing else, so sex, age and height are not asked for.
  Better data earns a shorter form, which is the right way round.
- **A measurement is kept per provider.** Switching from InBody to DEXA in
  settings does not destroy the InBody figure, and switching back does not
  require re-entering it.
- **Everything is changeable in settings**, the same way the basic details
  already are.
- **A stated figure is qualified before use**, because "the number my health app
  says" is three different numbers.

## Capabilities

### New Capabilities

- `energy-sources`: Where the calorie target comes from. Covers the four
  sources and the separate flow each needs, provider-specific fields and
  derivation, keeping a measurement per provider and switching between them,
  what is asked for and what is deliberately not, recalculation, staleness,
  what scan data is refused, and the language the app may use about any of it.

### Modified Capabilities

None. `openspec/specs/` is empty — nothing has been archived yet.

## Non-goals

- **Changing the regular onboarding.** It is the default, it serves almost
  everyone, and it gets no new questions. This is now a hard constraint rather
  than a preference.
- **Diagnosis, assessment, or advice.** The app computes a calorie target. It
  does not evaluate anyone's body. See below.
- **Storing the rest of the scan.** Visceral fat, segmental analysis, phase
  angle, metabolic age, InBody's score. None of it computes a target here.
- **Body-composition history.** At most one current measurement per provider —
  a bounded set of two rows, not a time series. Progress charting is a different
  product.
- **Connecting to Apple Health, Google Fit, or a wearable.** The user reads
  their number and types it. Integrations mean permissions and platform SDKs
  against an app with no server (decision 5), for a number that changes rarely.
- **Validating anyone's scan.** If the sheet says 14%, the app believes 14%.
- **Supporting every device.** DEXA, InBody, and a typed figure. A bathroom
  scale's body fat reading is close to noise and gets no dedicated flow.

## Impact

**Schema.** One migration: the active source on the profile, a measurements
table keyed by provider, and the stated figure with its kind. Sex, age and
height become nullable, since a scan user is never asked for them.

**Code.**
- `src/logic/bmr.ts` — Katch-McArdle, and a total dispatch over the source.
- `src/logic/bodyComposition.ts` — new, pure. Per-provider normalisation.
- `src/store/profileStore.ts` — recalculation becomes conditional.
- `src/types.ts` — `Profile` changes shape; three fields become nullable.
- `app/onboarding/` — the welcome screen gains entrances, plus two scan flows
  and a stated-figure flow.
- `src/components/settings/ProfileSheet.tsx` — source switching and measurement
  editing.

**Dependencies.** None added.

**Depends on** nothing unmerged.

## Why DEXA and InBody cannot share a screen

They do not measure the same thing and they do not print the same fields.

**DEXA** separates the body into fat, lean soft tissue, and bone mineral
content. Its "lean mass" usually means lean soft tissue and therefore *excludes*
bone, so fat-free mass is lean plus BMC — a difference of a few kilograms. It is
the reference method, expensive, and taken rarely.

**InBody** is bioimpedance. It prints **fat-free mass directly**, under that
name, and separately prints skeletal muscle mass, which is a smaller and
different quantity that people confuse with it constantly. It also prints its
own BMR. It is affected by hydration, and repeat scans days apart move in ways a
DEXA would not.

A single "enter your body fat percentage" screen papers over all of that. It
asks a DEXA user to do arithmetic the sheet already did, asks an InBody user to
ignore the fat-free mass printed in front of them, and gives the app no way to
know which kind of number it received.

Two flows means each asks for what its own sheet actually prints, in its own
words, and normalises with logic that knows what it is holding. The source is a
closed set with exhaustive dispatch — the same discipline
`add-openai-provider` applies to transports, for the same reason: adding a
provider without its logic should fail to compile, not fail quietly.

## Better data earns a shorter form

Katch-McArdle is `370 + 21.6 × fatFreeMassKg`. It does not use sex, age, or
height, and `grep` confirms nothing else in the app computes with those three
either — they exist to feed Mifflin-St Jeor and to be displayed back.

So the scan flows do not ask for them. A DEXA user answers weight, their scan
figures, the date, activity, and goal — five screens against the regular flow's
seven.

This is worth stating as a principle rather than an optimisation: **ask for what
the chosen source actually needs.** If someone later switches to estimation, the
app asks then for what estimation requires. Collecting fields on the chance of a
later switch is how a form gets long, and a long form is the complaint that
started this.

## Body composition is health data, and the app must get smaller as it gets more

An InBody printout is a page of clinical-looking numbers and a DEXA report is
genuinely medical. The pull — and the request that prompted this, phrased as
wanting a more accurate *diagnosis* — is to do more with them.

The app does less. It takes the fields that compute a calorie target and refuses
the rest, because storing a number is how an app ends up rendering it, and
rendering it is an assessment.

**A calorie target is arithmetic. An evaluation of someone's body is not the
app's to make.** A more precise input makes the arithmetic better and says
nothing more about the person. Same refusal as decisions 108 and 142, enforced
the same way: a copy audit and a test over forbidden words.
