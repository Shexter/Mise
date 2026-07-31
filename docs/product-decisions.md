# Mise — product decisions

A running ledger. Every decision we settle gets appended here with its
reasoning, so no context is lost between sessions or between the planning model
and the implementing one.

**Format:** decisions are numbered and never renumbered. A reversed decision is
struck through and gets a superseding entry rather than being deleted — the
reasoning for a rejected path is worth as much as the reasoning for the taken
one.

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

**64. The app never makes a food-safety claim.** `SETTLED`
Predicted expiry is presented as an estimate and never as a verdict. The wording
is "use soon", never "safe to eat" or "unsafe". Shelf-life tables vary too much
by handling to support a safety claim, and the liability surface is not one to
walk onto casually. `expiry_source` already distinguishes predicted dates from
known ones; this makes the copy rule explicit.
