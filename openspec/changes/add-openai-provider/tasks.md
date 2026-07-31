## 1. Groundwork

- [ ] 1.1 Call the OpenAI API by hand with a real key and capture the actual
      response bodies for: success, an invalid key, an out-of-credit account,
      and a rate limit. Confirm the existing `VisionErrorKind` set in
      `src/api/errors.ts` covers them, and note the exact field that carries
      `insufficient_quota`.
- [ ] 1.2 Pick a current vision-capable OpenAI model that supports JSON-object
      responses, verify it against the live API with the shared prompt from
      `src/api/prompt.ts`, and record the identifier for use as a named
      constant.

## 2. Provider metadata

Pure data and pure functions, no network.

- [ ] 2.1 Define `ProviderMeta` and the `PROVIDERS: Record<Provider, ProviderMeta>`
      table in `src/api/keyStore.ts`: display name, key prefix pattern, prefix
      specificity, console URL, free-tier flag, billing location.
- [ ] 2.2 Extend the `Provider` union with `'openai'`.
- [ ] 2.3 Rewrite `providerForKey` to test patterns in descending specificity
      order derived from the table, returning `Provider | null`.
- [ ] 2.4 Rewrite `looksLikeApiKey` to accept a key matching any provider in the
      table, so shape validation and detection cannot disagree.
- [ ] 2.5 Verify a key beginning `sk-ant-` detects as Anthropic and not OpenAI,
      an `sk-proj-` key detects as OpenAI, an `AIza` key detects as Google, and
      an unrecognised string returns `null`. Add tests if a runner exists,
      otherwise verify by hand and record the result in this task.
- [ ] 2.6 Confirm `STORAGE_KEY`, `getApiKey`, `setApiKey`, `maskKey`, and the
      seeding path are untouched, and that an existing saved key still loads.

## 3. OpenAI transport

- [ ] 3.1 Create `src/api/openai.ts` mirroring the structure of
      `src/api/gemini.ts`: endpoint and timeout constants, the model constant
      from 1.2, and private `post` and `errorForResponse` helpers.
- [ ] 3.2 Implement `estimateWithOpenAI(apiKey, base64Jpeg, signal)`: system
      message from `SYSTEM_PROMPT`, user message carrying the image as a
      `data:image/jpeg;base64,…` `image_url` part plus `USER_PROMPT`,
      `response_format` set to a JSON object, returning the raw text.
- [ ] 3.3 Implement `verifyOpenAIKey(apiKey)` against `GET /v1/models` so no
      generation quota is spent.
- [ ] 3.4 Map failures onto the shared taxonomy: 401 to rejected key, 429 with
      the exhausted-quota code to billing, other 429s to rate limited, 5xx to
      server, abort to cancelled or timeout, unreachable to network.
- [ ] 3.5 Confirm the returned text parses with the existing `src/api/parse.ts`
      unchanged.

## 4. Facade

- [ ] 4.1 Define the `Transport` interface and
      `TRANSPORTS: Record<Provider, Transport>` in `src/api/vision.ts`,
      importing all three transport modules.
- [ ] 4.2 Replace the ternary in `estimateMeal` with a registry lookup, and
      handle a `null` provider by throwing the unrecognised-key error rather
      than defaulting.
- [ ] 4.3 Replace the ternary in `verifyApiKey` the same way.
- [ ] 4.4 Confirm removing a member from `TRANSPORTS` fails `npm run typecheck`,
      proving the exhaustiveness guarantee the spec requires.
- [ ] 4.5 Change `copyForError` to take the provider and read display name and
      billing location from `PROVIDERS`. Keep network, timeout, cancelled, and
      malformed copy provider-neutral.
- [ ] 4.6 Update every `copyForError` call site to pass the provider.
- [ ] 4.7 Verify a Gemini user seeing a billing error is no longer told their
      Anthropic account is out of credits.

## 5. Key entry

- [ ] 5.1 Replace the hardcoded console URLs in
      `src/components/ApiKeyForm.tsx` with buttons mapped over `PROVIDERS`,
      labelling the free-tier provider from its flag.
- [ ] 5.2 Compose the field placeholder, hint, and validation message from the
      provider list rather than naming two providers inline.
- [ ] 5.3 Handle the unrecognised-key case: state that the key was not
      recognised and name the accepted formats.
- [ ] 5.4 Confirm the surface uses only tokens from `src/constants/theme.ts` —
      no colour, font, or spacing literals.
- [ ] 5.5 Check the onboarding key step at `app/onboarding/api-key.tsx` and the
      settings sheet at `src/components/settings/ApiKeySheet.tsx` for copy that
      names providers, and update it from the same table.

## 6. Verification

- [ ] 6.1 End to end with a real OpenAI key: paste, Test key passes, photograph
      a meal, estimate parses, items appear on the review screen.
- [ ] 6.2 Regression-test both existing providers with real keys — an Anthropic
      key and a Gemini key must behave exactly as before.
- [ ] 6.3 Verify an out-of-credit OpenAI key produces billing copy naming
      OpenAI, and that a rate-limited response produces retry copy.
- [ ] 6.4 Run `npm run typecheck`, then update `docs/product-decisions.md` with
      a decision recording that three providers are supported, that detection
      is longest-prefix-first, and that subscription sign-in is not possible.
