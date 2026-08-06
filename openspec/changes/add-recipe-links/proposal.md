## Why

People already collect recipes as videos. A saved TikTok, an Instagram reel, a
YouTube video — that is where cooking ideas actually live for most of the
audience this app is for, and the app has no way to receive one.

The value is not storage. It is that a recipe **states its own ingredients**,
which decision 61 established is a higher-quality path into depletion than the
camera will ever be. Two tablespoons of gochujang is a fact, not an estimate.
`add-dinner-decision` built that path for generated suggestions; the same
machinery works for a recipe the user found themselves, and a recipe someone
chose is one they are far likelier to actually cook.

It also answers a question the app currently cannot: *do I have what this needs?*
Seven of nine ingredients, and the two missing are the shopping list.

## The constraint that determines the whole design

Instagram and TikTok prohibit scraping in their terms. YouTube's API Services
terms bind anything using its API. Downloading video is off the table on all
three, and platform APIs mean OAuth, keys, review processes, and three
integrations that break independently.

None of that is compatible with a local-first app with no server and no accounts.

So **the app never contacts the platform.** It receives what the user hands it:

- **The share sheet.** Sharing a post to the app delivers the URL and, on both
  platforms, usually the caption or title text alongside it. Recipe videos put
  the ingredient list in the caption remarkably often.
- **Pasted text.** The user copies the caption. One action, no integration.
- **A screenshot.** On-screen ingredient lists are the norm in cooking videos,
  and `add-unified-capture` already turns an image into structured content.

This is not a workaround. It is a better design than the API route on every axis
that matters here: no keys, no OAuth, no per-platform breakage, no terms to
comply with, works on platforms that do not exist yet, and nothing about the
user's viewing habits leaves the device.

## What Changes

- **A recipe can be added from a shared link, pasted text, or a screenshot.**
  One intake, three sources, no choice of method demanded of the user.
- **The model extracts a structured recipe** — ingredients with quantities, and
  steps — from whatever text or image arrived. Same shape as receipt extraction,
  through the existing provider facade.
- **Ingredients resolve to canonicals** through the existing matcher, so a saved
  recipe knows what it means.
- **Stock coverage is shown**: what you have, what you are missing.
- **Cooking it logs a meal and runs depletion against stated quantities**,
  reusing `add-dinner-decision`'s path exactly.
- **The source link is kept and always shown.** The creator gets the credit and
  the traffic.
- **Saved recipes are the user's own collection**, not a library the app curates.

## Capabilities

### New Capabilities

- `recipe-links`: Saving a recipe the user found elsewhere. Covers intake from
  a link, text, or image without contacting the platform; extraction into a
  structured recipe; ingredient resolution and stock coverage; cooking it into a
  logged meal and a depletion; attribution and what the app stores.

### Modified Capabilities

None. `openspec/specs/` is empty — nothing has been archived yet. Cooking a
saved recipe reuses the suggestion-cooking path rather than adding one.

## Non-goals

- **Contacting any platform.** No scraping, no API integration, no OAuth, no
  video download, no transcription. See above.
- **A recipe library, or discovery.** Decision 33 stands: the app does not
  browse, recommend, or supply recipes. It holds the ones the user brought.
- **Republishing.** Nothing a user saves is shared, synced, or aggregated.
  Decision 5 makes that easy — there is nowhere to send it.
- **Verifying a recipe.** If the caption is wrong, the saved recipe is wrong.
  The app is a filing cabinet with a matcher, not a test kitchen.
- **Auto-importing from a feed or a saved-posts folder.** That would need the
  platform integration this change exists to avoid, and would mean the app
  watching what the user watches.
- **Nutrition for a saved recipe beyond what cooking it produces.** Logging the
  cooked meal goes through the existing estimator.

## Impact

**Schema.** One migration: recipes, recipe ingredients, and the source link.

**Code.**
- `src/api/recipePrompt.ts` and `src/api/recipe.ts` — extraction, following
  `receiptPrompt.ts` and `receipt.ts`.
- `src/logic/recipe.ts` — pure: coverage against stock, and the cook plan.
- `src/db/queries.ts` — recipe CRUD.
- Share-target registration in the Expo config, and an intake screen.
- The cook path — reuses `suggestionService`'s meal construction.

**Dependencies.** None beyond what Expo already provides for share intents.

**Depends on** `add-identity-layer` (merged) and `add-dinner-decision` (merged,
for the cook-into-a-meal path). **Interacts with** `add-unified-capture` for the
screenshot route.

## What is stored, and why the line is where it is

An ingredient list is a list of facts. A method is someone's writing.

The app stores the ingredients and quantities because that is what it operates
on — resolution, coverage, depletion. It stores the source link always, and
shows it wherever the recipe appears, because the creator made the thing.

Method steps are stored only as the user received them and only for their own
use, never presented as the app's own content and never leaving the device.
That is comfortable for a local-first app with no sharing surface, and it is
worth writing down because the moment anything gains a share button the question
changes.

The practical rule: **the app is never the place someone would go instead of the
video.** It links back, every time.
