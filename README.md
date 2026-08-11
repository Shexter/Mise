# Mise

A local-first food app for the home. It tracks what is in your pantry, what is
about to go off, what you spend on groceries, and what you eat — on one device,
with no account and no server.

The name is from *mise en place*: everything in its place.

> **Status: active development.** Meal logging, pantry tracking, receipts,
> photo capture, barcode lookup, and dinner suggestions are implemented.
> OpenSpec tracks the remaining work and device checks in `openspec/changes/`.

---

## The idea

Every pantry app dies the same way. Adding stock is easy — scan a receipt, take
a photo — but *removing* it is not. You buy soy sauce once and use it forty
times over eight months. No app knows you used two tablespoons on Tuesday, so
the inventory drifts out of sync within a fortnight and people stop opening it.

Mise is built on a calorie tracker, which changes the arithmetic. The user
already photographs what they eat, for a reason they care about. That log is
also a record of what left the pantry. The depletion signal comes for free from
a feature people already use.

From there:

- **Predicted expiry** from purchase date, food class, and storage location —
  the same chicken is two days in the fridge and six months in the freezer.
- **Receipts as ground truth.** Meal-log estimates drift; the next receipt for
  rice resets the count to a known quantity. Receipts set truth, meal logs
  interpolate between them.
- **A dinner decision**, not a recipe browser. Three suggestions that clear what
  is about to expire, fit the calories left in the day, and look like food you
  actually cook.
- **Deep Asian pantry coverage.** Doubanjiang, gochujang, belacan, kecap manis,
  Shaoxing wine — invisible to every Western food database, and the thing this
  app is meant to be good at. Aliases are stored in script, never romanised.

Two rules constrain everything. Nothing is shown that the app cannot defend —
"running low", never "486 g of rice left". And no data leaves the device except
the image estimate, sent to the provider under the user's own key.

---

## Documentation

| Document | What it covers |
| --- | --- |
| [`docs/product-decisions.md`](docs/product-decisions.md) | The numbered decision ledger. Start here — it is the source of truth for what is settled and why. |
| [`docs/identity-layer.md`](docs/identity-layer.md) | How food references from vision, barcode, receipt, and meal log resolve onto one row. Everything else sits on it. |
| [`docs/dinner-decision.md`](docs/dinner-decision.md) | The suggestion engine. |
| [`docs/premium-experience-playbook.md`](docs/premium-experience-playbook.md) | Product-quality rules for polished, truthful, accessible UI work. |

Planned work lives in `openspec/changes/`, managed with
[OpenSpec](https://github.com/Fission-AI/OpenSpec):

```bash
openspec list                     # queued changes
openspec show add-identity-layer  # proposal, specs, design, tasks
```

---

## Running it

Requirements: **Node 22.5+** and the **Expo Go** app, or a built APK. The
version floor is the test suite, not the app: `test/stubs/db.ts` runs the real
SQL against `node:sqlite`, a built-in that does not exist before 22.5.

```bash
npm install
npm start
```

Scan the QR with Expo Go (Android) or the Camera app (iOS). This targets **Expo
SDK 54** — if Expo Go reports the project needs a newer version, update the app.

### A standalone Android APK

No PC server, no Metro:

```bash
npm i -g eas-cli && eas login
eas build -p android --profile preview
```

That returns a download URL for a sideloadable `.apk`. The `preview` profile
sets `buildType: apk` deliberately, because EAS defaults to an app-bundle, which
cannot be sideloaded.

EAS builds in the cloud and does not read your local `.env`. To bake a key into
a personal build, add it to the profile's `env` or use `eas secret:create` — and
do not share that build, because anyone holding it can read the key.

---

## API key and providers

The app needs a vision API key for image-based features. It detects the provider
from the key's shape.

| Provider | Cost | Get a key |
| --- | --- | --- |
| **Google Gemini** | Free tier, no card | https://aistudio.google.com/apikey |
| **Anthropic Claude** | Paid, needs API credits | https://console.anthropic.com/settings/keys |
| **OpenAI-compatible** | Depends on provider | Your provider's API-key page |

For OpenAI keys, use the standard endpoint or enter an OpenAI-compatible
endpoint in **Settings → API key**. Mise stores the endpoint locally and sends
requests to it without validating it first.

Paste the key during onboarding or in **Settings → API key**, where there is a
**Test key** button. It is stored in the device keychain through
`expo-secure-store` and is never written to the database, the logs, or the
export. You can skip it and use the app as a manual diary.

For development, `cp .env.example .env` and paste a key there to avoid retyping
it on every fresh install. A key in `.env` is compiled into the bundle, so leave
it unset when publishing.

> A Claude.ai or ChatGPT subscription does **not** include API access. They are
> billed separately, and neither provider offers a sign-in that lets a
> third-party app spend a consumer subscription's quota.

---

## Scripts

```bash
npm start        # Expo dev server
npm run android  # open on Android
npm run ios      # open on iOS (macOS only)
npm run web      # browser preview (design only)
npm run typecheck
npm run doctor
```

---

## Layout

```
app/          Screens (expo-router)
src/api/      vision facade, provider transports, prompts, parsing, key storage
src/db/       schema.ts, index.ts, queries.ts — all SQL lives here
src/logic/    nutrition, energy, pantry, receipt, capture, barcode, and venue rules
src/store/    Zustand stores
src/components, src/constants/theme.ts
docs/         Product decisions and design
openspec/     Change proposals
```

Conventions that are not negotiable: all SQL in `src/db/queries.ts`, migrations
appended to `MIGRATIONS` and never edited once shipped, the API key confined to
`src/api/keyStore.ts`, and every colour, font, and spacing value taken from
`src/constants/theme.ts`. TypeScript strict throughout.

---

## Privacy and external requests

Mise has no app backend or account system. Meals, photos, pantry data, and
profile data stay in the app's own storage.

Image estimates and receipt extraction go directly to your chosen provider under
your API key. Barcode lookups query Open Food Facts when needed. Deleting the
app, or selecting **Settings → Delete all data**, removes locally stored data.

## License

MIT — see [LICENSE](./LICENSE).
