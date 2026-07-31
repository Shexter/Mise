# The dinner decision

Not a recipe browser. A recipe browser answers "what could I make", which is a
question the user can already ask any chatbot for free, and the answers go
generic by the fourth day. This answers **"what should I cook tonight"**, and it
can only be answered well by something that knows four things at once:

1. what is in the kitchen,
2. what is about to die,
3. what this person actually eats,
4. how many calories they have left today.

Nothing else has all four. That intersection is the whole feature.

---

## Ordering by expiry, and why sorting is not enough

The instinct is right — suggestions should clear the oldest stock first. But a
sorted list is a weak signal to a language model. Models do not reliably treat
list position as priority, and a 120-item sorted list buries the urgent items in
the middle of a wall of text.

Bucket and label instead, and make the constraint explicit:

| Bucket | Contents | Instruction to the model |
| --- | --- | --- |
| `use_first` | expires within 3 days | **every suggestion must use at least one** |
| `use_soon` | expires in 4–10 days | prefer these where they fit |
| `available` | everything else | free to use, no urgency |
| `staples` | rice, pasta, flour, oil | assume present, do not list individually |
| `seasonings` | the spice and sauce shelf | one summary line, not 40 entries |

The hard constraint on `use_first` is what actually produces the behaviour you
want. Sorting hopes for it; a stated rule gets it.

---

## Urgency is not just a date

Two items expiring on the same day are not equally urgent.

**Value at risk.** 300 g of pork belly and half a cucumber both expire Thursday.
One of those is $8 and the other is 40 cents. Receipts give us `price_cents` on
the pantry item, so urgency should weight by what is actually about to be
thrown away. It also unlocks the strongest possible reason chip: *"saves $8 of
stock"* beats *"expires soon"* by a wide margin.

**Recoverability.** Some things can be rescued without cooking. If an item is
freezable and the freezer has room, "freeze it" is often a better answer than a
recipe — nobody wants to be told to cook a braise on a Tuesday they had no
intention of cooking. Offering the freeze action pushes `expires_at` out by the
freezer shelf life from the same table that predicted the original date, and it
costs the user one tap.

So urgency is roughly:

```
urgency = f(days_remaining) × value_at_risk × (freezable ? 0.5 : 1)
```

The freeze discount matters: a freezable item is not really at risk yet, so it
should not crowd out a genuinely perishable one.

---

## Shaping the payload

Do not send the whole pantry. A full catalogue is expensive, and it dilutes the
model's attention across 40 spices that were never the point.

Send in full: everything in `use_first` and `use_soon`, plus proteins and
produce. Compress the rest: staples as a short list, seasonings as a single
descriptive line — *"well stocked on Asian seasonings: light and dark soy, fish
sauce, gochujang, doubanjiang, sesame oil, Shaoxing wine, mirin"*. The model
needs to know it can lean on them, not that there are exactly 340 g left.

---

## Personalisation, from data already collected

`meals` and `meal_items` hold real history. Four signals worth deriving:

- **Cuisine lean** over the last 60 days. Somebody who cooks Asian food four
  nights a week should not be shown a pot roast.
- **Repeat dishes.** People like their staples. A suggestion someone already
  makes often is a *good* suggestion, not a lazy one.
- **Recently eaten**, last 7 days. Suppress. Chicken four nights running is how
  a suggestion engine loses trust.
- **Novelty balance.** Two familiar, one stretch. All-novel gets ignored,
  all-familiar gets boring. This ratio is the difference between the feature
  feeling personal and feeling random.

---

## Calories as context, never as a filter

Passing "you have 780 kcal left" is useful. Filtering to dishes under 780 kcal
is not — if it is 7pm and they have 400 left, a hard filter returns sad food and
the user closes the app.

Pass remaining calories and the macro gap as context, let the model answer
freely, and show the fit as a chip: *"620 kcal — fits your remaining 780"*.
Where a dish overshoots, offer the portion instead of hiding the dish.

The macro gap is the better signal anyway. *"You are 40 g short on protein
today"* produces a more useful suggestion than a calorie ceiling, and the
profile already carries protein, carb, and fat targets.

---

## Output contract

Raw JSON, following the discipline already set in `src/api/prompt.ts`.

```json
{
  "suggestions": [
    {
      "dish": "Gochujang pork belly stir-fry",
      "reason_tags": ["clears pork belly (2 days)", "saves $8", "fits 780 kcal"],
      "kcal_per_serving": 620,
      "servings": 2,
      "effort_minutes": 25,
      "uses": [
        { "canonical_id": "pork-belly", "qty": 300, "unit": "g" },
        { "canonical_id": "gochujang", "qty": 2, "unit": "tbsp" }
      ],
      "missing": [{ "canonical_id": "spring-onion", "note": "optional garnish" }],
      "method": ["Slice the pork belly thin.", "..."]
    }
  ]
}
```

Three fields carry more weight than they look:

- **`uses` with canonical ids** is what makes this more than a chat reply. Tap
  "I cooked this" and it pre-fills the meal log, logs the calories, and runs the
  pantry decrement. That single field is what closes the loop back to SnapCal.
- **`missing`** should be allowed, not forbidden. A dish needing one spring
  onion is more useful than a perfect-match dish nobody wants, as long as the
  gap is shown honestly — and it feeds the shopping list.
- **`effort_minutes`** because a tired Tuesday and a free Sunday are different
  questions. Worth a quick/proper toggle on the screen.

---

## Reason chips

Every suggestion carries at least one, and they are what make the screen feel
intelligent rather than random. The user should never wonder why a dish is
there.

Ranked by how convincing they are:

1. `saves $8 of stock`
2. `clears the pork belly (2 days)`
3. `you make this a lot`
4. `fits your remaining 780 kcal`
5. `you are 40 g short on protein`

---

## Make it to Sunday

The same engine with a different objective, and worth building because it
answers a feeling people actually have — half-empty fridge, payday is Sunday,
and the alternative is ordering out.

Same payload, different instruction: produce a plan of N dinners that requires
no shopping, reusing overlapping ingredients so nothing is stranded. Output
becomes a small plan rather than three independent dishes, plus the honest gap:
*"this covers Thursday to Saturday; Sunday needs one protein."*

This is likely a stronger retention hook than the pantry list itself. A pantry
list is a reference you consult. This is a recurring weekly problem you need
help with.

---

## Cost and caching

Do not regenerate on every screen open, or a habit of opening the tab becomes a
habit of spending money.

Generate once per day, cache the result, and invalidate on: a material pantry
change (an item consumed, added, or crossing into `use_first`), a logged meal,
or an explicit refresh pull. A "give me different ones" button should exist and
should be the only path that spends a call on demand.

---

## What to be careful about

These are idea generators, not tested recipes. Present them as such. Quantities
and technique will sometimes be wrong, and the fix is framing rather than
engineering — the user is a cook being given a starting point, not a novice
following a validated procedure.
