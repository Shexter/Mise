# The bear case

The strongest argument against building Mise, made deliberately and without
softening, followed by what survives it.

Kept because the criticisms that did not land are as useful as the ones that
did — they are the arguments that will come back, and this records why they were
answered rather than ignored.

---

## The case against

### 1. The core insight does not cover what was promised

The thesis is that the meal log is the depletion signal. Test it against the
stated pain: *never lose track of seasonings running out.*

A vision model looking at finished fried rice reports rice, egg, spring onion,
perhaps soy sauce as a hidden ingredient. It does not report two grams of white
pepper, half a teaspoon of sesame oil, the garlic that dissolved, the splash of
Shaoxing wine, or which of three soy sauces was used. Gochujang in a stew is
visually indistinguishable from tomato paste, paprika, and doubanjiang.

The signal is therefore strongest for the items anyone would notice running out,
and weakest for the sauces and spices the product exists to protect. The
count-uses fallback only fires when the model names the ingredient — and for the
invisible ingredients, it does not.

### 2. The onboarding is a wall, and batching does not move it

Eighty items is thirty to forty minutes. Batched capture makes it tolerable, not
short. Consumer completion through a setup that long is in the single digits,
and the catalogue is close to useless below roughly 70% coverage, because "do I
have garlic?" answered wrong once ends the trust relationship permanently.

Sunk cost creates lock-in only for those who finish. If most bounce, the result
is excellent retention over a rounding error.

### 3. The two halves may be anti-correlated in one person

People who log calories carefully tend to eat simple, repetitive, easily-logged
food. They do not have forty sauces. People who do have forty sauces cook
elaborately, and elaborate cooking is the hardest thing to log accurately, which
is largely why those people do not log.

One app for two populations that barely intersect, each half dead weight to the
other.

### 4. Local-first destroys the only compounding asset

The alias table improves with use — and it is per-device. Install ten thousand
re-does the work of install one. `KIKKO SOY 500ML` is resolved from scratch, by
a paid model call, on every device on earth.

A pooled version would make one resolution help everyone permanently. The chosen
architecture forecloses the network effect in a category where the data moat is
the only defensible one. Meanwhile grocery retailers already know what their
customers bought without scanning anything, and appliance makers are putting
cameras inside fridges.

### 5. A decade of failed pantry apps is evidence

NoWaste, Pantry Check, KitchenPal, Out of Milk — all tried, all small. The
proposed explanation is that manual decrement killed them. The competing
explanation is that people do not want to run an inventory system for their
kitchen at all, and manual decrement was a symptom rather than the cause.

Food waste is a stated preference, not a revealed one. Everyone says they care;
everyone keeps throwing away lettuce. The four-figure waste-per-household number
has been public for a decade without producing a winner. Products that fight
revealed preference lose.

### 6. Enormous engineering for a nice-to-have

151 tasks planned, perhaps 40% of the product. Solo, with an AI implementer,
realistically many months — during which a funded competitor adds a pantry in a
sprint.

---

## What survives

### Conceded: the seasoning signal (1)

Reliable seasoning depletion cannot be read from a photograph of finished food.
This is not solvable and should not be attempted.

**The fix:** when a user cooks from a suggestion, the recipe states what went in.
That is exact rather than estimated. The dinner decision is therefore not a
feature on top of the pantry — it is the mechanism by which the seasoning
promise is kept, and "I cooked this" is a better data path than the camera.
Recorded as decision 61, and it argues for building the dinner decision earlier
than the dependency chain implies.

The photo path remains for meals not cooked from a suggestion. It simply stops
being what the seasoning promise rests on.

### Conceded: the onboarding wall (2)

Forty minutes of setup is indefensible, and it is also unnecessary. Receipts and
"I cooked this" both add items as a side effect of ordinary use. Three weeks of
normal usage catalogues most of a kitchen with no dedicated effort.

**The fix:** the pantry populates itself first; the gap-filling offer comes later
and is small. Bulk capture survives as an optional power move rather than the
front door. Recorded as decisions 59 and 60 — the largest change to come out of
this exercise, and an inversion of the planned sequencing.

### Conceded: the compounding asset (4)

The criticism is correct and the answer converts it into an advantage. Hosted
mode means a server exists; pooling string-to-canonical mappings costs nothing
and reveals nothing, because a retail abbreviation is not personal data.
Pantries, meals, photos, and profiles stay on-device in both modes. Recorded as
decision 62.

### Refuted: the base rate (5)

Every pre-2023 pantry app required manual entry of everything *and* manual
decrement. Models that read `GRN ONION BNCH` off a receipt, or identify
doubanjiang from a Chinese label, did not exist. This is not the same attempt
with more discipline; it is the same attempt with the input cost removed.

The revealed-preference claim is also directly falsified by the current
generation of AI calorie trackers. "People will not log their food" was received
wisdom until friction dropped far enough, and then a great many people started
logging their food. The open question is whether pantry friction can fall as far
as calorie friction did — partly, which is precisely why the fix to (2) matters.

### Refuted twice over: the audience split (3)

**First,** the intersection is not empty, it is specific: meal preppers. They
batch cook, buy in bulk, track macros, and cook real food. Every mechanic
already designed maps onto that behaviour without modification. The criticism
does not refute the product; it supplies the customer that had not been named.
Recorded as decision 63.

**Second, and more decisively:** the criticism called the unused half "dead
weight", and that word smuggles in an assumption worth examining. Dead weight to
whom? Nothing is gated and nothing is paywalled, so a calorie-only user who
never opens the pantry loses precisely nothing by not opening it. Partial
adoption is not a failure state — it is the normal condition of most software.
The criticism only bites if using half the app costs the user something, and it
does not.

The two halves are also not symmetric, which is what really dissolves it. The
funnel runs **one direction, from calories into pantry**: someone logging meals
accrues a catalogue without ever deciding they wanted one. That is decision 58
reached from a different starting point, which is some evidence for it.

**What survives, narrowed.** Two residuals, both builder-side rather than
user-side:

- Unused features are free for the user and not for the builder. Engineering
  time, surface area, bugs, and a tab that half the audience scrolls past are
  real costs. Products die of being for everyone more often than of being too
  narrow — which is why decision 58's ordering is a real constraint rather than
  a cosmetic one.
- The "nobody loses money" argument holds only while everything is free.
  Decision 49 puts hosted inference in the plan, so a paywall lands somewhere.
  At that point, an audience where half the users value half the app forces
  either a price set for the half-value user or a segmentation that complicates
  the offer. Worth carrying into decision 50 when it is un-parked.

### Refuted: the engineering burden (6)

The dependency chain delivers a working product after the catalogue and
depletion changes. Receipts, barcode, and the dinner decision are additive.
Shipping something real is not gated on all 151 tasks.

### Reframed: the Asian coverage

Better treated as a credibility proof than as a market segment. A matcher that
handles doubanjiang and `KIKKO SOY 500ML` is simply a better matcher, and
Western users benefit from the same robustness. It is what makes someone
conclude the app actually knows food — an impression that sells broadly, not
only to people who own the jar.

---

## The conclusion

The bear case is strong against **pantry-as-primary** and weak against
**pantry-as-byproduct**.

If the pantry populates itself from receipts and cooking, and the calorie
tracker is the daily habit that keeps the app open, then Mise is a calorie
tracker whose pantry happens to be accurate. That is easier to sell, easier to
onboard, easier to build toward, and it survives every criticism above except
the seasoning one — which the recipe path handles.

This is a positioning change, not a rebuild. Everything specified still holds.
Order and emphasis change. Recorded as decision 58.
