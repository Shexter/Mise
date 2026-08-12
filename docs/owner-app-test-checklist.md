# Owner app-test checklist

Use this list on a device or standalone APK. Do not mark an OpenSpec task done
until you record the result in its change task file or `docs/product-decisions.md`.

## Before you start

1. Use a development build or standalone APK with the current branch.
2. Use a test profile and pantry. Do not use private health documents or keys in
   chat, commits, or screenshots shared outside your device.
3. For provider tests, add a funded key in Settings and use **Test key** first.
4. Record the device, OS, build commit, provider, and result for each failure.

## App icon PNG variants

- [ ] Install an iOS build using original `2.png` as `ios.icon.light`. Confirm
      it is recognisable at normal home-screen size and in Settings and search.
- [ ] Switch the iPhone to dark appearance. Confirm original `7.png`, the
      pure-dark variant, is selected and remains recognisable.
- [ ] Enable iOS tinted icons. Confirm the fallback remains legible; this
      release intentionally has no bespoke tinted asset.
- [ ] Install the Android build. Confirm original `1.png` is not clipped in
      both circular and squircle launchers, then test themed icons. Do not ship
      a monochrome override unless the rendered result remains a recognisable
      Mise bowl.

Apple acceptance could not run on this workstation on 2026-08-11: `simctl`
reported no available simulator devices, and no owner iPhone was connected.
The iOS Expo export succeeds, but that does not replace launcher and Settings
inspection on a simulator and physical device.

### Android emulator evidence — 2026-08-11

- Build: release APK from the working tree based on `25c8991`.
- Device: Pixel 10a emulator, Android 37.1.
- Default circular launcher: pass. Original `1.png` remains recognisable and
  the bowl is not visibly clipped.
- Minimal rounded-square launcher: pass after rebuilding without the legacy
  monochrome override. The full-colour bowl remains recognisable and unclipped.
- Android App Info: pass. The large Settings icon remains recognisable and
  preserves the selected artwork.
- Share sheet and notifications: not available in this build. Mise does not
  expose a share target and did not have an active notification icon surface.
- Minimal themed-icon style with the legacy monochrome override: fail. Android
  rendered an unrelated chevron-like glyph. The override was removed so Mise
  uses its full-colour fallback until a purpose-built monochrome icon is
  approved.
- Still required: repeat on an owner Android device and at least one additional
  OEM launcher because mask treatment varies by launcher.

## Observed Android UI defects — 2026-08-11

- [ ] **Keyboard-obscured input:** In Expo Go, opening the keyboard while adding
      a custom hidden ingredient can leave the active field behind the keyboard.
      The person cannot see or verify what they are typing. Code remediation now
      gives the shared sheet keyboard container full height and a safe-area
      offset; repeat this check before closing the defect.
- [ ] **Manual unit control wraps labels:** In the meal item editor, narrow
      unit buttons break labels such as `piece`, `cup`, `tbsp`, and `serving`
      into stacked letters rather than presenting a readable choice. Code
      remediation now uses three, three, and two options per row; repeat this
      check at normal and large text before closing the defect.
- [ ] **Long item-name position:** After editing a long photographed-meal item
      name, verify that the visible input text starts at the beginning of the
      value and does not remain horizontally offset or clipped.

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

### Today and nutrition-detail matrix

Run every row on a supported iOS device and a supported Android device. Repeat
the layout rows at the largest practical system text size. Use a day containing
both known and unknown nutrition so the incomplete state is exercised.

- [ ] Open Today. Confirm energy is the dominant value and protein,
      carbohydrate, fat, and fibre remain a compact summary rather than a
      dashboard. Charts, report tables, and chart controls must not appear here.
- [ ] Confirm each supported metric shows consumed and recorded target values,
      with progress understandable without colour. An incomplete metric must say
      it is incomplete and must not display the unknown contribution as zero.
- [ ] Activate each metric. Confirm Nutrition Analytics opens with the selected
      date and metric, known contributors are ordered by contribution, and the
      page explains that unknown contributors are excluded.
- [ ] Return from Nutrition Analytics. Confirm the previously selected Today
      date remains selected and primary meal actions have not moved or vanished.
- [ ] Inspect meals with complete and incomplete nutrition. Confirm Today shows
      only a defensible energy subtotal and meal detail labels unknown nutrient
      fields as unknown rather than zero.
- [ ] At large text and on the narrowest supported device, confirm the dominant
      energy figure, target summary, meal rows, and Analytics action remain
      readable without clipped values, horizontal scrolling, or unreachable
      controls.
- [ ] With VoiceOver or TalkBack, traverse the summary and one meal. Confirm
      metric names, known values, targets, completeness, and actions announce
      once in a useful order without relying on visual colour or motion.

### Nutrition Analytics chart and report matrix

Prepare history containing complete days, partially known days, a logged day
whose selected nutrient is unknown, days with no meals, and a target change
inside the period. Run the matrix in Organic, Utility, and Cool-Organic on both
supported platforms.

- [ ] Select energy, protein, carbohydrate, fat, and fibre in turn. Confirm the
      chart, report units, table, and contributor labels change together without
      making a provider or network request.
- [ ] Select 7-day, 30-day, 90-day, and custom ranges. Confirm endpoints and
      report periods are correct, custom dates remain editable, and changing a
      range does not modify meals or targets.
- [ ] Switch between daily and weekly grouping for each range where available.
      Confirm weekly buckets preserve incomplete coverage and do not turn absent
      or unknown days into known zeroes.
- [ ] Switch between bar and line forms. Confirm incomplete, unknown, and absent
      buckets remain distinguishable; a line must break rather than interpolate
      through unknown data.
- [ ] Use a period spanning changed daily targets. Confirm each date uses its
      recorded target and the report discloses mixed target context instead of
      repainting history with the current target.
- [ ] Use sparse history. Confirm the report labels data coverage, includes only
      defensible average/minimum/maximum values, and never presents a known
      subtotal as complete intake.
- [ ] Confirm the report states that it summarizes logged data and contains no
      nutrition score, good/bad grade, diagnosis, risk flag, clinical reference
      range, treatment recommendation, or clinician-authority claim.
- [ ] At large text in all three themes, confirm controls wrap or scroll without
      clipping, chart semantics remain legible without red/green judgment, and
      the ordered value table remains usable.
- [ ] With Reduce Motion enabled, repeat range, grouping, and chart-form changes.
      Confirm results update without a large transition or delayed usable state.
- [ ] With VoiceOver or TalkBack, read the chart equivalent and report table.
      Confirm dates, values, units, targets, and coverage are available in order
      and every configuration control exposes its selected state.

### Pantry Stock and Recipes matrix

Prepare one run with populated stock and saved recipes, one with each collection
empty, and one with a pending receipt or saved capture. Run in Organic, Utility,
and Cool-Organic on supported iOS and Android devices.

- [ ] Open Pantry. Confirm Stock is selected by default and only Stock contains
      pending-work banners, locations, camera capture, manual add, stock groups,
      and its stock empty state.
- [ ] Switch to Recipes. Confirm only saved recipes, recipe attribution/coverage,
      the recipe empty state, and the recipe add action appear. No recipe may be
      presented as stock and no stock control may be labelled as a recipe action.
- [ ] Switch Stock → Recipes → Stock with both collections populated. Confirm
      neither collection is reloaded destructively, rewritten, added to, or
      removed merely by switching.
- [ ] With pending receipt or capture work, switch to Recipes and back. Confirm
      pending work stays scoped to Stock and remains present when Stock returns.
- [ ] Open an existing recipe and add a recipe from the Recipes subsection.
      Confirm the existing detail/intake routes open and source attribution plus
      current pantry coverage remain available.
- [ ] Test empty Stock with populated Recipes, populated Stock with empty
      Recipes, and both empty. Confirm each subsection owns a truthful empty
      state and an action relevant only to that collection.
- [ ] At large text in all three themes, confirm the Stock / Recipes control,
      headings, rows, empty states, and actions remain readable and reachable
      without overlap or clipped labels.
- [ ] With VoiceOver or TalkBack, confirm Stock and Recipes expose selected state,
      switching moves to the correct collection, and hidden subsection actions
      are not reachable in the accessibility tree.

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

## Saved recipes

Use your own, consented, or redacted cooking posts and screenshots. Do not
commit captions, source images, or provider responses that identify a creator.

- [ ] Share a cooking post from YouTube, Instagram, and TikTok on both iOS and
      Android. Record whether Mise receives a URL, title, caption, image, or
      another payload for each case.
- [ ] Share a link with no useful caption. Confirm Mise saves the link and gives
      a clear path to add text or a screenshot later.
- [ ] Paste a caption with stated quantities. Confirm the saved ingredients keep
      the stated quantity and unit.
- [ ] Paste a caption containing "to taste" or "a splash." Confirm the saved
      ingredient has no quantity.
- [ ] Paste a caption that is mostly emoji or hashtags. Confirm Mise says no
      recipe was found and does not save invented ingredients.
- [ ] Add a screenshot containing ingredients. Confirm it uses the unified
      capture flow and does not create a second image pipeline.
- [ ] View a saved recipe against a real pantry. Add a missing ingredient, then
      reopen the recipe. Confirm coverage updates and unresolved ingredients
      never appear under "You have."
- [ ] Open the original source from the recipe detail screen. Confirm it opens
      only after you tap it.
- [ ] Cook a saved recipe containing one stated and one unstated amount. Confirm
      the meal is logged at home and only the stated amount changes pantry stock.
- [ ] Delete all data. Confirm recipes and locally stored recipe screenshots are removed.

## Other accepted changes

- [ ] Open-data catalogue: upgrade an existing install with data. Confirm it opens and saved meals remain.
- [ ] Open-data catalogue: manually enter Olive oil at 100 g. Confirm nutrition is defensible.
- [ ] Venue inference: log restaurant, home-table takeaway, and manual meals. Confirm venue behavior is correct.
- [ ] Dinner suggestions: cook a provider suggestion. Confirm seasonings and pantry identity debit correctly.
- [ ] Dish scorer: generate with a real kitchen and provider key. Confirm the displayed three ideas are useful.
- [ ] Dietary profile: test a heavily restricted profile. Record whether the prompt remains usable.
- [ ] Day selection: on a standalone APK, background the app, cross midnight, and confirm Today updates.

## Future work, once implemented

- [ ] Shopping list: open Pantry and confirm Stock, Recipes, and Shop are
      separate, with Stock selected by default and no shopping card on Today.
- [ ] Shopping list: populate low/out pantry fixtures and a saved recipe.
      Confirm Shop deduplicates canonical entries and shows source explanations.
- [ ] Shopping list: add an unresolved manual item, restart offline, and
      confirm it remains editable locally.
- [ ] Shopping list: confirm a reviewed grocery receipt exact-matches a list
      item, then undo the list match without changing receipt or pantry state.
- [ ] Shopping list: check themes, large text, reduced motion, and
      VoiceOver/TalkBack labels for Shop, sections, check-off, and undo.
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
