# Owner app-test checklist

Use this list on a device or standalone APK. Do not mark an OpenSpec task done
until you record the result in its change task file or `docs/product-decisions.md`.

## Before you start

1. Use a development build or standalone APK with the current branch.
2. Use a test profile and pantry. Do not use private health documents or keys in
   chat, commits, or screenshots shared outside your device.
3. For provider tests, add a funded key in Settings and use **Test key** first.
4. Record the device, OS, build commit, provider, and result for each failure.

## Premium interaction pass

Use this section for every UI-facing OpenSpec change. Record each failure or
uncertain result using the evidence format below before accepting the change.

- [ ] Save a photographed meal. Confirm the saved meal, refreshed Today totals,
      and any named pantry effect agree.
- [ ] Save a manual meal and a cooked suggestion. Confirm each success message
      names only a pantry effect that actually occurred.
- [ ] Confirm pantry-capture review and receipt review. Confirm the Pantry
      screen includes the saved records after the confirmation.
- [ ] Start a capture, cancel where cancellation is offered, and return to the
      originating screen. Confirm no meal or pantry record was written.
- [ ] Test an unusable photo, a missing key, no connection, a timeout, and a
      provider failure where available. Confirm each message names the current
      condition and offers only a working next step.
- [ ] Turn on Reduce Motion. Repeat save, busy, pending, error, and return
      paths. Confirm no motion delays the result or hides the completed state.
- [ ] Turn on VoiceOver or TalkBack. Confirm save, busy, pending, and error
      messages announce once and every offered action is reachable.
- [ ] Test on supported iOS and Android devices. Record differences in motion,
      announcement order, capture controls, or route return behavior.

## Unified capture

Prepare the fixture set before testing. Use your own, consented, or redacted
images and receipts. Do not commit source images, provider keys, or private
purchase details.

- [ ] Collect 20 fixtures. Include packaged goods with barcodes, receipts from
      several stores, one grocery item, several groceries together, an angled
      receipt, a fridge interior, and two non-food captures.
- [ ] Include at least three receipts that contain a barcode. These confirm a
      receipt barcode does not route to a product.
- [ ] For each fixture, record its actual kind, expected route, final route,
      provider and model, and a redacted provider response when one is used.
- [ ] Record accuracy separately for product barcodes, receipts, grocery items,
      unclear captures, and non-food captures in `docs/product-decisions.md`.

- [ ] Scan a real packaged product. Confirm it resolves with no model call.
- [ ] Photograph a receipt that contains a barcode. Confirm it opens receipt review.
- [ ] Photograph several groceries. Confirm each has a proposed location.
- [ ] Photograph a non-food item. Confirm the app reports it as unusable.
- [ ] Confirm one pantry-capture action reaches barcode, receipt, and grocery paths.
- [ ] Photograph a weekly receipt across three overlapping frames. Confirm one draft,
      no duplicate lines, and a balanced total.
- [ ] Turn on aeroplane mode. Capture a receipt. Restart. Restore the connection.
      Confirm review opens before any pantry item changes.
- [ ] Record routing accuracy by capture kind in `docs/product-decisions.md`.

## Macro-gap suggestions

- [ ] Add a real provider key. Tap a below-target protein, carbohydrate, and fat bar.
      Confirm each request opens a relevant suggestion surface.
- [ ] Test a pantry with known nutrition. Confirm the displayed contribution matches
      the measurable pantry data and is not health advice.
- [ ] Test a partial or unclosable gap. Confirm the wording says it is partial.
- [ ] Cook a suggestion. Confirm the target macro changes and pantry stock debits once.
- [ ] Cook a suggestion whose provider response omits a nutrition estimate. Confirm it still
      logs and debits pantry, its unresolved nutrients display as unavailable (not zero), and
      the corresponding macro bar cannot request a gap suggestion.
- [ ] Record provider answer quality and nutrition-coverage limits in
      `docs/product-decisions.md`.

## Suggestion templates

Offline verification (2026-08-10): policy, scorer, prompt, cache/migration,
and persistence tests run without a provider. They cover preference identity,
unknown-nutrition neutrality, quick selection, and migration cache disposal.
They do not establish provider response quality or device interaction.

- [ ] With a configured provider, open Tonight without changing any controls.
      Confirm the profile-informed recommendation loads with no extra setup.
- [ ] Open Tune dinner. Combine Protein-forward with Quick, then confirm the
      ideas and their factual time cues fit the selected context.
- [ ] Select Use it up. Confirm expiring-stock explanations remain visible and
      no suggestion bypasses the use-first rule.
- [ ] Select Lighter portions for an over-allowance dinner. Confirm it remains
      available with a visible portion suggestion rather than disappearing.
- [ ] Close and reopen the app. Confirm an explicit base intent and speed
      persist, then choose Use recommended and confirm the profile recommendation returns.
- [ ] Change the profile goal after saving a dinner preference. Confirm the
      saved preference stays active until reset and profile targets do not move.
- [ ] Open Make it to Sunday and a macro-gap flow. Confirm Tune dinner does not
      appear in either flow.
- [ ] Record distinct provider requests/cost for each tested intent-speed pair
      and any repetitive or misleading result in `docs/product-decisions.md`.

## Energy sources

- [ ] Complete regular onboarding. Confirm its target matches the previous route.
- [ ] Complete DEXA with a real scan sheet. Confirm the target changes as expected.
- [ ] Complete InBody with a real printout. Use the printed fat-free mass.
- [ ] Confirm neither scan route asks for sex, age, or height.
- [ ] Enter equivalent resting, total, and adjusted figures. Confirm distinct targets.
- [ ] Enter active energy as a daily total. Confirm the app asks for clarification.
- [ ] Change weight, activity, and goal. Confirm a stated target survives each edit.
- [ ] Switch InBody to DEXA and back. Confirm no recorded values disappear.
- [ ] Switch a scan user to estimation. Confirm the app asks only for estimation inputs.

## Meal editing and history

- [ ] Open a manual meal and a photographed meal from Today. Confirm each editor is populated.
- [ ] Edit fields near the bottom with the keyboard open. Confirm Save stays reachable.
- [ ] Edit calories and macros. Confirm row, calorie balance, and macro bars update.
- [ ] Change a home meal to Ate out and back. Confirm pantry state reverses and reapplies once.
- [ ] Edit a selected past day. Confirm Save returns to that same day.
- [ ] Start an edit, then cancel. Confirm discard keeps or removes the draft as selected.
- [ ] Log meals across two months. Reach each date from the calendar and week strip.
- [ ] Confirm unlogged days are not shown as zero calories or target misses.
- [ ] Confirm the calendar cannot select before the first meal or after today.
- [ ] Cross midnight while returning from a past day. Confirm Today advances correctly.

## Other accepted changes

- [ ] Open-data catalogue: upgrade an existing install with data. Confirm it opens and saved meals remain.
- [ ] Open-data catalogue: manually enter Olive oil at 100 g. Confirm nutrition is defensible.
- [ ] Venue inference: log restaurant, home-table takeaway, and manual meals. Confirm venue behavior is correct.
- [ ] Dinner suggestions: cook a provider suggestion. Confirm seasonings and pantry identity debit correctly.
- [ ] Dish scorer: generate with a real kitchen and provider key. Confirm the displayed three ideas are useful.
- [ ] Dietary profile: test a heavily restricted profile. Record whether the prompt remains usable.
- [ ] Day selection: on a standalone APK, background the app, cross midnight, and confirm Today updates.

## Future work, once implemented

- [ ] Fibre tracking: log a meal with a real key. Confirm fibre saves when known and remains unknown when absent.
- [ ] Fibre tracking: check old, mixed, and complete days. Confirm none display unknown fibre as zero.
- [ ] Barcode batch capture: scan one cached product, ten consecutive products, an unknown product, a variable-weight label, a multipack, and an Asian packaged item.

## Evidence format

For each failed or uncertain check, record:

- Change and task number
- Device and OS
- App build commit
- Provider and model, if used
- Steps taken
- Expected and actual result
- Screenshot or log reference, with secrets removed
