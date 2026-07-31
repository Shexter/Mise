## Why

The app supports two vision providers, Anthropic and Google Gemini, chosen
automatically from the shape of the user's key. OpenAI is the third key most
people already have, and supporting it removes a reason for someone to bounce
off onboarding — the app cannot work at all until a key it recognises is
pasted in.

There is a second, more pressing reason. The current provider selection is
binary by construction: `providerForKey` in `src/api/keyStore.ts` treats
`sk-ant-` as Anthropic and *everything else* as Gemini. An OpenAI key pasted
today is silently routed to Google, sent to a Google endpoint, and rejected with
an error that blames the key rather than the routing. Adding a third provider
forces that fallback to become explicit, which is worth doing on its own.

Relates to decision 5 (local-first, user's own key). It does **not** change the
key storage model: keys stay in the device keychain via `expo-secure-store` and
remain confined to `src/api/keyStore.ts`.

## What Changes

- **A new OpenAI transport module** alongside `src/api/anthropic.ts` and
  `src/api/gemini.ts`, implementing the same two entry points: estimate from a
  base64 JPEG, and verify a key without spending generation quota.
- **Provider detection becomes explicit and ordered.** `Provider` gains an
  `openai` member. Detection tests the most specific prefix first, because
  Anthropic keys (`sk-ant-…`) and OpenAI keys (`sk-…`, `sk-proj-…`) share a
  prefix — matching `sk-` first would route every Anthropic key to OpenAI.
- **Unrecognised keys stop being silently treated as Gemini.** Detection
  returns no provider for a key it does not recognise, and the caller reports
  that plainly.
- **Provider dispatch becomes a lookup rather than a ternary.**
  `src/api/vision.ts` currently branches with `provider === 'anthropic' ? … : …`
  in two places; a third provider makes nested ternaries the wrong shape.
- **Provider-specific error copy is corrected.** `copyForError` in
  `src/api/vision.ts` hardcodes "Your Anthropic account is out of credits" for
  the billing case, which is wrong for a Gemini or OpenAI user today. Billing
  and rate-limit copy become provider-aware.
- **Key entry gains OpenAI.** `src/components/ApiKeyForm.tsx` hardcodes two
  console links, a two-provider placeholder, hint, and validation message. All
  become driven by the provider list rather than written out.

## Capabilities

### New Capabilities

- `vision-provider`: How the app selects, validates, and talks to a vision
  provider using the user's own key. Covers provider detection from key shape,
  the transport contract each provider satisfies, key verification without
  spending generation quota, the shared error taxonomy and how provider-specific
  failures map onto it, and what the user is told when a key is unrecognised or
  rejected.

### Modified Capabilities

None. `openspec/specs/` is empty — no capability has been archived yet, so
provider behaviour is specified here for the first time.

## Non-goals

- **Changing how keys are stored.** `expo-secure-store`, the keychain, the
  `STORAGE_KEY` value, and the confinement rule are all unchanged. The storage
  key retains its historical `anthropic_api_key` name; renaming it would orphan
  the key of every existing install for no user-visible gain.
- **Multiple keys at once.** One key, one provider, as today. Holding an
  Anthropic and an OpenAI key simultaneously and choosing per request is a
  larger change to the settings surface and is not proposed here.
- **Manual provider override.** Detection stays automatic. A user whose key is
  not recognised is told so, rather than being given a provider picker.
- **Subscription or OAuth sign-in.** A Claude.ai or ChatGPT consumer
  subscription does not grant API access, and neither provider offers a flow
  that lets a third-party app spend a consumer subscription's quota. Not
  possible, so not proposed.
- **Changing the estimation prompt.** `src/api/prompt.ts` is shared and stays
  shared; the OpenAI transport adapts the same prompt to its own request shape.

## Impact

**Code.**
- `src/api/openai.ts` — new, mirroring the structure of `src/api/gemini.ts`.
- `src/api/keyStore.ts` — `Provider` union, `providerForKey`, and
  `looksLikeApiKey` extended. No change to storage, masking, or key access.
- `src/api/vision.ts` — dispatch becomes a registry; `copyForError` becomes
  provider-aware.
- `src/components/ApiKeyForm.tsx` — provider-driven copy and links.
- `src/api/errors.ts` — unchanged if the existing `VisionErrorKind` set already
  covers OpenAI's failure modes; confirmed during implementation.

**Dependencies.** None added. The OpenAI transport uses `fetch`, as the existing
two do.

**Cost.** None for existing users. OpenAI has no free tier, so Gemini remains
the recommended zero-cost option in onboarding copy.

**Risk.** The prefix-ordering trap is the one that silently breaks existing
users: getting the test order wrong routes every Anthropic key to OpenAI, and
the failure surfaces as a rejected key rather than a routing bug. It is called
out in the spec as a required behaviour with its own scenario.
