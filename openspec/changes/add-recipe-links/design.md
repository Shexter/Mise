## Context

See `proposal.md` — Why, the constraint that determines the design, and what is
stored.

What ships today: `add-dinner-decision` built the cook-a-recipe-into-a-meal path
— `suggestionService.ts` constructs a meal with `source: 'suggestion'`,
`venue: 'home'`, and `MealItem.canonicalId` populated so depletion resolves by
identity rather than by name. `add-receipt-import` built the extract-structured-
content-from-an-image path end to end. Both are exactly what this change needs,
and neither needs modifying.

## Goals / Non-Goals

**Goals:**

- A recipe the user found becomes something the app can operate on, in one
  action.
- No platform integration, ever.
- The creator is credited every time.

**Non-Goals:**

- Platform contact, a recipe library, republishing, verification, feed
  importing, extra nutrition. See the proposal.

## Decisions

### The share sheet is the integration

Register as a share target for URLs, text, and images. Take what arrives.

*Why this beats an API integration on every axis that matters:* no keys, no
OAuth, no developer terms to comply with, no review process, no three
integrations breaking on three schedules — and it works on platforms nobody has
heard of yet, including whatever replaces TikTok. It also keeps decision 5
intact in a way an API cannot: nothing about what the user watches is ever
requested, so nothing about it can leak.

*Why it is not a compromise:* the caption is where the ingredient list actually
is. A platform API would return the same caption, with an access token attached
and a terms-of-service obligation on top.

*The honest limitation:* what a share sheet delivers varies by platform and by
what the user shared. Sometimes a URL and rich text; sometimes a URL alone. The
change is designed for the worst case — a bare link saves, and the user is
offered to supply the content — rather than assuming the best.

### One intake, three sources, no menu

Decision 92's argument, applied again: link, text, and image arrive at the same
place and the app works out which it has.

*Why:* asking someone whether they have a link or a screenshot is friction the
product invents and then charges them for. A URL is recognisable, an image is a
different content type, and text is what is left.

### Extraction reuses the receipt pattern exactly

`src/api/recipePrompt.ts` and `src/api/recipe.ts`, following
`receiptPrompt.ts` and `receipt.ts`: raw JSON, explicit schema, one call,
through the provider facade, `VisionError` from the shared taxonomy.

*Why not a new pattern:* the problem is identical — unstructured source
material, a structured target, defensive parsing, an uncertain result the user
reviews. Receipt import solved it once and the solution is a file away.

*One difference worth naming:* a missing quantity is ordinary here in a way it
is not on a receipt. Captions say "a splash of sesame oil". Record no quantity
rather than an assumed one, per decision 15's discipline applied at the point of
storage.

### Cooking a saved recipe is the suggestion path

Reuse `suggestionService`'s meal construction. Same `MealItem.canonicalId`, same
depletion against stated quantities, same `venue: 'home'` hardcoded.

*Why this is the point of the change rather than a convenience:* decision 61
made the dinner decision the seasoning mechanism, because a recipe the user
cooked *states* its ingredients where a photograph cannot. A saved recipe is the
same kind of fact from a different source — and arguably a better one, because a
recipe someone chose to save is one they were more likely to actually cook than
one the app proposed.

*Why the venue is hardcoded:* decision 148. The origin is known, so inference
must not run, and no learned per-dish default is recorded from it.

### The source link is not optional

Stored always, displayed everywhere the recipe appears.

*Why it is a requirement rather than a nicety:* it is the whole basis on which
taking a caption and restructuring it is reasonable. The app holds the
ingredients because it needs to compute with them, and it sends the user back to
the creator every time it shows them. The rule that keeps this honest is that
**the app is never the place someone would go instead of the video.**

*Why method steps are stored differently from ingredients:* an ingredient list
is a set of facts and the app operates on it. A method is someone's writing,
kept for the user's own reference, never presented as the app's content. That
distinction costs nothing today — there is no sharing surface — and it is
written down because the moment one exists, the question changes.

### Decision 33 is not violated, and it is worth showing why

Decision 33 rejected a recipe library: *"'what could I make' is free from any
chatbot and goes generic by the fourth day."*

That reasoning is about **the app supplying recipes**. It does not apply to the
user bringing their own. A saved collection of things this person chose is the
opposite of generic — it is the least substitutable content in the app, and no
chatbot can produce it. The app still does not browse, recommend, or supply.

## Risks / Trade-offs

**Share payloads are inconsistent** → the largest practical risk, and unknowable
without testing on real devices against real apps. Mitigation: the design
degrades to "we saved the link, paste or screenshot the ingredients" rather than
failing, and the tasks measure what actually arrives from each platform before
anything is built on an assumption.

**Extraction quality on a caption is unmeasured** → captions are messier than
receipts: emoji, hashtags, quantities in prose, three languages. Mitigation: a
fixture corpus of real captions including CJK ones, since decision 4's audience
is exactly who saves these.

**A saved recipe collection invites feature creep** → search, tags, folders,
sharing, meal planning. Each is reasonable and none is this change. Named so it
is a deliberate later decision rather than a drift.

**Ingredient resolution on prose is harder than on receipt lines** → "a good
glug of shaoxing" is not a line item. Mitigation: unresolved ingredients are
retained as text and the recipe stays usable, which is the same discipline
`add-dietary-profile` applies to an unresolvable rule.

## Migration Plan

One forward-only migration: `recipes`, `recipe_ingredients`, and the source
link. Additive. `DROP_ALL` gains both tables, and the delete-all path removes
stored recipe images alongside meal photos and receipt images.

Rollback drops the intake; nothing else depends on it.

## Open Questions

- **What each platform's share sheet actually delivers**, per platform and per
  OS. Task 1 measures it. Everything downstream is designed for the worst case,
  so the answer improves the feature rather than changing it.
- **Whether oEmbed is worth using for a title and thumbnail.** It is the one
  publicly documented endpoint intended for third-party display, so it is
  defensible — but it is a network request per link for cosmetics, and this
  change's whole posture is not contacting the platform. Left out; noted because
  it will be suggested.
- **Whether a saved recipe should feed the dinner decision.** A user's own
  recipes are strong candidates, and the suggestion engine currently generates
  from scratch. Genuinely promising, genuinely a separate change, and it would
  need care not to turn the suggestion screen into a recipe browser.
