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

## The dinner decision, learned during implementation

**87. A dish's calories live on one item; the ingredients it carries are zero.** `SETTLED`
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

**88. The suggestion engine's thresholds are named guesses, not measurements.** `OPEN`
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

**89. `replaced` is a fifth stock status, not a reuse of `discarded`.** `SETTLED`
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

**90. Receipt capture is a two-step write, because extraction is not
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

**91. Extraction accuracy, as far as the fixture corpus can say.** `OPEN`
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
decision 88 left the dinner engine's thresholds open: there is no usage data
yet to measure against.
