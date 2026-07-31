# The identity layer

Everything in Mise sits on one question: **is this the same thing as that?**

Four channels produce references to food, and they have to converge on one row:

| Channel | Produces | Example |
| --- | --- | --- |
| Pantry capture (vision) | A description, sometimes a brand | `Kikkoman soy sauce, 500ml bottle` |
| Barcode | A GTIN, then a catalogue record | `0041390000010` |
| Receipt | An abbreviated, store-specific string | `KIKKO SOY 500ML` |
| Meal log (existing SnapCal) | A generic ingredient name | `soy sauce` |

If these four do not converge, depletion is wrong, expiry warnings fire on
phantom stock, and the dinner decision suggests dishes the user cannot cook.
Nothing above this layer can be more correct than this layer is.

---

## Three levels

The common mistake is a single `items` table. There are three distinct things,
and each channel enters at a different level.

### Product

A specific SKU. Kikkoman Naturally Brewed Soy Sauce, 500 ml, GTIN
`0041390000010`. Carries brand, package size, barcode, and per-100 nutrition.

Sourced from Open Food Facts, from a receipt, or from the user. Optional —
loose ginger from a market stall has no product, and that is a normal case, not
an edge case.

### Canonical ingredient

The food concept: `soy-sauce-light`. This is what recipes reason about, what
meal logs match to, and what shelf-life and depletion rules key off. Many
products map to one canonical.

### Pantry item

The physical thing in this kitchen. Opened on 3 June, pantry shelf, roughly
half full, cost $4.99. Always has a canonical, optionally has a product.

Two half-used bottles of soy sauce are two pantry items, one product, one
canonical — and a decrement should hit the opened one.

### Who reads what

- Barcode and receipt resolve to **product**, then to canonical.
- Meal log and vision resolve straight to **canonical**. The estimator will
  never say "Kikkoman".
- Depletion writes to the **pantry item**.
- The dinner decision reasons over **canonicals**.

---

## Schema

Appended as a forward-only migration, per `src/db/schema.ts`. Dates are ISO
strings, ids are text, in keeping with the existing tables.

```sql
CREATE TABLE canonical_items (
  id                  TEXT PRIMARY KEY,          -- slug: 'soy-sauce-light'
  display_name        TEXT NOT NULL,
  class               TEXT NOT NULL,             -- staple|produce|protein|dairy|seasoning|condiment|frozen|beverage
  default_location    TEXT NOT NULL,             -- pantry|fridge|freezer|counter
  shelf_life_days     TEXT NOT NULL,             -- JSON per location: {"pantry":730,"fridge":1095}
  open_life_days      INTEGER,                   -- days after opening; NULL where not applicable
  typical_use_qty     REAL,                      -- the "vibes" amount for one use
  typical_use_unit    TEXT,
  typical_pkg_qty     REAL,                      -- for uses-remaining math
  typical_pkg_unit    TEXT,
  density_g_per_ml    REAL,                      -- unit reconciliation
  is_seed             INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL
);

CREATE TABLE item_aliases (
  id               TEXT PRIMARY KEY,
  alias_norm       TEXT NOT NULL,                -- normalised form, the lookup key
  alias_raw        TEXT NOT NULL,                -- what we actually saw
  canonical_id     TEXT NOT NULL REFERENCES canonical_items(id) ON DELETE CASCADE,
  source           TEXT NOT NULL,                -- seed|barcode|receipt|vision|meal_log|user
  locale           TEXT,                         -- 'ja', 'ko', 'zh-Hans', 'id'
  confidence       REAL NOT NULL DEFAULT 1,
  times_confirmed  INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL
);

CREATE INDEX idx_aliases_norm ON item_aliases(alias_norm);
CREATE UNIQUE INDEX idx_aliases_pair ON item_aliases(alias_norm, canonical_id);

CREATE TABLE products (
  id            TEXT PRIMARY KEY,
  gtin          TEXT UNIQUE,
  brand         TEXT,
  name          TEXT NOT NULL,
  pkg_qty       REAL,
  pkg_unit      TEXT,
  canonical_id  TEXT NOT NULL REFERENCES canonical_items(id),
  kcal_per_100  REAL,
  protein_per_100 REAL,
  carbs_per_100 REAL,
  fat_per_100   REAL,
  source        TEXT NOT NULL,                   -- off|vision|receipt|user
  fetched_at    TEXT
);

CREATE INDEX idx_products_gtin ON products(gtin);

CREATE TABLE pantry_items (
  id            TEXT PRIMARY KEY,
  canonical_id  TEXT NOT NULL REFERENCES canonical_items(id),
  product_id    TEXT REFERENCES products(id),
  location      TEXT NOT NULL,
  qty_remaining REAL,                            -- staples: mass or volume
  qty_unit      TEXT,
  fullness      TEXT,                            -- full|half|low|out — seasonings and condiments
  uses_count    INTEGER NOT NULL DEFAULT 0,
  purchased_at  TEXT,
  opened_at     TEXT,
  expires_at    TEXT,
  expiry_source TEXT,                            -- predicted|label|user
  price_cents   INTEGER,
  photo_uri     TEXT,
  status        TEXT NOT NULL DEFAULT 'in_stock',-- in_stock|running_low|out|discarded
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE INDEX idx_pantry_status    ON pantry_items(status);
CREATE INDEX idx_pantry_expires   ON pantry_items(expires_at);
CREATE INDEX idx_pantry_canonical ON pantry_items(canonical_id);

-- Audit log. Makes every decrement explainable and reversible, and is the
-- source for "used in 23 meals since you opened it".
CREATE TABLE consumption_events (
  id             TEXT PRIMARY KEY,
  pantry_item_id TEXT REFERENCES pantry_items(id) ON DELETE SET NULL,
  canonical_id   TEXT NOT NULL,
  meal_id        TEXT REFERENCES meals(id) ON DELETE CASCADE,
  qty            REAL,
  unit           TEXT,
  servings_mult  REAL NOT NULL DEFAULT 1,        -- the "how many servings did this make" tap
  kind           TEXT NOT NULL,                  -- meal_item|hidden_ingredient|manual|correction
  created_at     TEXT NOT NULL
);

-- Unresolved references, drained at the user's leisure. Never blocks a scan.
CREATE TABLE match_queue (
  id            TEXT PRIMARY KEY,
  raw_text      TEXT NOT NULL,
  source        TEXT NOT NULL,
  context       TEXT,                            -- JSON: receipt id, price, quantity
  suggested_id  TEXT REFERENCES canonical_items(id),
  confidence    REAL,
  created_at    TEXT NOT NULL
);
```

`consumption_events` is not optional bookkeeping. Without it a wrong match is
unrecoverable, and "used in 23 meals" has nowhere to come from.

---

## Normalisation

Runs before every lookup. Receipt matching lives or dies here.

1. Lower-case; strip punctuation; collapse whitespace.
2. Strip size tokens: `\b\d+(\.\d+)?\s*(ml|l|g|kg|oz|lb|ct|pk|pc)\b`.
3. Strip weight-priced tails: `@ 2.99/LB`, `0.62 LB @`.
4. Strip store-brand prefixes: `GV`, `TJ'S`, `KRO`, `365`, `SIG`, `EQ`.
5. Expand abbreviations from a dictionary — `grn`→green, `bnch`→bunch,
   `chkn`→chicken, `bnls`→boneless, `org`→organic, `frz`→frozen, `slcd`→sliced,
   `swt`→sweet, `shrmp`→shrimp.
6. Leave CJK text in script. Do not romanise. Store in-script aliases directly:
   醬油, 간장, kecap asin, and toyo all point at `soy-sauce-light`.

Rule 6 is the one that makes the Asian-pantry angle work, and it is the reason
the alias table carries a `locale`.

---

## The cascade

Cheapest and most certain first. Steps 1 to 3 are local SQLite and work
offline; only 4 and 5 need the network.

| Step | Method | Confidence | Cost |
| --- | --- | --- | --- |
| 1 | Barcode exact → product → canonical | 1.00 | free, cached |
| 2 | Normalised exact alias | 0.95 | free |
| 3 | Fuzzy alias (trigram / edit distance) | 0.60–0.90 | free |
| 4 | LLM resolution, batched | varies | one call per receipt |
| 5 | Propose new canonical | varies | one call |

Bands for step 3: above 0.85 accept silently, 0.60 to 0.85 accept but flag for
one-tap confirmation, below 0.60 fall through to step 4.

**Every resolution at steps 3 to 5 writes an alias back.** `KIKKO SOY 500ML`
costs one model call once and is free forever after. The alias table is the
asset that makes month six feel better than month one, and it is why seeding it
generously at build time matters.

### Step 4: the resolution call

Batch one call per receipt or per capture session, never per line. Give the
model:

- the unresolved raw strings,
- the top ~20 fuzzy candidates per string,
- **the canonicals already in this user's pantry**,
- the requested output: a canonical id, or `new` plus a proposed record.

The pantry list is not decoration. It is the prior that resolves `KIKKO SOY`
for someone who has bought Kikkoman before, and it is what keeps the model from
inventing a second soy sauce.

---

## Disambiguation

A meal log says `soy sauce`. The pantry holds light soy, dark soy, and tamari.

Rank and pick silently: in stock, then already opened, then most frequently
used. Do not ask at meal-log time — that is friction on the wrong screen, and
all three roll up to the same advice, "you are low on soy sauce". Drift is
corrected by the fullness check.

They stay distinct canonicals regardless, because recipes need the difference:
dark soy is for colour, light soy is for salt.

The general rule: **ambiguity resolves toward what the user already owns.**

---

## Guarding against duplicates

Three rows reading `Soy sauce`, `Soy Sauce (Kikkoman)`, and `Light soy sauce`
is the failure that ends the app. Stock is wrong, the dinner decision is wrong,
and the list stops being believed.

- Canonical creation is gated behind a dedupe check — fuzzy match against every
  existing canonical, and the model is shown neighbours before it may propose a
  new one.
- **Merge ships in v1**, not later. Pick two rows, merge, aliases and pantry
  items repoint, `consumption_events` follow. This will be needed in week one.
- The UI shows canonical display names only. Raw receipt strings never surface.

---

## Seed data

A build-time asset, and part of the product's edge:

- ~300 canonical items covering Western staples and a deliberately deep Asian
  set — light and dark soy, oyster sauce, fish sauce, doubanjiang, gochujang,
  gochugaru, kecap manis, belacan, Shaoxing wine, mirin, miso, sesame oil, XO
  sauce, tamarind, pandan, curry leaf.
- ~2,000 aliases, including in-script names and common receipt abbreviations.
- Shelf-life and typical-use figures per canonical.

`assets/hidden-ingredients.json` is the prototype for this. It already carries
`defaultQuantity` and `unit` per entry, which is exactly the typical-use figure
the seasoning depletion model needs — it is currently wired only to calories.
Widening that file and pointing it at both consumers is the first concrete step.

---

## Build order

1. `canonical_items` and `item_aliases`, with seed data and the normaliser.
2. The cascade, steps 1 to 3 only. Local, offline, no model calls.
3. `pantry_items` plus manual add, so the catalogue is usable on its own.
4. Steps 4 and 5, the model-backed resolution and new-canonical proposal.
5. `consumption_events` and the meal-log decrement.
6. `match_queue` and the review screen.
7. Merge.

Steps 1 to 3 are testable with no network and no API key, which keeps the
hardest part of the system honest before anything is layered on top.
