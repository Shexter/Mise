## Context

See `proposal.md` — Why, and its decision 68 on how a purchase meets existing
stock.

What already exists and is reused rather than rebuilt:

- `resolve(references, source, options)` in `src/logic/match.ts` — batch-first,
  banded, with alias write-back and review-queue degradation. Merged and tested.
- `src/logic/normalise.ts` — already strips size tokens, weight-priced tails,
  store-brand prefixes, and expands retailer abbreviations. Built for exactly
  this input.
- `src/logic/__fixtures__/receipt-lines.ts` — 74 fixture strings including
  `NON_FOOD_LINES`, authored while building the matcher.
- `src/media/photos.ts` — resize-and-compress into the document directory.
- `src/api/vision.ts` — provider facade, error taxonomy, key handling.

So this change is mostly plumbing between things that exist. The genuinely new
work is extraction, non-food classification, and reconciliation.

## Goals / Non-Goals

**Goals:**

- One photograph a week does what a forty-minute capture session was going to do.
- Every correction the user makes during review is worth something permanently.
- The pantry never silently accumulates phantom containers.

**Non-Goals:**

- Perfect extraction. Review is the feature, not a fallback.
- Spending surfaces. The data lands; the interface is later.
- Matching. Reusing `resolve()` unchanged is the point.

## Decisions

### Extraction and classification are one model call, not two

The extraction prompt returns, per line: printed text, price, quantity, and a
`kind` of `food | non_food | arithmetic | discount`. Header fields and a receipt
type come back alongside.

*Why:* the model is already reading every line to transcribe it, and deciding
"is this food" at that moment is nearly free. A second classification pass would
double cost and latency for a judgement the first pass is better positioned to
make — it can see that `BAGS 0.10` sits next to `SUBTOTAL`, context a
line-by-line classifier loses.

*Why classification cannot be left to the matcher:* an unmatched line and a
non-food line are indistinguishable by score — paper towels and an unknown
Filipino sauce both score near zero against every canonical. The spec requires
they be told apart, and only the extraction step has the context to do it.

### Two model calls per receipt, maximum

One to extract, one for whatever the local cascade could not resolve. The second
often does not happen at all once the alias table warms up, which is decision
27's compounding benefit arriving where it matters most.

### `resolve()` is called with `source: 'receipt'` and nothing else changes

References are the extracted line text; the source tag is already in
`ReferenceSource`.

*Why:* the cascade's behaviour must be identical whichever channel calls it,
which was the whole argument for a single entry point. A receipt-specific
matching path would drift from the meal-log path within two changes.

### Store identity is passed to normalisation, not baked into it

`normalise(text, { store })`, with the store's prefix list consulted first when
one is known. The existing `STORE_BRAND_PREFIXES` list stays as the fallback.

*Why:* stripping `TJ'S` from a Trader Joe's receipt is correct; stripping it
from a receipt that happens to contain a product called that is not. The
existing signature keeps working, so no caller moves.

### Extraction never writes; review commits

Extraction produces a draft receipt held in the database with status `pending`.
Accepting the review is what creates pantry items, in one transaction.

*Why:* the spec requires nothing be applied before review, and a long receipt is
exactly where partial application would be worst — twenty items created, then a
crash, then no way to tell what happened. It also makes "the user changed the
receipt type" a re-plan rather than an undo.

*Consequence worth stating:* `receipt_lines` therefore stores both what was
extracted and what the user made of it. That is the audit trail decision 21's
re-anchoring depends on, and it is why lines are a table rather than a JSON blob
on the receipt.

### Reconciliation is planned as data, then applied

`planReceiptApply(lines, catalogue): PantryChange[]` in `src/logic/receipt.ts`,
pure, mirroring the shape `add-stock-depletion` uses for `planDepletion`.

*Why:* the reconciliation rule from decision 68 has four branches per line
against existing stock, and testing it as a function from inputs to intended
changes is far cheaper than testing it through the database. Matching the
depletion planner's shape also means two changes share one mental model.

### One pending prompt per item, remembered

The "is the old one finished?" question sets a flag on the existing pantry item
so it is never asked twice, whatever later receipts do.

*Why:* the spec says asked once. Without persistence, every weekly shop asks
again about the same half-empty bottle, which is the nagging decision 14
explicitly rules out.

### Receipt images are stored like meal photos, and are deletable

Same document directory, same resize path, own subdirectory.

*Why:* consistency with the existing privacy story — nothing leaves the device
except the extraction call. Keeping the image allows re-extraction when the
prompt improves, which is worth more than the storage costs.

*Trade-off:* a receipt is more personally identifying than a plate of food —
it carries a store, a date, a payment method tail, and sometimes a name. It
inherits *Delete all data*, and the spec requires images go with it.

## Risks / Trade-offs

**Extraction quality varies by store, paper, and lighting** → thirty lines with
two wrong is a worse experience than one wrong meal estimate, because the user
must find the two. Mitigation: review is mandatory and designed for scanning —
resolved lines collapse, uncertain ones surface.

**Non-food classification will misfire both ways** → a misclassified food line
is silently lost, which is worse than a misclassified non-food line cluttering
review. Mitigation: bias the prompt toward calling ambiguous lines food, and
show excluded lines collapsed in review so a wrong exclusion is recoverable
rather than invisible.

**Reconciliation guesses wrong about replacement** → marking an item replaced
when the user still has it makes the catalogue lie. Mitigation: only status
`out` is automatic; `running_low` asks; `in_stock` never touches. The automatic
branch is the one where the app already believes there is nothing left.

**Prices without a spending surface may rot** → fields nobody reads drift into
being wrong. Mitigation: `add-stock-depletion` decision 35 consumes
`price_cents` for urgency weighting, so it has a reader before any chart exists.

**Receipt volume inflates pantry items** → a big shop creates twenty rows, and
decision 56 means no grouping at the data layer. Mitigation: display groups by
canonical, as `add-pantry-stock` already does.

## Migration Plan

One forward-only migration appended to `MIGRATIONS`, adding `receipts` (id,
type, store, purchased_at, total_cents, image_uri, status, created_at) and
`receipt_lines` (id, receipt_id, raw_text, kind, qty, unit, line_total_cents,
unit_price_cents, canonical_id, pantry_item_id, excluded, created_at), with
indexes on receipt id and purchase date.

`pantry_items` gains a nullable flag for the asked-once replacement prompt.

`DROP_ALL` gains both tables. Receipt images are removed alongside, as the spec
requires — deleting rows without deleting files would leave the most sensitive
artefact behind.

Rollback is additive.

## Open Questions

- **Whether to re-extract stored receipts when the prompt improves.** The image
  is kept so it is possible; whether it happens automatically, on request, or
  never is a later interface question that changes no schema.
- **How long pending offline receipts are retained before being dropped.** A
  cleanup policy over one table, addable later without changing an interface.
