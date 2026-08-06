# Mise — product decisions

A running ledger. Every decision we settle gets appended here with its
reasoning, so no context is lost between sessions or between the planning model
and the implementing one.

**Format:** decisions are numbered and never renumbered *once merged*. A
reversed decision is struck through and gets a superseding entry rather than
being deleted — the reasoning for a rejected path is worth as much as the
reasoning for the taken one.

**Numbering across parallel work:** a branch cut before another branch's
decisions were merged will pick the same next number, and both are legitimate.
The number is only claimed once it reaches `main`. Renumber the later-merged
branch during conflict resolution — the earlier number stays with whatever
landed first, since anything already referencing it is right. Before recording a
decision on a branch, pull `main` and take the next free number; it makes the
collision rare rather than routine.

**Status key:** `SETTLED` decided, build against it · `OPEN` needs a call ·
`DEFERRED` deliberately out of scope for now

---

## Identity

**1. The product is Mise.** `SETTLED`
From *mise en place* — everything in its place, which is the thesis. Pantree was
the runner-up: more instantly legible, but it boxes the brand into one feature
of an app that also does calories, spending, and eating out. Mise needs a
tagline to carry pronunciation (*meez*).

**2. It is built on SnapCal, not a rewrite.** `SETTLED`
The existing calorie tracker is the foundation and the source of the depletion
signal. Everything is added by migration.

**3. Scope is food in the home, broadly.** `SETTLED`
Calories, pantry stock, grocery spending, eating out versus cooking. The
unifying promise: never rediscover a forgotten ingredient under dust, never run
out of a seasoning mid-cook, never lose a perishable.

**4. The differentiator is Asian pantry coverage.** `SETTLED`
Every calorie and pantry app is built on Western food databases. Doubanjiang,
gochujang, belacan, kecap manis, Shaoxing wine, XO sauce are invisible to them,
and OCR chokes on the labels. Vision-model identification plus in-script aliases
is a real edge for a genuinely underserved audience. Lead with it.

---

## Architecture

**5. Local-first is retained. No server, no auth, no accounts.** `SETTLED`
SQLite via `expo-sqlite`, user brings their own API key. The privacy story in
the README survives intact.

**6. ~~Household sharing~~ — cut.** `SETTLED`
Considered and dropped. It would have required auth, a hosted Postgres with
row-level security, and server-side inference keys, which is a different product
and kills decisions 5. May return post-MVP as sync-only.

**7. Android and iOS, both via Expo.** `SETTLED`
Android ships as a sideloadable APK through the EAS `preview` profile
(`buildType: apk` — the EAS default is an app-bundle, which cannot be
sideloaded). iOS is a distribution cost problem, not a code problem: it needs
the Apple Developer Program at $99/year for TestFlight or ad-hoc install.
Android first for that reason.

**8. Offline-first means the data is local, not that the app works on a plane.** `SETTLED`
Barcode lookup, receipt parsing, and vision are all network calls. Cache barcode
results in SQLite so repeat items resolve offline, and queue receipt scans when
there is no connection.

---

## The core insight

**9. The meal log is the depletion signal.** `SETTLED`
This is the moat. Every other pantry app dies because it asks users to manually
decrement stock, and nobody does. SnapCal already makes the user log what they
ate — for a reason they care about — and that log tells us what left the pantry.
`meal_items` carries per-item quantities, and `prompt.ts`'s
`likely_hidden_ingredients` already surfaces the oils and sauces a camera cannot
see.

**10. Cooking is not eating, and that gap must be closed explicitly.** `SETTLED`
Cook four portions, eat one, fridge three — the pantry lost four portions but
the log records one. Fix is one tap at log time: *"how many servings did this
make?"* It scales the decrement and turns the remaining portions into cheap
one-tap re-logs later.

**11. Restaurant meals must not decrement the pantry.** `SETTLED`
A home/out flag at log time. One tap that pays twice: it protects depletion
accuracy and it is the input to eating-out versus cooking-at-home spending
analytics.

---

## Tracking models

**12. Different food classes get different depletion models.** `SETTLED`

| Class | Model | Rationale |
| --- | --- | --- |
| Staples (rice, pasta, flour, oil) | mass | The meal log gives real numbers, and remaining quantity is otherwise unknowable |
| Seasonings and condiments | uses, not grams | A vision model will never report 1.4 g of cumin. Frequency is the available signal |
| Perishables | age and expiry | Presence plus time, not quantity |

**13. Seasonings are tracked on vibes, deliberately.** `SETTLED`
Nobody micro-tracks their spice rack and the app should not pretend to. A preset
typical-use amount per canonical item, applied when the ingredient appears in a
meal log. `assets/hidden-ingredients.json` already carries `defaultQuantity` and
`unit` per entry — that is exactly the figure needed, currently wired only to
calories. Widen the file and point it at both consumers.

**14. Four-bucket fullness is the correction mechanism.** `SETTLED`
Full / half / low / out, asked on suspicion rather than on a schedule. Asking on
a schedule is nagging.

**15. Never display a quantity we cannot defend.** `SETTLED`
The UI says "running low", never "you have 486 g of rice left". One wrong number
destroys trust in the entire list, and every number here is an estimate
compounded over many meals. Advisory language only.

---

## Storage locations

**16. Defaults are Fridge, Freezer, Pantry, Counter — and they are user-editable.** `SETTLED`
Counter earns its place because bananas, onions, garlic, and tomatoes live there
and rot on a different clock. Kitchens are idiosyncratic (chest freezer, spice
drawer, rice cabinet), so the list must be extensible. Cupboard and Pantry
collapse into one.

**17. Location and tracking class are orthogonal fields.** `SETTLED`
Location drives *expiry* — the same chicken breast is 2 days in the fridge and 6
months in the freezer. Class drives *depletion*. Dried pasta lives in a cupboard
and is tracked by mass. Folding them into one field will cause pain later.

**18. Vision guesses the location at capture; the user confirms.** `SETTLED`
Soy sauce to pantry, milk to fridge. Saves a tap on every item during the large
first-run session.

---

## Expiry

**19. Predicted expiry is a lookup table, not a model.** `SETTLED`
Purchase date plus class plus location. Right often enough, and cheap. Unopened
and opened shelf life are separate figures — opened soy sauce and opened milk
behave nothing like their sealed versions.

**20. Freezing is a first-class action, not just a location change.** `SETTLED`
Sometimes the right answer to an expiring item is rescue, not a recipe. One tap
pushes `expires_at` out by the freezer shelf life from the same table.

---

## Input channels

**21. Receipts are the ground-truth re-anchor.** `SETTLED`
Meal-log decrements drift — vision portions are roughly ±30%, and error
compounds over a 5 kg rice bag. The next receipt scan of rice resets the counter
to a known quantity. **Receipts set truth, meal logs interpolate between them.**
This is why receipt scanning is structurally important rather than a
convenience, and it accrues spending data as a side effect.

**22. Barcode is preferred over vision for packaged goods.** `SETTLED`
Roughly 2 seconds versus 15 for photo-plus-correction. `expo-camera` (already a
dependency at ~17.0.10) supports barcode scanning natively via
`onBarcodeScanned`, so no new dependency. Open Food Facts for lookup — free,
with decent international coverage. Vision handles what barcodes cannot: fresh
produce, decanted goods, foreign packaging with no scannable code.

**23. First-run capture is batched.** `SETTLED`
Photographing every item is accepted as a large but worthwhile task, and it
doubles as a rediscovery moment. But capture must not bounce between screens:
the camera stays open, snap-snap-snap through the cupboard, then one review
screen for everything at the end. Eighty rounds of capture-then-review is where
users abandon.

**24. Never gate the app on a complete pantry.** `SETTLED`
The catalogue fills progressively. Someone who logs twenty items still has a
working app.

---

## The identity layer

Full design in [`identity-layer.md`](./identity-layer.md).

**25. Three levels: product, canonical ingredient, pantry item.** `SETTLED`
A single `items` table collapses. Each input channel enters at a different level
and each consumer reads at a different one.

**26. Five-step match cascade, cheapest and most certain first.** `SETTLED`
Barcode, exact alias, fuzzy alias, model resolution, propose new. Steps 1 to 3
are local SQLite, so most matching runs offline once the alias table warms up.

**27. Every resolution writes an alias back.** `SETTLED`
A given receipt string costs one model call once and is free forever after. The
alias table is the compounding asset that makes month six feel better than month
one.

**28. Ambiguity resolves toward what the user already owns.** `SETTLED`
"Soy sauce" against a pantry holding light soy, dark soy, and tamari: rank by in
stock, then already opened, then most used, and pick silently. Do not ask at
meal-log time — friction on the wrong screen, and all three roll up to the same
advice.

**29. Merge ships in v1.** `SETTLED`
Duplicate canonicals are the failure that ends the app. Merge will be needed in
week one, so it is not a later feature.

**30. Canonicals ship as seed data, ~300 items and ~2,000 aliases.** `SETTLED`
The alternative — fully user-local from empty — makes the first month all model
calls and leaves the Asian coverage, the actual differentiator, dependent on the
model getting it right every time. Real build cost: someone writes 300 records
with shelf lives and typical-use amounts.

**31. CJK aliases are stored in script, never romanised.** `SETTLED`
醬油, 간장, kecap asin, and toyo all point at `soy-sauce-light`. This is what
makes decision 4 work.

**32. Fuzzy match thresholds.** `OPEN`
Placeholders are: accept silently above 0.85, confirm between 0.60 and 0.85,
escalate to the model below. Needs tuning against real receipts. The middle band
is what matters — too wide and the app nags, too narrow and it silently
mismatches, which is worse.

*Measured while building `add-identity-layer`* against the 74-string fixture
corpus (`src/logic/__fixtures__/`), scored with the trigram Dice +
length-ratio scorer in `src/logic/similarity.ts` against the seeded aliases.
The placeholders held up and ship unchanged:

- **Accept band (> 0.85):** word-order and truncation noise landed here
  correctly — `CHKN THGH BNLS` 0.91, `ATLANTIC SALMON FIL` 0.89,
  `GREEK YOG PLAIN` 0.89, `SIG OLIVE OIL EV` 0.87, `SHREDDED CHED CHSE` 0.86,
  `KECAP MANIS ABC` 0.86. No wrong canonical scored above 0.85.
- **Confirm band (0.60–0.85), 15 fixtures:** every one pointed at the right
  canonical, so the band nags but never misleads on this corpus. Range
  0.67–0.84: `NAPA CABBAGE HEAD` 0.84, `HVY CREAM PINT` 0.83,
  `SHRMP RAW` 0.82, `MISO PASTE WHT` 0.81, `TOFU FIRM` 0.80,
  `cooking wine` 0.79, `CJ GOCHUJANG` 0.78, `GOCHUJANG PASTE` 0.77,
  `PORK BELLY SLCD` 0.76, `coriander leaves` 0.74, `365 ORG PNUT BUTTER`
  0.72, `ORG CHKN BRST BNLS` 0.71, `steamed jasmine rice` 0.71,
  `3 CRABS FISH SAUCE` 0.67, `Kikkoman soy sauce, 500ml bottle` 0.84.
- **Below 0.60:** real foods that fell through were brand-prefixed or very
  short — `KS ORG EVOO` 0.30, `李錦記 蠔油` 0.27, `fried egg` 0.29. Those
  are the model's job (step 4), and alias write-back makes each one a
  one-time cost. Non-food lines all scored < 0.60 against everything.

Evidence lives in `src/logic/similarity.test.ts` (the confirm-band list is
asserted there, so a scorer change that moves the band fails the build).
Still OPEN: the corpus is authored, not harvested — revisit once real
receipts flow through the scanner.

---

## The dinner decision

Full design in [`dinner-decision.md`](./dinner-decision.md).

**33. It is a decision, not a recipe browser.** `SETTLED`
"What could I make" is free from any chatbot and goes generic by day four. "What
should I cook tonight" needs pantry, expiry, personal history, and remaining
calories at once — and nothing else has all four.

**34. Bucket and constrain; do not just sort by expiry.** `SETTLED`
Models do not reliably read list position as priority, and urgent items get
buried in a long list. Send `use_first` / `use_soon` / `available` buckets with
an explicit rule that every suggestion must use at least one `use_first` item.

**35. Urgency is weighted by value at risk, not just date.** `SETTLED`
300 g of pork belly and half a cucumber can expire the same day; one is $8. We
have `price_cents` from receipts. It also produces the most convincing reason
chip on the board: *"saves $8 of stock"*.

**36. Calories are context, never a filter.** `SETTLED`
Hard-filtering to a remaining-calorie ceiling returns sad food at 7pm. Pass the
figure as context, show fit as a chip, offer a smaller portion where a dish
overshoots. The macro gap is a better signal than raw calories.

**37. Two familiar, one stretch.** `SETTLED`
All-novel gets ignored, all-familiar gets boring. Suppress anything eaten in the
last 7 days.

**38. `uses` carries canonical ids.** `SETTLED`
This is what makes the feature more than a chat reply: tap "I cooked this" and
it pre-fills the meal log, logs calories, and runs the decrement in one action.
Without it, the loop does not close.

**39. Suggestions may require one missing ingredient.** `SETTLED`
A dish needing one spring onion beats a perfect-match dish nobody wants, as long
as the gap is shown honestly. It also feeds the shopping list.

**40. Suggestions are generated once daily and cached.** `SETTLED`
Invalidated by material pantry change, a logged meal, or explicit refresh.
Otherwise opening a tab costs money every time.

**41. "Make it to Sunday" is the same engine with a different objective.** `SETTLED`
Half-empty fridge, payday is Sunday, the alternative is ordering out. Plan N
dinners requiring no shopping, reuse overlapping ingredients, state the gap
honestly. Likely a stronger retention hook than the pantry list itself — a list
is a reference you consult, this is a recurring problem you need help with.

---

## Scope

**42. MVP.** `SETTLED`

In:
- Pantry capture (vision, batched) producing catalogue rows with class,
  location, and predicted expiry
- Receipt scan for bulk add, which doubles as onboarding and accrues spend data
- Pantry list with expiring-soon pinned, one-tap "used it up" and "running low"
- Existing calorie logging, unchanged
- The link between them: logging a meal decrements matched pantry items

Out, deliberately:
- Household sharing (decision 6)
- Meal planning `DEFERRED`
- Recipe browsing as a browsable library `DEFERRED`
- Spending dashboards `DEFERRED` — the data accrues from day one, the surface
  comes later

**43. The loop must close, or this is five apps in a trench coat.** `SETTLED`
Receipt → pantry → meal log → depletion → shopping list → receipt. Any feature
that does not sit on that loop is a candidate for cutting.

---

## API keys and providers

**46. In-app key entry already exists and is already encrypted. No work needed.** `SETTLED`
`ApiKeyForm` is shared by onboarding and Settings; `keyStore.ts` writes through
`expo-secure-store`, which is the iOS Keychain and Android Keystore-backed
encrypted storage — hardware-backed, and stronger than anything hand-rolled. The
key never reaches SQLite, Zustand, logs, or the JSON export, and the form
already offers a real one-token Test key check and masked display.

**47. Subscription or OAuth sign-in is not possible.** `SETTLED`
A Claude.ai Pro/Max subscription does not include API credits, and a ChatGPT
Plus subscription does not include OpenAI API access — separately billed
products in both cases. Neither provider offers a flow letting a third-party app
spend a consumer subscription's quota. The realistic options are bring-your-own
key (current) or hosting a paid proxy, which needs a server and contradicts
decision 5. Gemini's no-card free tier stays the recommended zero-friction path.

**48. OpenAI joins as a third provider, and detection becomes longest-prefix-first.** `SETTLED`
Specified in `openspec/changes/add-openai-provider/`. Two defects surface on the
way: `providerForKey` currently treats everything that is not `sk-ant-` as
Gemini, so an OpenAI key pasted today is silently routed to Google and rejected
with a message blaming the key; and `copyForError` names Anthropic in its
billing message regardless of which provider the user's key belongs to. Prefix
ordering is the highest-risk detail — matching `sk-` before `sk-ant-` would
route every existing Anthropic key to OpenAI.

---

## Working method

**44. Plan with Opus 5, implement with Fable 5.** `SETTLED`
Planning produces specs; specs are the handoff. This is why OpenSpec is
installed — a change proposal with design and tasks is a better handoff artifact
than a conversation.

**45. Every agreed decision lands in this file.** `SETTLED`
Appended as it is settled, not reconstructed later.

---

## Money

**49. Both key modes ship: bring-your-own and hosted.** `SETTLED`
Hobbyists paste their own provider key and pay nothing. Everyone else pays a
subscription and never learns what an API key is. These serve two populations
that barely overlap — the people willing to create a Google AI Studio account
are the people least likely to pay, and the people happy to pay bounce at the
words "API key" — so serving only one of them caps the product either on
audience or on revenue.

Architectural consequence, and the reason this is recorded before it is built:
the vision facade must route on **key mode** as well as on provider. Hosted mode
is a transport whose credential is a session token rather than a provider key.
`add-openai-provider` already replaces ternary dispatch with a transport
registry, which is the right seam — keep it, and hosted mode is an added entry
rather than a rewrite. Do not collapse the seam on the grounds that there is
only one mode today.

Local-first is preserved in the sense that matters: user data stays on device in
either mode. Hosted mode moves only inference off the phone.

**50. Monetisation shape.** `OPEN`
Not settled, deliberately parked. The live questions: subscription price and
period, whether a lifetime tier ships early while marginal cost is near zero,
whether the paywall lands immediately after first-run pantry capture (the point
of maximum sunk cost and therefore maximum willingness to pay), and whether
household plans return as a paid upsell despite decision 6 having cut household
sharing on architectural grounds.

The framing that survives regardless: this is sold as money recovered, not as
organisation. "You saved $312 this year" is the pitch, which makes the receipt
and spending data a revenue mechanism rather than a feature.

---

## Depletion

Settled while designing `add-pantry-stock` and `add-stock-depletion`.

**51. Leftovers log calories but never decrement.** `SETTLED`
The counterpart to decision 10, and only correct alongside it. The servings
multiplier debits the whole batch when it is cooked, so eating the remaining
portions must debit nothing — otherwise a four-serving curry debits the pantry
seven times. Modelled as one closed `venue` field (`home | out | leftovers`)
rather than separate booleans, so the incoherent combination of a leftovers meal
with a multiplier of four cannot be expressed.

**52. Unit conversion never invents a factor.** `SETTLED`
`convert()` returns `number | null`, and `null` means not convertible. Where a
canonical ingredient has no density or no weight per piece, the app records the
consumption and counts a use rather than estimating a mass. The tempting
defaults — assume 1 g/ml, assume a 100 g piece — produce confident nonsense in
exactly the place decision 15 forbids it. Making "I don't know" a value the type
system forces callers to handle is what stops it being added later for
convenience.

**53. Confidence decays with estimated decrements, and the interface says so.** `SETTLED`
Each pantry item counts estimated decrements since its last ground-truth anchor,
where an anchor is a receipt, a fullness tap, or a user-entered quantity. Above
a threshold the status is qualified rather than asserted, and a fullness check
may be offered.

This is what makes decision 15 honest rather than aspirational. "Running low"
after two estimated decrements and after twenty are different claims, and a
product sold on trustworthiness should not state them identically. A count
rather than a computed error bound, deliberately — an error bound implies a
rigour the inputs do not support.

**54. Depletion is never retroactive.** `SETTLED`
Meals logged before an item was catalogued do not decrement it. Replaying
history would silently rewrite stock the user believes they set, using estimates
they never had a chance to correct.

**55. Receipts re-anchor by setting, not by adding.** `SETTLED`
A receipt matching an existing item sets its amount to the purchased quantity
and zeroes the drift counter. Adding to a drifted estimate compounds the error;
setting discards it, which is the whole point of decision 21. A receipt for a
container the user does not yet have creates a new pantry item instead.

**56. One pantry item is one physical container.** `SETTLED`
No count column. Opened state, expiry, and fullness are all per-container, and a
count forces each of them to become either wrong or an array. Three tins of
tomatoes are three rows, grouped by canonical ingredient for display.

**57. Storage locations are a table with a closed `kind`.** `SETTLED`
Users rename and add locations freely, but each carries a kind
(`fridge | freezer | ambient | counter`) that the shelf-life lookup keys off. A
"Chest freezer" and a "Garage freezer" both get freezer shelf life without the
lookup knowing either name. A free-text location string would make renaming a
location silently change every expiry date under it.

---

## Positioning

These came out of arguing the strongest case *against* the product. The full
argument and the responses to it are in [`bear-case.md`](./bear-case.md). Three
criticisms survived and produced changes; the rest were answerable.

**58. Pantry is a byproduct, not the primary.** `SETTLED`
Mise is a calorie tracker whose pantry happens to be accurate — not a pantry app
with calories bolted on. The calorie tracker is the daily habit that keeps
people opening the app; the pantry accrues from that habit and from receipts.

Every criticism that lands hardest lands against pantry-as-primary: the
onboarding wall, the audience mismatch, the decade of failed pantry apps. Almost
none of them land against pantry-as-byproduct. Nothing already specified
changes; order and emphasis do.

**59. ~~The pantry is built by a large first-run capture session.~~** `SUPERSEDED by 60`
Decision 23 assumed a forty-minute photograph-everything session as onboarding.
Consumer completion through a setup that long is in the single digits, and the
catalogue is close to useless below roughly 70% coverage. Batching the capture
made it tolerable, not short.

**60. The pantry populates itself first; bulk capture is optional.** `SETTLED`
Receipts and "I cooked this" both add items as a side effect of ordinary use.
Three weeks of normal usage gets most of a kitchen catalogued with no dedicated
effort. Only then offer to fill the remaining gaps — a five-minute task with
visible value, at a point where the app has already earned trust.

The big capture session survives as an optional power move for someone who wants
the full picture immediately. It is no longer the front door. Decision 23's
batching requirement still applies when the session is used.

**61. The dinner decision is the seasoning-tracking mechanism.** `SETTLED`
Reliable seasoning depletion cannot be read from a photograph of finished food —
gochujang in a stew is indistinguishable from tomato paste, and a vision model
will never report two grams of white pepper. Decision 13's "count uses" fallback
only fires when the model names the ingredient, which for the invisible
ingredients is exactly when it does not.

But when a user cooks from a suggestion, the recipe *states* what went in. That
is exact rather than estimated. So the dinner decision is not a feature sitting
on top of the pantry — it is how the seasoning promise gets kept, and the "I
cooked this" tap is a higher-quality data path than the camera. This argues for
building it earlier than the dependency chain implies.

**62. Hosted mode pools alias learning; local mode does not.** `SETTLED`
Amends decision 49. The alias table is the one asset that compounds with use,
and decision 5 made it per-device — so every install re-learns the same retail
abbreviations from scratch, by paid model call. That forecloses the only
defensible moat in the category.

Once hosted mode exists there is a server, and pooling *string-to-canonical
mappings only* costs nothing and reveals nothing: `KIKKO SOY 500ML → light soy
sauce` is a retail abbreviation, not personal data. Pantries, meals, photos, and
profiles stay strictly on-device in both modes. Bring-your-own-key users keep
working fully locally, without the shared learning.

**63. The initial customer is meal preppers.** `SETTLED`
The overlap between "logs calories" and "owns forty sauces" is narrower than
assumed — careful loggers tend to eat simple repetitive food, and elaborate
cooks find logging hardest. Meal preppers sit precisely in the intersection:
they batch cook (decision 10's multiplier), buy in bulk (the pantry), track
macros (the existing engine), and cook real food. Every mechanic already
designed maps onto that behaviour unchanged.

**65. Partial adoption is a normal state, not a failure.** `SETTLED`
Nothing is gated and nothing is paywalled, so a calorie-only user who never
opens the pantry loses nothing by not opening it, and a pantry-only user loses
nothing by ignoring macros. The worry that a split audience makes each half
"dead weight" to the other only bites if using half the app costs the user
something. It does not.

The halves are also asymmetric in a way that helps: the funnel runs one
direction, from calories into pantry. Someone logging meals accrues a catalogue
without ever deciding they wanted one — decision 58 reached from a different
starting point.

Two residuals survive, both builder-side. Unused features still cost
engineering time, surface area, and a tab half the audience scrolls past, which
is why decision 58's ordering is a real constraint. And "nobody loses money"
holds only while everything is free: once decision 49's hosted mode puts a
paywall somewhere, an audience where half the users value half the app forces
either a price set for the half-value user or a segmentation that complicates
the offer. Carry that into decision 50.

**64. The app never makes a food-safety claim.** `SETTLED`
Predicted expiry is presented as an estimate and never as a verdict. The wording
is "use soon", never "safe to eat" or "unsafe". Shelf-life tables vary too much
by handling to support a safety claim, and the liability surface is not one to
walk onto casually. `expiry_source` already distinguishes predicted dates from
known ones; this makes the copy rule explicit.

---

## Matching, learned during implementation

**66. A remembered alias is a cached candidate, not a cached answer.** `SETTLED`
Found reviewing `add-identity-layer`. Step 3 writes an alias back even when it
only reached the confirm band, so the string is cheap to score next time. But
the exact-alias step then returned a flat high confidence for any hit, so the
*second* sighting of that string resolved silently — the confirmation the user
never gave was never asked for again.

Receipts repeat the same abbreviations every shop, so second sightings are the
common case, not the rare one. A single ignored prompt would have hardened a
0.62 guess into permanent truth, which is precisely the silent mismatch
decision 32 calls worse than nagging.

The exact-alias step now bands on the alias's *own* stored confidence. Seeded
and user-confirmed aliases carry 1 and resolve outright; a write-back carries
the score that produced it and comes back asking. The general rule: **confidence
travels with the fact, and is never restored by the route used to reach it.**

**67. Trigram similarity is structurally weak on CJK.** `OPEN`
Measured during `add-identity-layer`: `李錦記 蠔油` scored **0.27** against its
own canonical. A four-character phrase yields two trigrams, so Dice similarity
over ideographic scripts is close to meaningless — the scorer was designed for
Latin receipt abbreviations and quietly does not transfer.

Exact CJK aliases work, so seeded strings resolve. Everything else falls to the
model, which is correct behaviour but means offline CJK matching effectively
does not exist and every unseeded CJK reference costs a call until learned.
That undercuts decisions 4 and 31, where in-script coverage is the
differentiator. Tracked as its own change.

---

## Input channels, planned

**68. A purchase always creates a new pantry item; reconciliation depends on state.** `SETTLED`
Planning `add-receipt-import` exposed a conflict between two settled decisions.
Decision 55 says a receipt matching an existing item *sets* its amount and zeroes
drift. Decision 56 says one pantry item is one physical container. Buying a
bottle while you already own one is a second container, not a correction to the
first — so as written, the two cannot both hold.

Resolved: a purchase **always** creates a new pantry item, at a known quantity
with zero drift. Re-anchoring is then automatic rather than a special case,
which is what decision 55 was reaching for.

Reconciliation against existing items of the same canonical depends on their
state: items at `out` are marked replaced, an item at `running_low` prompts once
and is otherwise left alone, and items `in_stock` are untouched. The automatic
branch is the only one where the app already believes there is nothing left.

This keeps decision 56 intact and stops the catalogue quietly accumulating
phantom half-empty containers.

**69. Non-food is a classification, not a failed match.** `SETTLED`
A receipt carries paper towels, carrier bags, tax, subtotals, and payment lines.
These score near zero against every canonical — but so does an unknown Filipino
sauce, and the two must not be treated alike. Routing non-food to the review
queue would fill it with rubbish and teach the user to ignore it, which costs
the queue its value for the unknown foods it exists to catch.

So extraction classifies each line as food, non-food, arithmetic, or discount,
and only food lines reach the matcher. The prompt is biased toward calling
ambiguous lines food: a misclassified food line disappears silently, while a
misclassified non-food line is merely visible clutter.

**70. A cached miss is cached.** `SETTLED`
A barcode absent from the remote source is stored as a marked not-found row with
a timestamp, not left absent. Otherwise every rescan repeats a request that will
fail again — and the fallback path is exactly where a user is most likely to
rescan out of hope. Honoured for a month before retrying, since the remote
database gains entries constantly.

**71. Reused error vocabulary, without reused routing.** `SETTLED`
The barcode lookup client is not an inference call and has no API key, so it
does not join the provider registry. But it throws the same
`src/api/errors.ts` kinds, because every caller already knows how to handle
them and a second vocabulary for "the network is down" is one too many.

`VisionError` is a poor name for a barcode failure. Not worth renaming now; if a
third non-vision caller appears, it should become `AppError` with `VisionError`
as an alias.

---

## Stock status

**72. Stock status thresholds.** `OPEN`
Set while building `add-pantry-stock`, named in `src/logic/stockStatus.ts`
beside the match thresholds, and like decision 32 these are placeholders
until real usage exists. The values that survived the fixture tests:

- `LOW_STAPLE_USES = 3` and `LOW_STAPLE_FRACTION = 0.15` — a staple is low
  below whichever is larger of three typical uses or 15% of a typical
  package. On the seeded 5 kg rice bag the package fraction governs (750 g);
  on a small container the uses figure does, so both behave sensibly.
- `LOW_SEASONING_FRACTION = 0.75` — a uses-tracked item reads low after 75%
  of a typical container's worth of uses. An explicit fullness tap overrides
  this estimate unconditionally (decision 14). **Currently unreachable — see
  decision 73.**
- `EXPIRING_SOON_DAYS = 3` — perishables inside three days of their date
  read "running low" regardless of quantity, and the catalogue tints them.

Two rules the tests enforce structurally: where units mismatch or data is
missing, the status makes no claim (decision 52 applied to status — no
invented conversion factor), and the pantry view model physically omits
`qtyRemaining`/`usesCount` so no screen can render a number (decision 15).
Boundary evidence lives in `src/logic/stockStatus.test.ts`.

**73. Seasoning status is dead until unit conversion exists.** `OPEN`
Found reviewing `add-pantry-stock`. `usesPerContainer` only computes when a
canonical's `typicalUseUnit` equals its `typicalPkgUnit`, correctly refusing to
invent a factor (decision 52). Measured against the seed set: **0 of 29**
uses-tracked canonicals satisfy that. Uses are expressed in tbsp and tsp,
packages in ml and g, so the two never meet.

Verified rather than inferred — seeded gochujang reads `in_stock` at a
`usesCount` of 1,000.

The consequence is that decision 12's uses model and the "never lose track of
seasonings running out" promise are non-functional. Fullness taps still work, so
the manual override is fine; it is the automatic estimate that never fires.

Neither the seed data nor the status code is wrong. A use *is* naturally a
tablespoon and a package *is* naturally 500 ml — forcing them to match would
make the data worse. What is missing is the conversion between them, and
`convert(qty, from, to, canonical)` is already specified in
`add-stock-depletion` task 2.1, where tbsp-to-ml is fixed and g-to-ml uses the
`densityGPerMl` these canonicals already carry.

So this is a cross-change dependency neither spec caught: pantry status silently
needs depletion's converter. Closed by `add-stock-depletion` rather than
patched here, because building a second partial converter would mean two things
to keep in agreement.

**74. An estimated decrement demotes `qty_source` away from `user`.** `SETTLED`
Found reconciling the depletion plan against the pantry code that now exists.
`pantry_items.qty_source` distinguishes a figure the user typed from one the app
estimated, and `pantryStore` gates its `userEnteredQty` echo on it.

So the first estimated decrement against a user-entered quantity must flip the
column to `estimated`. Leave it as `user` and the pantry screen renders a
decremented estimate labelled as the figure the user typed — decision 15
violated through the write path. The view model was built so no component could
reach an indefensible number; this would hand it one wearing a badge that says
otherwise.

Same class of failure as the confirm-band leak in `add-identity-layer`
(decision 66): a value laundering its provenance by travelling a route that
restores trust it no longer deserves. That is twice now, which makes it a
pattern worth naming rather than a coincidence — **whenever a value moves
between stores, check whether its confidence moved with it.**

A user who typed a quantity loses their echo after the first meal that touches
the item. Correct: it is no longer their figure. Setting fullness or typing a
new quantity restores it, and both already zero drift.

---

## Bugs that taught us something

**75. Date shown and date written must be reconciled, not merely computed.** `SETTLED`
The first standalone APK produced "adding meals doesn't work at all". Meals were
saving correctly — four of them, on 31 July at 23:25 — while the Today screen sat
on 27 July reading "Nothing logged yet" under a toast saying "Meal saved".

Two independent causes, both real:

`dayStore.ts:43` initialises `selectedDate` at module-evaluation time and nothing
ever advances it. Expo Go reloads the bundle constantly so the value is always
fresh, which is why this shipped; a standalone build keeps the JS context alive
for days and the value ages with it.

Separately, `addMeal` compared the saved meal's date to the viewed date and, on
mismatch, deliberately refreshed only the strip dots. The divergence was
anticipated and handled by showing the user nothing — no stale state required,
just a user browsing back through the week.

Neither the write nor the read was wrong in isolation. What was missing was any
rule reconciling them. Recorded because it generalises: **when one value is
computed at write time and another at read time, specify what happens when they
disagree — "handled" is not the same as "resolved".**

Tracked as `fix-day-selection`.

**76. A confirmation that the screen contradicts is the bug, whatever the data says.** `SETTLED`
"Meal saved." over "Nothing logged yet" is what turned a navigational quirk into
a report that the core feature was broken. The database was right the whole time
and it did not matter.

So: no success confirmation may be shown over a screen that does not evidence it.
Ordering feedback after the resulting state is on screen is now a rule rather
than an accident of where the call happened to sit.

**77. Development-only invisibility is a category of risk to test for.** `SETTLED`
This bug could not be seen in Expo Go and could not be caught by the suite,
because every existing test runs at a single instant and no test simulates the
passage of time or an application lifecycle.

`src/logic/dates.ts` already takes an injectable date on every function, so the
regression test costs almost nothing — it simply had never been written. Any
behaviour that depends on the clock, on app lifecycle, or on a long-lived process
needs a test that manipulates those directly, and verification for such fixes
must happen on a standalone build rather than in Expo Go.

---

## The dinner decision

**78. Decision 15 constrains display, not computation.** `SETTLED`
Surfaced planning `add-dinner-decision`. The suggestion engine must rank urgency
by value at risk (decision 35), which needs `price_cents` and `qty_remaining` —
both of which `PantryEntry` deliberately omits.

That is not a conflict. The engine computes with those numbers and renders none
of them: a reason chip reads "saves $8 of stock", which is a price the user paid
at a till, never an estimated remaining mass. So the engine reads stock through
its own query rather than the pantry view model, and the view model stays narrow.

Widening `PantryEntry` to serve the engine would have been the mistake — it would
put an indefensible number one autocomplete away from every component.

**79. A known canonical identity is carried, never re-derived.** `SETTLED`
`meal_items` gains a nullable `canonical_id`. Null means "resolve by name", which
is today's behaviour and correct for photographed meals — a photo produces "soy
sauce" and genuinely cannot say which bottle.

A recipe can. It produces `soy-sauce-light` and says so, and pushing that back
through fuzzy string matching discards exactly the precision that made decision
61's argument work. The whole reason the recipe path beats the camera for
seasonings is that it states its ingredients; throwing the identity away at the
last step would waste it.

Generalises decision 66's rule to identity as well as confidence: **a value that
arrives already known should not be re-derived by a lossier route.**

**80. Cooking a suggestion produces an ordinary meal.** `SETTLED`
Not a parallel "cooked recipe" path. The suggestion's ingredients become
`meal_items` with canonical ids attached, the servings figure becomes decision
10's multiplier, and it commits through the existing flow.

Depletion, calorie totals, reversal, and editing already work on meals. A second
path would need all four rebuilt and would drift from the first. The recipe's
advantage is that its quantities are *stated* rather than estimated — a
data-quality difference, not a structural one, and it needs no new machinery.

It also means the batch case is already solved: the multiplier debits four
servings, and decision 51's leftovers venue stops the rest debiting again.
---

## Depletion, learned during implementation

**81. `DRIFT_LIMIT` is 8, and confidence is a property of the claim.** `OPEN`
Set while building `add-stock-depletion`, named in `src/logic/stockStatus.ts`
beside the other thresholds. Eight estimated decrements without a
ground-truth anchor and the app stops asserting: `stockStatusWithConfidence`
returns `confident: false`, and the wording changes from "Running low" to
"Probably low". Still a guess — tuning it changes no interface and no schema.

Two rules fell out of implementing it, both worth keeping:

- **An explicit user action is always confident.** A fullness tap or a
  status tap is ground truth, so drift accumulated before it is irrelevant.
  Only estimates decay.
- **Reversal unwinds drift with the amount.** Deleting a meal restores what
  it took *and* the confidence it cost. Leaving the counter raised would
  make an undone action permanently expensive.

The fullness check is offered only when an item is both drifted and already
reading low — the one moment the question earns its interruption. Never on a
schedule, which is the nagging decision 14 rules out.

**82. A consumption event records what was applied, not what was intended.** `SETTLED`
Found by the clamp test. An item with 100 g left, hit by a 500 g decrement,
clamps to empty — but the event was storing the intended 500 g, so reversing
that meal handed the item 500 g it never had. A delete-then-undo cycle was
quietly a stock generator.

The event now stores the amount actually removed. The intention is not worth
keeping: nothing reads it, and the one thing the ledger exists for —
restoring exactly what was taken — needs the applied figure. The clamp
itself remains drift evidence, which is what the spec asks it to be.

This is the same shape as decisions 66 and 74 one more time: a value that
means one thing in one place, read as if it meant something stronger in
another. Third instance, so the rule stands on its own — **when a value
crosses a boundary, carry what actually happened, not what was asked for.**

**83. The servings control asks on every home-cooked meal, for now.** `OPEN`
The design left open whether to ask always or only on meals that look
cooked. Shipping "always", because the control is optional, defaulted, and
remembered per dish — a repeated dish offers its previous yield, so the
common case is zero taps and the fallback costs nothing to add later.

The alternative needs a definition of "looks cooked" (item count? manual
additions? meal type?) and every candidate is a guess that would be wrong
for someone. Deferred until real usage shows the friction is real.

---

---

## Day selection, learned in the build

**84. `fix-day-selection` shipped as a mode, not a comparison.** `SETTLED`
Implemented per the change's design: `dayStore` gained `following: boolean`
rather than snapping `selectedDate` to today whenever it drifted. A
compare-and-snap approach cannot tell "27 July because that is today" apart
from "27 July because I deliberately scrubbed back to it" — which is the
exact ambiguity that shipped the original bug — so the mode is what lets a
long-running app self-correct and a chosen day hold at the same time.

`syncToToday()` runs on Today-tab focus and on the app returning to the
foreground; either alone leaves a window (tab focus misses midnight passing
while the tab stays open, foreground misses nothing extra but costs nothing
to add). `addMeal`'s mismatch branch — previously touching only
`loggedDates` and leaving the view on whatever day was selected — now sets
`selectedDate` to the saved meal's day and re-enables `following`, which
makes the original failure structurally unreachable through that path
rather than merely handled.

The two regression tests specified in the design (`src/logic/dates.ts`
already takes an injectable date, so no fake-timers library was needed
beyond `vi.setSystemTime`) were confirmed failing against the pre-fix store
before the fix landed, per decisions 76/79's pattern of writing the test
first. Three more were added covering the same-visit no-drift guarantee and
the leave-and-return reset, since the design's minimum bar left those two
scenarios from the spec otherwise unverified. All five pass; `npm test` is
166/166 and `npm run typecheck` is clean.

**Not verified here:** task 6.6 calls for a standalone APK test — background
the app, advance the device clock, reopen, confirm the new day shows. Expo
Go's reload cycle is what hid this bug originally, so that check needs a
real device or emulator build and could not run in this environment. Flagged
for the next on-device pass alongside `add-identity-layer`'s keyed run and
`add-pantry-stock`'s hand verification.

Task 4.3 — totals and macro bars picking up the new meal immediately — was
still open when the above was written. Closed since: `consumed` is derived
directly from the same `meals` array `refresh()` just fetched, so there is no
second path for it to lag behind, and the "saving while viewing an earlier
day" test now asserts the macro totals alongside the meal's presence in the
list, not just the list.

**85. Reversal hard-deletes; there is no reversal marker.** `SETTLED`
`add-stock-depletion` task 1.1 asked for "a reversal marker" on
`consumption_events`. The implementation instead deletes the rows on reversal,
which is the better choice — a deleted meal genuinely should not count toward
"used in 23 meals since you opened it", so there is nothing a tombstone would
earn.

But the column shipped alongside the behaviour: `reversed_at` existed, was
inserted as NULL, and one query filtered `WHERE reversed_at IS NULL` as though
it meant something. It never could, because reversed rows do not survive to be
filtered.

Removed before merge, and the timing is the point. Migrations are forward-only
and never edited once shipped, so the moment before merge is the *last* moment
that column could be removed at all. Dead schema with a query pretending to use
it is exactly what convinces the next reader that reversal is a soft delete and
that they can build on it.

**86. Decision 73 is fixed in mechanism and half-delivered in data.** `OPEN`
`convert()` closed the conversion gap: 13 of 29 uses-tracked seed canonicals can
now compute a container size, up from **0**. The regression test runs against the
<!-- pre-existing: entry ends mid-sentence in the source this was branched from -->

---

## Macro gaps

**87. Fibre does not exist yet, and adding it is its own change.** `SETTLED`
Asking which macro is short can only answer for protein, carbohydrate, and fat,
because those are the only three the app has ever recorded. Fibre is absent from
`Macros`, from `meal_items`, from the estimation prompt, and from the profile's
targets.

Adding it is not a field. Fibre is **not a share of calories** — protein, carbs
and fat are percentage splits summing to one, while fibre is grams per day
irrespective of intake — so it cannot join `macroTargets` and needs its own
column and default.

The part that carries risk: `meal_items.fibre_g` must be nullable, and `Macros`
must carry `number | null`. Every meal logged before the change has *unknown*
fibre, not zero, and widening a type used across aggregation, the day store,
scaling and review means the compiler flags many sites at once — where the
tempting fix is `?? 0`. A day the app cannot total reading "0 / 30 g" is
decision 15's failure in a new place. Tracked as `add-fibre-tracking`.

**88. Macro-gap suggestions rank contribution first, expiry second.** `SETTLED`
The exact inverse of the dinner decision, and the inversion is why the engine
needs an objective rather than a second implementation.

The dinner decision optimises for clearing stock, with calories as context. A
macro-gap request optimises for closing a nutritional gap, with expiry as a
tiebreak among comparable contributors. An expiring cucumber is a good answer to
"what should I cook tonight" and a useless one to "I need 127 g of protein".
Getting it backwards produces suggestions responsive to the wrong question,
which is worse than none because it still looks like an answer.

**89. The answer is scaled to the gap and the hour.** `SETTLED`
127 g of protein short at 11pm is answered by yoghurt and eggs; the same gap at
6pm may be answered by a meal. Fixing the output shape at "a meal" makes the
feature useless at one of those times, and `mealTypeForTime` already computes
what is needed to tell them apart.

**90. A shortfall the kitchen cannot close is said so.** `SETTLED`
Offering a 20 g suggestion against a 127 g gap, framed as "here's what to eat",
implies the problem is solved. The number is real and the impression is false —
decision 15's family. "This adds 20 g of the 127 you're short" is the same
suggestion told honestly and costs nothing.

**91. Macro suggestions are pull-only.** `SETTLED`
No prompt, no notification, no badge. The bar is pressable and nothing urges it.

A macro sits below target most days — that is what a target means — so an app
remarking on it daily is decision 14's nagging in a new place, with more force:
the shortfall is usually not even a problem. Decision 14's rule generalises to
**offer on suspicion, never on a schedule, and let the user come to it.**

---

## Capture

**92. One action adds to the pantry; the app decides the method.** `SETTLED`
The queue was heading for three doors — a scan screen, a receipt screen, and a
grocery photo screen that nothing actually planned — each requiring the user to
classify their own input before the app would help.

That decision belongs to the app, which can make it better than they can. A
barcode is recognisable by the camera in milliseconds and a receipt does not
look like a bag of onions. Asking a person to sort it out first is friction the
product invents and then charges them for.

Routing is tiered by cost: a product barcode resolves locally with no model call
at all, and only a capture without one is interpreted. Since packaged goods are
a large share of what enters a pantry, the most repeated action in the app
mostly pays nothing.

**93. A detected barcode routes only if it resolves.** `SETTLED`
Receipts carry barcodes — supermarkets print one at the foot for returns. A
router trusting detection alone would send every receipt to a product lookup,
fail, and report a bad scan, for the input it was most meant to help with.
Requiring resolution makes the receipt's own barcode a harmless non-event, and
an unknown product code falls through to image interpretation, which is the
right outcome anyway since the label is in frame.

**94. Classification and extraction are one request, returning a tagged result.** `SETTLED`
Not classify-then-extract. Two calls double the cost and latency of every
capture to answer a question the extraction pass already answers — a model
transcribing an image knows whether it is reading a till roll or a bag of
onions.

The result is a discriminated union rather than a superset object carrying both
`lines` and `items` with most fields empty, because that shape invites a caller
to read the wrong one. The tag forces the branch.

**95. Automatic routing is only safe because every route lands on review.** `SETTLED`
A menu makes a wrong choice the user's; a router makes it the app's. The honest
compensation is that nothing is written before the user sees what was found.

Which also sets the bar correctly: classification does not have to be perfect to
beat a menu — it has to be **recoverable**. A misrouted receipt would otherwise
produce a catalogue of line-item nonsense.

**96. Capture is not unified with meal logging.** `SETTLED`
Photographing dinner to log calories and photographing shopping to stock the
pantry are different intents, and a plate of food is genuinely ambiguous between
them. The model can describe the image; it cannot know which the user meant, and
guessing wrong writes to the wrong place. Separate tabs, separate actions.

## Venue inference

**97. The venue control gets a guess, not a question.** `SETTLED`
Every logged meal asks whether it was cooked, eaten out, or is leftovers, and
the answer currently defaults to whatever was chosen last — right exactly as
often as habits are consistent. The app can do better than stickiness, so it
should, but the guess is a *preselection* and never a decision taken from the
user: it arrives already chosen, changing it is one tap, and the user's choice
always wins. Less friction is the entire point; removing the choice would be a
different and worse product.

**98. The venue assessment rides in the estimate request.** `SETTLED`
The model is already looking at the photograph in order to name the food, and
whether the plate is on a restaurant table is visible in the same image. One
optional field in the existing schema, parsed optionally so a response without
it is still a valid estimate — the calorie path is the core and must not
regress for a secondary field. Same argument as decision 94.

**99. An uncertain venue resolves to home.** `SETTLED`
The two mistakes are not symmetric. Guessing *out* when the meal was cooked at
home means the pantry is not debited, so the app believes you still have the soy
sauce you just finished — which is the failure decision 3 exists to prevent, and
it is discovered mid-cook. Guessing *home* when the meal was eaten out debits
food that never left, which is annoying and self-correcting twice over: decision
55's receipt re-anchor resets the amount on the next shop, and decision 53's
drift counter softens the claim in the meantime.

The commoner case and the cheaper mistake happen to agree, which is convenient
but not the reason. The reason is that a missed decrement breaks the promise and
a phantom one does not.

**100. Three signals, combined in a pure function.** `SETTLED`
The model's assessment, the share of the meal's ingredients matching current
stock, and whether an earlier batch of the same dish still has portions
outstanding. The last two are already recorded and were never read — decision 10
knows a batch made four portions, decision 51 knows leftovers are a venue, and
the arithmetic between them is what lets the app *offer* leftovers rather than
waiting for the user to remember the option exists.

Stock match is a ratio, not a boolean: a restaurant dish containing chicken you
also own is the case a boolean gets wrong, and a threshold on a ratio is tunable
where a boolean is not.

**101. A learned per-dish default is a signal, not an override.** `SETTLED`
Venue is a property of what you are eating far more than of the day. Someone
cooks at home most nights and always buys the same Friday takeaway; a global
sticky default gets that wrong every week and a per-dish one gets it right
without being told. But it is ranked *with* the other signals rather than above
them, so a learned "out" does not survive a photograph plainly showing a home
kitchen and a meal made entirely of stock. A later correction replaces an
earlier one, so an accidental correction is not permanent.

## Dietary rules

**102. Dietary rules are three kinds, and merging them is the mistake.** `SETTLED`
Allergen, restriction, dislike. They look like one list and behave like three,
because the cost of a mistake differs by orders of magnitude.

An **allergen** is a safety matter: uncertainty must exclude, the match must
cover derivatives, the filter must be local. A **restriction** — vegetarian,
halal, no pork — is a rule the user holds and the app has no business softening;
it filters hard, but the app may state it plainly because the user is the
authority on their own rule. A **dislike** is a preference, and filtering on it
is the wrong response — someone lukewarm on coriander has not asked never to be
shown a dish containing a little.

A single list would have to pick one policy, and whichever it picked would be
wrong twice.

**103. Exclusion is enforced locally, after the model returns.** `SETTLED`
The prompt is told the rules as well, and it will usually work. It is not the
mechanism. A suggestion engine that relies on a model to enforce an allergy has
built a safety-adjacent guarantee out of a probabilistic system, over a network,
from a provider the user chose in Settings and may swap tomorrow. Decision 66
says confidence travels with the fact; this is the same instinct taken to its
end — where being wrong costs a hospital visit rather than a wrong number, the
check is local and deterministic or it is not a check.

**104. Unknown is not absent — for allergens only.** `SETTLED`
When a suggestion names an ingredient the app cannot resolve, assuming it is
fine makes the feature fail exactly when identification is hardest: an
unfamiliar ingredient, a regional name, a transliteration. Decision 4 makes
Asian coverage the differentiator, so unresolved names are not a rare edge here
— they are the audience. An unresolved ingredient therefore excludes the
suggestion when any allergen is recorded. The cost is one lost suggestion and
there are others.

Scoped to allergens deliberately. Applying it to dislikes would cost suggestions
for someone who merely dislikes coriander — attrition with no payoff.

This is the mirror of decision 99, run the other way because the costs run the
other way. There, uncertainty resolves to the action. Here, to inaction.

**105. Exclusion covers derivatives, held as a general relation.** `SETTLED`
Avoiding milk must also avoid butter, ghee, paneer and condensed milk, which a
string match on "milk" does not. Modelled as a parent/child relation between
canonical ingredients rather than as allergen groups, because "butter is derived
from milk" is the general fact and it is reusable — a dairy restriction reads
the same edges, and so will substitution.

Seeded for the common families *and* for the Asian edges the catalogue already
has canonicals for: fish sauce from fish, oyster sauce and shrimp paste from
shellfish, hoisin and gochujang from soy and wheat. A Western-only seed would
miss exactly the ingredients this app claims to be good at.

**106. Dislikes down-rank; they never filter.** `SETTLED`
Decision 33 puts three suggestions in front of the user and decision 34's
use-first constraint has already narrowed the pool once. Removing candidates
from a pool that small collapses it. A dislike should lose a close contest, and
a high value at risk should sometimes beat it — a dish using the mushrooms
expiring tomorrow is a reasonable thing to offer someone lukewarm on mushrooms.
Which is the whole reason it is a weight and not a filter.

**107. Logging is never filtered by a dietary rule.** `SETTLED`
If the user eats it, the app records it — no block, no confirmation step, no
warning that obstructs. The core promise is a record of what was eaten, and a
tracker that makes it harder to record a meal because it disapproves is broken
as a tracker. The user already knows; they were there. A note is the ceiling.
The pantry is unaffected too: people buy and store food they do not eat.

**108. The app never says food is safe.** `SETTLED`
Never *safe*, never *suitable*, never *free from*. It reports what it excluded —
"nothing suggested contains peanut" — because that is the only thing it actually
did. Anything stronger is a promise about a recipe it did not test, from a model
it does not control, cooked in a kitchen it cannot see. This is a spec
requirement and a test asserting the forbidden words appear in no dietary
string, not a style guideline: copy drifts, and this is the one place where
drifting upward in confidence is dangerous.

**109. An unresolvable rule is recorded anyway, and labelled.** `SETTLED`
Refusing to record an allergy the catalogue does not know is the worst failure
available here — it happens most for the least common allergens and the least
Western ingredients, at the moment the user is telling the app the most
important thing they will ever tell it. So take the rule, match it by normalised
name, and show which rules resolved to a catalogue ingredient and which did not.
A user who can see their rule matched only literally can add a second one.

## Receipts, planned deeper

**110. A receipt quantity is either a count or a measure, and the receipt says
which.** `SETTLED`
`2 @ £1.79` is two jars. `0.834 kg @ £12.99/kg` is 834 grams. The unit price
distinguishes them, and the weight-priced line contains a number that reads
exactly like a quantity — using it as one creates a pantry item holding 0.834 of
something, or rounds it to one. Loose produce, meat and fish are all priced this
way, which is most of the fresh food in a shop, and that is precisely the stock
the dinner decision chases by expiry. Getting it wrong makes the best feature
run on nonsense.

Where neither is legible the measure is unknown, not defaulted. Decision 15
forbids displaying an indefensible quantity; storing one is the same mistake
earlier and harder to find.

**111. A count creates one pantry item per container.** `SETTLED`
Decision 56 makes a pantry item a container. Two jars of gochujang are two
items, consumed one after the other; merging them into one item of quantity two
makes the second jar's expiry a lie, because it is unopened. The same ingredient
on two separate lines is treated the same way — two purchases, not a duplicate
to collapse. Collapsing is the tempting defence against extraction reading a
line twice, and it is wrong more often than right, because receipts genuinely
repeat items.

**112. Money-only lines move money and never stock.** `SETTLED`
Discounts, loyalty adjustments, deposits, levies, refunds. Each is a real line
and none is a thing that entered the kitchen. They need naming rather than
sweeping into `non_food`, because `non_food` means "a thing that is not food" —
washing-up liquid — whereas a discount is not a thing at all, and it changes
what a food line *cost*, which is the number decision 35 ranks urgency by.

An unattributable basket discount stays at the receipt level rather than being
spread across lines: spreading is a guess that, once written, is
indistinguishable from a price read off a receipt. A refund moves no stock — it
says money came back, not which item to remove or whether the food was ever put
away.

**113. The receipt's printed total is a free correctness check, and is never
enforced.** `SETTLED`
Extraction either dropped a line, invented one, or misread a price, and the
receipt prints a figure that disagrees when it did. Surfacing the mismatch
localises the problem — the difference between "check these thirty lines" and
"something here is wrong by £4.20". Correcting it would mean choosing a line to
alter, which is a guess dressed as arithmetic, and the altered line would then
look like extracted truth. Silence when it agrees, because a check that
announces itself when nothing is wrong trains people to dismiss it.

## Barcodes, planned deeper

**114. Three kinds of scanned code are not products, and each fails
differently.** `SETTLED`
A **misread** fails its check digit: nothing is wrong with the shelf, the scan
is simply not a scan yet. A **store-local code** is a valid barcode from the
range retailers reserve for goods priced in-store, meaningful inside one shop
and often encoding a price or weight rather than an identity. An **unknown
product code** is a real GTIN the remote source has never heard of — and it is
the only one of the three that should be cached as a miss.

The distinction is load-bearing because decision-level behaviour already in the
plan is right for the third and harmful for the first two: a cached miss on a
misread makes a good tin unscannable for a month, and a canonical bound to a
store-local code makes a deli sticker mean "chicken thighs" in every shop the
user ever visits, since the range repeats across retailers. Validation happens
before the request because it is free, pure, and prevents a failure
indistinguishable from a real miss once the request is made.

An embedded weight is not read as a quantity: the encodings are
retailer-specific and undocumented, and the field that looks like a weight is
frequently a price.

**115. A multi-pack expands into its containers.** `SETTLED`
Six cans scanned once is six pantry items, not one item of quantity six.
Decision 56 again, and the expiry model rests on it: five unopened cans and one
opened one have different expiries and statuses, and a single item of quantity
six can only represent one of those states. Only when the count is known —
`6 x 400 ml` states it, `2.4 l` does not, and dividing by a guessed container
size is inventing a fact.

It also keeps the two paths consistent: scanning the same tin three times
already produces three items, and a three-pack scanned once now produces the
same three. A user should not get a different pantry depending on whether the
shop shrink-wrapped their tins.

## Providers, planned deeper

**116. A rate limit retries once, in the facade, at the provider's stated
delay.** `SETTLED`
`rate_limited` has been in the taxonomy since the beginning and nothing ever
acted on it — the error says "try again" and the user does it by hand. Three
providers makes that worse, since one has a free tier limited by requests per
minute and a user logging breakfast, a coffee and a snack in succession will hit
it.

The policy lives in `vision.ts`, not in each transport: what is provider-specific
is the *shape* of the stated delay, which is exactly what a transport exists to
normalise. Three copies of a backoff would drift invisibly.

Once, not exponential. The usual argument for a retry loop assumes a background
job; here a user is holding a phone looking at a photograph of their lunch, and
a second failure is worth more to them as information than as a third attempt.

Only `rate_limited`. `unauthorized` and `billing` need the user to go and do
something; `cancelled` is a request not to. `malformed` is the subtle one —
retrying it feels reasonable because the model might answer better next time,
and it is still wrong: it spends the user's money on a coin flip they did not
ask for and hides a prompt problem that ought to be visible.

The wait is visible and cancellable. A silent thirty-second pause is
indistinguishable from a hung app, and the rational response to a hung app is to
kill it — losing the retry that was about to succeed.

## Matching, planned deeper

**117. Han variant forms fold for matching and never for storage.** `SETTLED`
`蠔油` and `蚝油` are the same oyster sauce; a Hong Kong bottle prints one and a
mainland bottle the other, and the same shopper buys both. A mapping table
restricted to characters the catalogue actually uses, generated from the
catalogue — not a dependency, which would be disproportionate for a set this
small. Folding applies to comparison only: decision 31 keeps the composed
original, and showing a Hong Kong user a simplified name they did not write is
the same class of mistake as romanising it for them.

**118. Romanised references are the gap script-awareness does not close.** `SETTLED`
Decision 4's audience frequently types `gochujang`, not `고추장` — an
English-language phone keyboard, a recipe site's spelling, a Western
supermarket's receipt line. These are Latin strings, so script detection sends
them down the Latin path, where they meet a seeded romanisation that may be
spelled differently. Strip diacritics, collapse spacing and hyphenation, and
**seed the variants people actually write as aliases** rather than inventing a
transliteration algorithm — romanisation systems disagree with each other and
with common usage, and a table of what people write is truer than a rule for
what they ought to write.

Loosening a Latin matcher is how over-matching gets introduced, and short
romanised words collide readily, so the near-miss pairs are asserted and the
Latin corpus is re-measured after every loosening step. This work must not be
paid for by the English path.

## Fibre, planned deeper

**119. An incomplete day yields no fibre shortfall.** `SETTLED`
Decision 89's macro-gap engine turns a shortfall into a suggestion. A fibre
shortfall computed from a day whose fibre is partly unknown would say "you need
12 g more fibre" when the truth is the app does not know what you have eaten —
which is the exact sentence this change exists to prevent, arriving through a
different door. No gap, not a gap of zero, and not a gap over the known part.
Say why: "fibre isn't fully known for today" is a state the user can act on by
editing a meal.

**120. Unknown fibre exports as unknown.** `SETTLED`
The export is the copy the user keeps and the one that outlives the app's own
careful handling. A null that becomes a zero on the way out undoes the whole
change for anyone who ever looks at their data elsewhere.

## Capture, planned deeper

**121. A receipt too long for one frame is captured in several.** `SETTLED`
A weekly supermarket shop prints a till roll that does not fit in one legible
photograph, and the plan assumed one capture is one thing — true for a barcode
and a bag of onions, false for the input the receipt path most wants, which is
also the one that fills a pantry.

Each frame is interpreted separately and the lines are merged locally; the model
is not asked to stitch images. Overlap is the normal case rather than the error
case, because people overlap deliberately to avoid missing a line, so
de-duplication matches on text, price and position together — text alone would
collapse a legitimate repeat, and decision 111 says a repeat is two purchases.
Decision 113's arithmetic check earns its keep here: it is what catches a merge
that dropped or duplicated a line.

No prompt for more frames when one sufficed. An extra step on every small
receipt to serve the occasional long one is the friction decision 92 removed.

**122. A pending capture lands on review, never on the pantry.** `SETTLED`
The queue is persisted with its images, because a queue in memory loses the
capture at the moment the user is least able to retake it — they have put the
shopping away. It releases on a key being configured as well as on a connection
returning, since no-key and offline are different waits with the same shape.

Decision 95 does not weaken because the write happens later: an interpretation
that completes in the background still lands on review. Retries are bounded and
a persistently failing capture is reported as failing, because "still pending"
for a week is a lie by omission. The images are covered by *Delete all data*.

## Suggestion templates

**123. The engine's objective is a named template, chosen from a fixed set.** `SETTLED`
Decision 89's engine already takes an objective so that one engine, one prompt
and one cache serve more than one question — and then defined exactly one
objective beyond the default. The objective the user actually has is usually
bigger than tonight's protein number: eat lighter, eat more, get it done in
twenty minutes, clear the fridge.

Six, each answering a question the others answer differently: `use_it_up`,
`lean`, `strength`, `balanced`, `quick`, `stretch`. A seventh that reorders
nothing is a label, and labels that do nothing are how a picker becomes noise.

The set is not user-editable. Someone who can build an arbitrary objective will
build a bad one and blame the suggestions.

**124. A template is a weight vector, not a code path.** `SETTLED`
The scorer reads weights from the active template and never branches on which
one is active. Six code paths through the ranker is six places for decision 34's
use-first constraint to be forgotten; a weight vector cannot forget a constraint,
because the constraint is not in the weights.

Every template weights the same facts — urgency, value at risk, familiarity,
effort, macro fit. A template introducing a private input would make its results
incomparable and its bugs unreproducible under any other template.

**125. No template may relax the use-first constraint.** `SETTLED`
Decision 34 is the difference between this feature and a recipe chatbot. A
template that could relax it would be relaxed immediately — `strength` wants the
chicken thighs and the rice, not the coriander wilting in the drawer — and the
feature would quietly become a generic recipe generator with a nutrition filter,
which is what decision 33 rejected and which any free chatbot does better.

So the constraint holds under every template, and a template that cannot be
served within it returns fewer suggestions and says so. `use_it_up` exists
precisely so a user who wants the constraint to be the *whole* objective can say
so — it raises the floor to be the objective rather than changing the rules.

**126. A template expresses calories through portion, never through weight.** `SETTLED`
Decision 36 says calories inform and never filter. Weighting dishes by calories
would quietly become that filter with extra steps: a low enough weight on a high
enough count is exclusion. So `lean` sizes the offered portion toward the
remaining allowance and `strength` sizes up and allows the overshoot — every
dish stays reachable, and the adjustment is somewhere the user can see and
change it.

More generally: templates change ranking and portion, never availability. The
only thing that excludes is a dietary rule, and a dietary rule is not a template.

**127. The template defaults from `Profile.goal` and never writes back.** `SETTLED`
`goal` is already collected at onboarding and currently drives exactly one
thing, a number in `energyTargets`. Defaulting from it means the objective is
stated once or never, which is the entire argument for templates.

The write-back prohibition is the sharp half. Picking `strength` for one dinner
because there is a lot of chicken to use is not a decision to gain weight, and
`profileStore.update` recalculates `targetCalories` on every write — so a leak
here would silently move the user's calorie target. Invisible, and serious. The
two concepts touch at exactly one point and must not touch anywhere else.
Remembering the last selection is fine; it lives in suggestion state, not in the
profile.

**128. Dietary rules exclude first, templates rank second.** `SETTLED`
Both features "affect which suggestions appear" and it would be easy to
implement them as one pass. They are not the same kind of thing: decision 103
makes exclusion a local, deterministic guarantee and a template is a preference.
One pass risks a weight being able to outrank an exclusion, which must never
happen.

**129. Templates describe their bias, never an outcome.** `SETTLED`
The app can honestly say a template prefers dishes with more protein for their
calories and sizes portions against what is left in the day. It cannot say what
that achieves, because that depends on everything the user eats rather than on
three dinner ideas, and this is a diary with a suggestion screen rather than
anything clinical.

So `lean` is not called *fat loss* in the interface even though that is what a
user asking for it would call it, and `strength` is not *muscle gain*. Same
refusal as decision 64, and enforced the same way as decision 108 — a copy audit
and a test asserting the outcome words appear in no template string.

**130. "Make it to Sunday" becomes a template.** `SETTLED`
Decision 41 planned it as its own mode. It is an objective over the same engine
with the same payload and the same cache, which is exactly what a template is.
One surface, one control, one less concept. It answers a weekly question from a
screen that answers a nightly one, which is noted as an open question rather
than settled.

---

## The dinner decision, learned during implementation

**131. A dish's calories live on one item; the ingredients it carries are zero.** `SETTLED`
`add-dinner-decision` task 7.1 turns a suggestion into `meal_items`. The model
gives `kcal_per_serving` for the dish as a whole, never a per-ingredient split —
it was never asked to estimate one, and estimating one now would be exactly the
fabrication decision 52 refuses elsewhere.

So `mealFromSuggestion` writes one dish-level item carrying the eaten calories
and no canonical id, plus one item per `uses` entry carrying its canonical id
and stated quantity at zero calories. The split keeps the two jobs separate:
the dish item is what the calorie total reads, the ingredient items are what
depletion reads, and neither number pretends to know what the other one knows.

Servings made scales `servingsMult`, not the logged calories — matching decision
10's existing split between "what depletion took" and "what was eaten now"; the
review screen's own "servings this made" stepper works the same way.

**132. The suggestion engine's thresholds are named guesses, not measurements.** `OPEN`
`src/logic/suggest.ts` picks numbers nothing in the design measures against real
usage: `USE_FIRST_DAYS = 3`, `USE_SOON_DAYS = 10`, `DEFAULT_VALUE_CENTS = 500`,
`FREEZABLE_DISCOUNT = 0.5`, `RECENTLY_EATEN_DAYS = 7`, `REPEAT_THRESHOLD = 2`.
Same posture as decision 81's `DRIFT_LIMIT`: named and exported rather than
buried inline, so the next pass tunes one constant instead of re-deriving the
formula.

`HISTORY_WINDOW_DAYS = 60` is the one with a real constraint behind it rather
than a guess: it has to reach back far enough for `REPEAT_THRESHOLD = 2` to
ever fire (a dish cooked every three or four weeks needs two months of history
to show up as a repeat at all), while staying short enough that a personalisation
summary answers "what do you actually cook" rather than "what did you cook once
in January." No usage data existed to fit either number against, so both are
placeholders the same way `DRIFT_LIMIT` was — expect them to move once real
suggestion-quality feedback exists to move them against.

---

## The receipt import, learned during implementation

**133. `replaced` is a fifth stock status, not a reuse of `discarded`.** `SETTLED`
Decision 68 says a receipt reconciling against an `out` item marks it
"replaced." Implementing it exposed a choice the decision itself left open:
what that word means in the schema.

`discarded` already exists and means something specific — "the raw material
for waste figures later" (decision 85's neighbour). A bottle superseded by a
fresh purchase was not thrown away uneaten; conflating the two would corrupt
a waste statistic that does not exist yet but is worth not poisoning in
advance. So `StockStatus` gained `replaced` instead, and `listPantryItems`
excludes it the same way it excludes `discarded` — a replaced item is not a
phantom container either.

**134. Receipt capture is a two-step write, because extraction is not
guaranteed to happen at capture time.** `SETTLED`
Task 7.3 requires that a receipt photographed offline is retained and
completes later "without asking the user to re-photograph." That forced the
schema question of what a captured-but-unextracted receipt *is*: a row with
an image and no lines, `insertCapturedReceipt` and `attachExtractedLines` as
two calls rather than one. Zero lines already means "not yet extracted"
truthfully, so no separate status was needed to say it twice — `pending`
covers a receipt from the moment it is captured through review, whatever
extraction has or has not managed to do to it.

Retrying reads the stored photo back through `photoBase64` rather than
threading a fresh capture through; there is no background task
infrastructure in this app, so the retry is wired to the Pantry tab's
focus effect, the same shape `dayStore`'s `syncToToday` already uses for
"catch up when the user is next looking."

**135. Extraction accuracy, as far as the fixture corpus can say.** `OPEN`
`src/logic/__fixtures__/receipts.ts`'s 8 receipts draw their food lines from
`receipt-lines.ts` — the matcher's own corpus — rather than inventing new
ones, so the resolution rate a receipt sees is exactly the identity layer's
existing rate: of that corpus's 47 reference strings, 34 resolve silently
offline, 11 need one-tap confirmation, and 2 reach the model or the review
queue. Nothing about receipt import changes that number; it inherits it.

What is new and untested against anything real: whether the extraction
prompt itself reads a photographed receipt as faithfully as these fixtures
assume, and whether the multi-quantity price split and non-food bias hold up
against a real store's paper and lighting. `add-receipt-import`'s own design
doc names this the right worry — "thirty lines with two wrong is a worse
experience than one wrong meal estimate, because the user must find the
two" — and no fixture corpus can settle it. Left open for the same reason
decision 132 left the dinner engine's thresholds open: there is no usage data
yet to measure against.

## Found in review

**136. Decision 34's constraint is stated to the model and never checked.** `SETTLED`
`add-dinner-decision` shipped 51 of 52 tasks with the use-first constraint
living entirely in `src/api/suggestPrompt.ts:19`, as a sentence telling the model
it MUST use at least one expiring ingredient. Nothing downstream verifies it.
`parseSuggestions` does drop a suggestion whose `uses` cite no known candidate,
which is good hygiene and a different thing.

The spec's wording is a promise about what the app *offers*, not about what it
*asked for*, so the requirement is currently unmet even though every test passes
— the tests cover bucketing exhaustively and never assert the property of a
returned suggestion.

This is decision 103's argument arriving somewhere it was not applied: the
prompt is a request, the local check is the guarantee. It is worth more here
than the parallel to allergens suggests, because decision 34 is the whole
difference between this feature and a recipe chatbot, and the failure is
invisible — a suggestion that quietly ignores the expiring pork still reads as a
perfectly good dinner idea.

Fixed in `add-dinner-decision` group 11: `parseSuggestResponse` now takes the
`use_first` bucket's ids alongside the candidate list and drops, after
parsing, any suggestion whose `uses` misses that bucket entirely whenever it
is non-empty — the same shape as the existing "drop, don't repair" handling
for an invented id. The prompt sentence stays; asking is what keeps the drop
rare, checking is what makes the rare case not silently ship. A dropped
suggestion is never patched by swapping in an ingredient the model didn't
choose, and the surface says how many were dropped rather than just showing
fewer.

Task 11.6 — the actual compliance rate, i.e. how often a real model needs the
check to fire — remains open. It needs live usage against a real model, which
this environment has no key for; nothing here changes if the rate turns out
to be non-trivial, but the prompt would then be worth strengthening too.

## Open data

**137. Open datasets are consumed at build time; the app never calls one.** `SETTLED`
A build script produces `assets/canonical-items.json` and the output is
committed. Three independent reasons, any one sufficient. Decision 5 is
local-first and the expiry path must work on a plane. FoodData Central requires a
data.gov API key, and shipping one inside an APK is exactly what this project
already refuses to do with vision keys — with the added indignity that this key
would be ours rather than the user's. And a runtime lookup would make the app's
predictions depend on a third party's uptime for numbers that change roughly
never.

Committed rather than generated at packaging time because **the diff is the
review**. A dataset refresh that moves 200 shelf lives should be looked at by a
person, and the only way to guarantee that is for the artefact to live in the
repository.

**138. FoodKeeper replaces the guessed shelf-life table.** `SETTLED`
Every expiry prediction in the app comes from `shelfLifeDays` and
`openLifeDays` in a 69-entry hand-authored file, and every number in it was
invented. Decision 19 made expiry a lookup rather than a model precisely so it
would be defensible; the lookup table is the part nobody had defended.

USDA FSIS publishes FoodKeeper: 500+ foods, and its schema maps onto ours almost
field for field — `Pantry_*`, `Refrigerate_*`, `Freeze_*`, and an after-opening
set that is exactly `openLifeDays`. US federal work, public domain: no
attribution obligation, no share-alike, nothing to negotiate.

**139. A shelf-life range maps onto the two urgency buckets, and is never
flattened.** `SETTLED`
FoodKeeper gives a minimum and a maximum. The app stores one number. Picking an
end is wrong in both directions.

Take the **minimum** and `use_first` fills with food that is perfectly good —
and decision 34 then *forces* every suggestion to be built around one of those
items, so the engine spends its whole output chasing false urgency and "clears
the pork belly (2 days)" becomes a claim the user can check and disbelieve.
Crying wolf does not degrade gracefully here; decision 34 makes it systematic.
Take the **maximum** and the app fails to warn while the food is still
rescuable, which is decision 3's one job.

So: the maximum sets the predicted expiry and therefore `use_first`, and the
minimum opens `use_soon`. That is what a range means — start thinking at the low
end, act at the high end — and it needs no new bucket, no new display concept,
and no invented midpoint. `use_soon` stops meaning "a fixed window before
expiry" and starts meaning "the source thinks quality may start going", which is
a better definition and one the reason chips can defend.

**140. A storage term is not a duration.** `SETTLED`
*Indefinitely*, *When Ripe*, and *Not Recommended* each get corrupted
differently by numeric coercion: indefinite as a large number gives the app an
expiry date it would then display, and Not Recommended as zero puts salt in
`use_first` forever. All three produce **no figure**. `predictExpiry` already
returns null and makes no claim where there is no data — the existing code is
right, and the pipeline must not undermine it.

**141. Provenance is recorded per field, and a refresh never overwrites or
deletes.** `SETTLED`
Per field rather than per row, because one ingredient legitimately mixes
origins: FoodKeeper knows how long chicken keeps in a freezer and knows nothing
about how much gochujang a person uses at once. Decision 66 at build time.

The rules are: fill only what is empty, never overwrite a hand-authored value,
never remove an ingredient because a dataset lacks it, and report a conflict
rather than resolving it silently.

The never-delete rule is the one that matters, and the measurement is why. The
Open Food Facts ingredient taxonomy carries 4,733 entries and has **zero** for
gochujang, hoisin, doenjang, and oyster sauce; FoodKeeper is a US supermarket
dataset and is no better. Decision 4 makes those entries the differentiator. A
pipeline treating absence as a reason to drop or blank a row would delete the
product's reason to exist, in a commit that looked like a data refresh.

**142. Expiry is described as quality, never as safety.** `SETTLED`
FoodKeeper exists to help people avoid foodborne illness. This app is a pantry
tracker with a suggestion screen, and the distance has to show in the wording.
The app can say quality is expected to hold for about so long, and where the
figure came from. It must never say food is safe, unsafe, or safe until a date —
it does not know how the food was handled, how long it sat in a car, or whether
the fridge runs warm.

Same refusal as decisions 64, 108 and 129, enforced the same way: a copy audit
and a test asserting the forbidden words appear in no expiry string. Worth
stating explicitly because the source is a food safety publication and its
vocabulary is contagious.

**143. Nutrition from a table is a fallback; a photograph always wins.** `SETTLED`
FoodData Central is CC0 and gives per-ingredient nutrition, which is what manual
entry currently lacks entirely. But the table describes 100 g of raw chicken
thigh, and the photograph was taken of something cooked in oil — so a vision
estimate of the actual plate outranks a table figure for the ingredient.
Missing nutrition stays unknown rather than zero, following
`add-fibre-tracking`'s discipline.

**144. Open Food Facts is held behind a licence answer, not adopted.** `OPEN`
The taxonomy is the single largest thing available: measured directly at 4,733
ingredients with 944 Japanese, 783 Chinese and 606 Korean translations, stored
in script and unromanised — decision 31's rule arrived at independently. It is
also Euro-centric to the point of having nothing for the ingredients this app
exists for, which is the ideal shape: it fills the unglamorous 4,700 and cannot
dilute the moat.

But OFF data is ODbL, which carries share-alike, and whether a catalogue seeded
from it and shipped in an APK is a *derivative database* or a *produced work* is
unanswered. It is also a different question from the per-user runtime cache
`add-barcode-capture` plans, and conflating the two is how one answer gets
applied to both wrongly.

`add-off-taxonomy-seed` is gated on establishing this, with three planned
outcomes — proceed under attribution, proceed and publish the derived catalogue
under ODbL, or take nothing. Two of the three are "proceed". The gate exists
because the cost of being wrong is asymmetric: doing the investigation first
costs a day, and doing it after an APK has shipped costs a reconstruction of
which fields came from where.

Meanwhile `add-open-data-catalogue` takes only CC0 and public-domain sources, so
the unblocked work is not waiting on the blocked question.

## The receipt import, deepened

**145. A count line's containers are priced by splitting the line total, remainder on the first.** `SETTLED`
Decision 111 (`main`) says a count creates one pantry item per container. That leaves a question decision 111 doesn't answer: what does each container cost? Dividing the line total by the count and rounding loses or gains a cent depending on direction, and doing that per item means N items whose prices no longer sum to what was actually paid.

`splitCents` divides in integer cents and puts the remainder on the first share, so the created items' prices always sum back to the line total exactly — "each carries its share of the line total" (spec) is true as an invariant, not an approximation. Each container otherwise carries the same shape as any other purchase: `qtyRemaining: 1`, `qtyUnit: 'piece'`, unopened, zero drift.

**146. Discount attribution resolves by exact printed text, not by position or a line id the model can't see.** `SETTLED`
The extraction call returns `applies_to_text` — the discount line's own claim about which food line it reduces, copied verbatim from what the model read. `attachExtractedLines` resolves that text to a real sibling line's id in the same insert pass, before either line has a database identity yet.

*Why text rather than a line index:* an index is a promise about array position across two independently-generated lists (a discount at position 3 of the *discount* list referring to position 7 of the *lines* list) that the model has no reliable way to keep consistent under retries or reordering. Matching by the exact string it already transcribed is the same mechanism decision 66 uses everywhere else identity travels between systems that don't share a database — no new failure mode, and no second parsing pass.

*Consequence:* two lines with identical printed text (the duplicate-purchase case decision 111 also covers) resolve a same-text discount to whichever appears first. Rare enough — a discount attached to one of two identical purchases is already an edge the receipt itself doesn't disambiguate — that this is accepted rather than solved.

**147. The arithmetic check compares against the printed subtotal, not the total, and counts every money line once — including attributed discounts.** `SETTLED`
Two things worth stating plainly, because both were nearly implemented wrong:

Comparing against the *subtotal* rather than the total means the check never needs to know or compute tax, which no line individually carries. `subtotal_cents` and `tax_cents` (task 3.7) exist as separately-read printed figures for exactly this — the check reads what the till already worked out rather than re-deriving it.

An attributed discount still counts in the sum. The temptation is to exclude it on the theory that `planReceiptApply` already "used" it to reduce the target line's price, so counting it again looks like double-counting. It is not: the printed subtotal already nets the food line's shelf price against the discount's own negative line, because that is what the receipt actually shows — two lines, not one pre-discounted line. Excluding the discount from the sum would make a perfectly correct receipt report a mismatch equal to every attributed discount on it, which is worse than not checking at all. Attribution answers "what should this pantry item cost"; the arithmetic check answers "did extraction transcribe faithfully" — different questions, and conflating them was the bug caught writing the fixtures (`moneyShaped` initially failed its own `checkArithmetic` assertion for exactly this reason).
