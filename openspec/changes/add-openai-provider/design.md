## Context

See `proposal.md` — Why. The relevant current state:

- `src/api/keyStore.ts` owns the key and exposes `Provider = 'anthropic' |
  'gemini'`, `providerForKey`, and `looksLikeApiKey`. Detection is
  `startsWith('sk-ant-') ? 'anthropic' : 'gemini'` — a total function that
  always returns a provider, correct only because there are exactly two.
- `src/api/vision.ts` is the facade. It dispatches with a ternary in
  `estimateMeal` and again in `verifyApiKey`, and owns `copyForError`.
- `src/api/anthropic.ts` and `src/api/gemini.ts` each export
  `estimateWith<Provider>` and `verify<Provider>Key`, both returning raw text
  and throwing `VisionError` from `src/api/errors.ts`.
- `src/api/prompt.ts` holds the one shared prompt. `src/api/parse.ts` parses the
  one shared response shape.
- `src/components/ApiKeyForm.tsx` hardcodes two console URLs, a two-provider
  placeholder, hint text, and validation message.

The structure is already right — one facade, one prompt, one parser, per-provider
transports. The only thing that does not survive a third provider is anywhere the
count "two" is baked in.

## Goals / Non-Goals

**Goals:**

- Adding the fourth provider should be a data edit, not a code change spread
  across five files.
- A misrouted key should be impossible to ship: the compiler should reject a
  supported provider with no transport.
- No existing user re-enters a key, and no existing provider's behaviour shifts.

**Non-Goals:**

- Reworking `VisionError` or the error kinds. The existing taxonomy is expected
  to cover OpenAI; confirmed in task 1.1, and only extended if it genuinely does
  not.
- Streaming responses, token accounting, or model selection UI.
- Touching `keyStore.ts`'s storage, masking, or access functions. Only the
  detection and shape-check functions change.

## Decisions

### One provider metadata record drives detection, dispatch, and UI

A single exported `PROVIDERS: Record<Provider, ProviderMeta>` in `keyStore.ts`,
where `ProviderMeta` carries the display name, the key prefix pattern, prefix
specificity, the console URL, whether it has a free tier, and the billing
location named in error copy.

*Why:* the spec requires that adding a provider surfaces in key entry "without
separate changes to that surface's copy". That is only true if the UI reads a
list rather than hardcoding entries. Detection, the console links, the
placeholder, the validation message, and the billing copy are five consumers of
the same facts — they should read one table.

*Alternative considered:* leaving detection in a function and adding a separate
UI constants file. Rejected: two lists that must agree is exactly how the fourth
provider gets added to one and not the other.

### `providerForKey` returns `Provider | null`

The signature changes from total to partial.

*Why:* the current function cannot express "I do not recognise this", so it
guesses Gemini. The spec forbids guessing. Making the absence explicit forces
both call sites in `vision.ts` and the validation path in `ApiKeyForm.tsx` to
handle it, and the compiler finds them.

*Trade-off:* this is a signature change to an exported function. The blast
radius is small — three call sites — and the compiler enumerates them, which is
why it is safe to do rather than adding a parallel `tryProviderForKey`.

### Detection tests prefixes longest-first, driven by data

Patterns are sorted by specificity and tested in that order, rather than
hand-ordered `if` statements.

*Why:* `sk-ant-` and `sk-` overlap, and hand-ordered branches encode that
constraint invisibly — the next person adds `sk-foo-` in the wrong position and
silently breaks Anthropic for every existing user. Sorting by specificity makes
the constraint structural. This is the single highest-risk detail in the change
and the spec gives it its own scenario.

### Dispatch is a `Record<Provider, Transport>`

```
interface Transport {
  estimate(key, base64Jpeg, signal): Promise<string>;
  verify(key): Promise<void>;
}
```

with `const TRANSPORTS: Record<Provider, Transport>`.

*Why:* `Record<Provider, …>` is exhaustive — adding a member to `Provider`
without adding its transport fails `npm run typecheck`, which is what the spec's
compile-time requirement asks for. Ternaries give no such guarantee and get
worse with each provider.

*Where it lives:* `vision.ts`, importing the three transport modules. The
transports do not import the registry, so there is no cycle.

### The OpenAI transport mirrors `gemini.ts` structurally

Same shape: module-level endpoint and timeout constants, an `estimateWith…`, a
`verify…Key`, a private `post` handling abort/timeout/network, and a private
`errorForResponse` mapping status codes.

*Why:* `gemini.ts` is the closer of the two models — it also verifies via a
model-listing endpoint. Matching its structure means a reader who knows one
knows the other, and review is a diff rather than a read.

Specifics:
- Endpoint `https://api.openai.com/v1/chat/completions`, auth by
  `Authorization: Bearer <key>` header rather than a query parameter.
- The image goes in a user message content part of type `image_url` with a
  `data:image/jpeg;base64,…` URL. The shared `SYSTEM_PROMPT` becomes a system
  message; `USER_PROMPT` accompanies the image.
- `response_format: { type: 'json_object' }` for a bare JSON object, matching
  what Gemini's `responseMimeType` achieves, so `parse.ts` is unchanged.
- Verification via `GET /v1/models`, which spends no generation quota.

**Model selection is left to implementation**, with two requirements: it must
support image input and JSON-object responses. Model identifiers move quickly
and one written into a design document ages badly — pick a current
vision-capable model at implementation time and put it in a named constant
beside Gemini's `MODEL`, so it is one line to change later.

### Exhausted quota is disambiguated by response body, not status

OpenAI returns HTTP 429 both for ordinary rate limiting and for an account out
of credit, distinguishing them by an error code in the body
(`insufficient_quota`). `errorForResponse` reads the body before deciding
between `billing` and `rate_limited`.

*Why:* the spec requires these be distinguishable, and the copy differs
materially — one says wait, the other says add credit. Mapping all 429s to
`rate_limited` would tell a user with an empty account to try again in a moment,
forever.

*Note:* `gemini.ts` currently maps all 429s to `rate_limited` with free-tier
copy, which is right for Gemini's free tier and is left alone.

### `copyForError` takes the provider

Signature becomes `copyForError(error, provider)`. Billing and rate-limit copy
read `PROVIDERS[provider]` for the display name and billing location. Network,
timeout, cancelled, and malformed copy stay provider-neutral.

*Why:* the current billing string names Anthropic unconditionally, which is
already wrong for a Gemini user today — this change fixes an existing defect
rather than only avoiding a new one. *Alternative considered:* looking the
provider up inside `copyForError`. Rejected: it would make a pure copy function
async, since the key read is async.

### `ApiKeyForm` renders from `PROVIDERS`

The console-link buttons map over the provider list. The placeholder,
hint, and validation message are composed from provider display names. The
free-tier provider is labelled from its `freeTier` flag rather than a hardcoded
"(free)".

### Retry belongs to the facade, and it happens once

`rate_limited` has existed in the taxonomy since the beginning and nothing has
ever acted on it. The error says "try again" and the user does it by hand. That
was tolerable with two providers and a paid key; it is not with three, one of
which has a free tier limited by requests per minute — a user logging breakfast,
a coffee, and a snack in quick succession will hit it.

*Why in `vision.ts` rather than in each transport:* the policy is not
provider-specific. What is provider-specific is the *shape* of the stated delay,
and that is exactly the kind of difference a transport exists to normalise —
each one converts its provider's header into milliseconds, and the facade holds
the one policy. Three copies of a backoff would drift, and the drift would be
invisible until someone's provider behaved differently for no reason they could
see.

*Why once, and not exponential backoff:* the standard argument for a retry loop
assumes a background job where a user is not waiting. Here a user is holding a
phone looking at a photograph of their lunch. A second failure is worth more to
them as information than as a third attempt, and a loop turns a rate limit into
a minute of apparent breakage. Once is enough to absorb the common case — a
burst that crossed a per-minute boundary — and honest about the rest.

*Why only `rate_limited`:* every other kind is a fact about the world that a
retry will not change. `unauthorized` and `billing` need the user to go
somewhere and do something. `cancelled` is a request not to. `malformed` is the
subtle one, because retrying it feels reasonable — the model might answer better
next time — and it is still wrong: it spends the user's money on a coin flip
they did not ask for, and it hides a prompt problem that ought to be visible.

*Why the wait must be visible:* a silent thirty-second pause is
indistinguishable from a hung app, and the user's rational response is to kill
it — which loses the retry that was about to succeed. Saying "the provider asked
us to wait a moment" costs one line and converts a bug report into a shrug. It
also has to be cancellable, because sometimes thirty seconds is genuinely too
long and the honest answer is to let them out.

## Risks / Trade-offs

**Prefix ordering silently breaks every existing Anthropic user** → matching
`sk-` before `sk-ant-` routes all Anthropic keys to OpenAI, surfacing as
"your key was rejected" rather than as a routing bug. Mitigation: specificity
ordering is derived from the data rather than hand-written, and a test asserts a
known Anthropic key detects as Anthropic.

**`providerForKey` signature change** → three call sites must handle `null`.
Mitigation: TypeScript strict finds all of them; `npm run typecheck` is the
gate.

**OpenAI model identifiers drift** → a model named here may be superseded or
retired. Mitigation: not naming one in the design, requiring a named constant,
and requiring a live verification against the real API during implementation.

**No test runner exists in the repo** → detection ordering is exactly the kind
of thing a two-line test would protect forever. Mitigation: if the identity
layer change (which installs a runner) lands first, add the tests here. If this
change lands first, verify by hand against a real key of each type and note it
in the task.

**OpenAI has no free tier** → a user who follows an OpenAI link from onboarding
hits a paywall. Mitigation: the `freeTier` flag keeps Gemini identifiable as the
zero-cost option, which the spec requires.

## Migration Plan

No schema change and no data migration.

`STORAGE_KEY` is currently `anthropic_api_key`, a name that is already wrong —
it holds Gemini keys today and will hold OpenAI keys after this change. It
should be renamed to something provider-neutral, and this is the moment: the
app's bundle identifier moved to `com.mise.app` in the rename to Mise, so no
standalone install of this app exists and there is no keychain entry to orphan.

The one affected case is a developer testing through Expo Go, whose keychain is
Expo Go's rather than the app's and therefore survives the bundle change. They
re-enter a key once. That is worth accepting rather than carrying a misleading
constant name indefinitely.

Rollback is a straight revert. A user who saved an OpenAI key and then downgrades
has a key the older build detects as Gemini and rejects; they would re-enter a
key, which is the pre-existing behaviour for an unrecognised key and not a
regression introduced by rolling back.

## Open Questions

- **Which OpenAI model.** Deferred to implementation by design, since it must be
  verified against the live API. It does not change the specs, the structure, or
  the task breakdown — only the value of one constant.
- **Whether `VisionError` needs a new kind for OpenAI.** Expected not; task 1.1
  confirms against real failure responses. If a genuinely new failure mode
  appears, adding a kind is additive and touches only `errors.ts` and
  `copyForError`.
