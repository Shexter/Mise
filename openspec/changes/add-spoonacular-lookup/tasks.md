## 1. The gate

Nothing below this may start. Task 1 may end the change, and that is a
successful outcome.

- [ ] 1.1 Read `spoonacular.com/food-api/terms` **directly**. The language
      quoted in the proposal comes from secondary sources because the page
      returned 403 during planning. Confirm every clause against the original
      before treating any of it as fact.
- [ ] 1.2 Confirm the caching ceiling, whether written permission is required to
      cache at all, and what "derived, hashed, or transformed" is understood to
      cover.
- [ ] 1.3 Confirm the deletion obligation on ceasing use, and satisfy yourself
      that a browse-only surface storing nothing has no obligation to discharge.
- [ ] 1.4 Establish the required attribution form.
- [ ] 1.5 Establish whether the free tier supports a browse surface at all,
      given points are charged per request **plus** per result.
- [ ] 1.6 Ask Spoonacular directly for written confirmation that an
      online-only, in-memory, nothing-stored surface is permitted.
- [ ] 1.7 **Record the outcome as a decision in `docs/product-decisions.md`**,
      selecting one of the proposal's three outcomes. If the answer is "not
      workable", record why and stop — the comparison table names what the app
      does instead, and none of it is blocked by this.

## 2. Decide whether it is worth building

Separate from 1, because "permitted" and "worth it" are different questions and
conflating them is how a thin feature gets built on a technicality.

- [ ] 2.1 Weigh what it genuinely adds — breadth of recipe corpus — against
      `add-recipe-links`, where the user brings recipes and the app **can** keep
      them, and against the dinner decision, which already generates from stock.
- [ ] 2.2 Weigh the second-key cost. `keyStore.ts` holding exactly one
      credential is a non-negotiable convention, and a second slot with a
      lapsing monthly lifecycle changes the most carefully guarded module in the
      app for an optional feature.
- [ ] 2.3 Weigh a metered, online-only surface against decision 5's local-first
      promise, which every other feature keeps.
- [ ] 2.4 Record the answer either way. "We looked and decided not to" is worth
      as much as the reasoning for a taken path, per the ledger's own rule.

## 3. Structural enforcement, before any feature code

The no-persistence rule is the change. Build the thing that makes breaking it
impossible before building anything that could break it.

- [ ] 3.1 Put lookup result types in their own module, and **never import that
      module from `src/db/queries.ts`**. A type the persistence layer cannot
      name is a type it cannot write.
- [ ] 3.2 Add a test asserting `src/db/queries.ts` does not import the lookup
      types, so the boundary fails the build rather than eroding.
- [ ] 3.3 Add a test asserting no database write occurs across a full lookup
      session.
- [ ] 3.4 **Do not add a migration.** If this change needs one, the rule has
      been broken and the change is wrong.
- [ ] 3.5 Write the "do not do this" comment where the temptation lives — beside
      the nutrition result, pointing at the terms and at task 3.1. The next
      contributor sees a nutrition figure and a nutrition column and does not
      see the terms in the diff.

## 4. Session store

- [ ] 4.1 Implement `src/logic/lookupStore.ts`: an in-memory map with a TTL at
      or below the permitted window.
- [ ] 4.2 **In memory only.** A file on disk is storage, and a TTL over a file
      is a promise about deletion rather than a fact about it — a killed process
      leaves the file behind. This is the distinction the terms actually draw.
- [ ] 4.3 Discard on process exit, which falls out of 4.2.
- [ ] 4.4 Serve a repeat lookup within the window without a request.
- [ ] 4.5 Unit-test expiry, the repeat hit, and that nothing survives a restart.

## 5. Client

- [ ] 5.1 Implement `src/api/spoonacular.ts` with the same timeout and abort
      conventions as `src/api/gemini.ts`.
- [ ] 5.2 Throw `VisionError` kinds from `src/api/errors.ts` rather than
      inventing a second vocabulary. Quota exhaustion is `billing`; throttling
      is `rate_limited` — the taxonomy already distinguishes them, and decision
      178 is a fresh reminder of what happens when a kind is reached for
      loosely.
- [ ] 5.3 Parse defensively. A missing field is ordinary.
- [ ] 5.4 Unit-test parsing against recorded fixture responses.

## 6. Keys

- [ ] 6.1 Extend `src/api/keyStore.ts` to hold a second credential. **Introduce
      the plural shape deliberately** — it is the module the project guards most
      carefully, and it should not become plural as a side effect.
- [ ] 6.2 Keep the key out of the database, logs, and the export, as with the
      vision key.
- [ ] 6.3 **Ship no key.** Confirm no built artefact contains one.
- [ ] 6.4 Handle a lapsed subscription as an ordinary error, not a broken app.

## 7. Surface

- [ ] 7.1 Build the lookup surface: search by pantry contents, and read
      nutrition for a dish.
- [ ] 7.2 **Offer no action that saves anything.** No "add to pantry", no "log
      this meal", no "save recipe". This is both a terms requirement and the
      structural rule made visible.
- [ ] 7.3 Make provenance obvious wherever a result sits near the app's own
      data, so a result never reads as the catalogue.
- [ ] 7.4 Attribute per task 1.4.
- [ ] 7.5 Explain plainly what the surface is: a live lookup that keeps nothing,
      and needs a connection. An honest sentence prevents the support question.
- [ ] 7.6 Components from `src/components`, tokens from
      `src/constants/theme.ts`. No colour, font, or spacing literals.

## 8. Prove the app is unchanged without it

The requirement that matters most, because it is what keeps decision 5 true.

- [ ] 8.1 With no key configured, confirm every existing feature behaves
      identically.
- [ ] 8.2 With no connection, confirm the same.
- [ ] 8.3 Simulate a lapsed subscription and confirm no stored record is
      missing, broken, or in need of removal.
- [ ] 8.4 Inspect the database and confirm nothing in it originates from or
      refers to the service.
- [ ] 8.5 Run *Delete all data* and confirm there is nothing lookup-derived to
      remove.

## 9. Verification

- [ ] 9.1 Perform a real lookup with a real key and confirm results display.
- [ ] 9.2 Repeat it within the window and confirm no second request.
- [ ] 9.3 Restart the app and confirm nothing was retained.
- [ ] 9.4 Confirm no screen offers to save a result.
- [ ] 9.5 Exhaust the quota deliberately and confirm the error names billing
      rather than a generic failure.
- [ ] 9.6 Run `npm run typecheck` and `npm test`, then record the measured point
      cost per lookup in `docs/product-decisions.md` — it decides whether the
      free tier supports this at all.
