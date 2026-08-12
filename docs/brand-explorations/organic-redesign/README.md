# Organic redesign exploration

This directory preserves the useful, non-duplicated source from
`Mise app redesign and logo.zip`, supplied by the owner on 11 August 2026.
It is a brand exploration and interactive visual reference, not an
implementation snapshot or a source of product behavior.

## Included

- `Mise.dc.html` — clickable app-flow prototype styled with the Organic system.
- `Mise Logo.dc.html` — logo, wordmark, positioning, trust-message, store-copy,
  loading-indicator, and illustration explorations.
- `support.js` and `_ds/` — the local runtime, tokens, manifest, and written
  guidance needed to inspect the two design documents.
- `ios-icon-60px-review.png` and `icon-launcher-review.png` — generated review
  evidence for the selected untouched PNGs at small size and Android masks.

Open either HTML file from this directory to inspect the source. The prototype
imports Google Fonts when a network connection is available and falls back to
system fonts otherwise.

## Reused instead of duplicated

The ZIP's three `brand/` PNGs are byte-for-byte identical to files already in
`assets/brand/icon-concepts/`:

| ZIP file | Repository authority |
| --- | --- |
| `mise-icon-light-organic-sage-orange.png` | `assets/brand/icon-concepts/light-organic/mise-icon-light-organic-sage-orange.png` |
| `mise-icon-dark-glass-navy-sage.png` | `assets/brand/icon-concepts/dark-glass/mise-icon-dark-glass-navy-sage.png` |
| `mise-icon-dark-glass-monochrome.png` | `assets/brand/icon-concepts/dark-glass/mise-icon-dark-glass-monochrome.png` |

The checked-in logo document points at those repository assets. Duplicate
`uploads/` images, the generated thumbnail, and the ZIP's stale `github.md`
snapshot were intentionally omitted.

## Authority boundary

Use this material for visual direction, copy exploration, and comparison. For
app behavior and information architecture, authority remains:

1. `docs/product-decisions.md` and accepted OpenSpec requirements;
2. the current React Native app and shared components;
3. this exploration.

This matters because the prototype predates newer provider, recipe, capture,
and onboarding work. Do not copy its Anthropic-only setup, screen map, state,
or calculations into production.
