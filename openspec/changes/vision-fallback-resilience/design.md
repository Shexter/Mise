## Context

When estimating meals via vision APIs (Gemini, Claude, OpenAI), rate limits (HTTP 429) or quota errors can pause or reject the request. While `transport.ts` currently has `retryRateLimitedOnce()`, the UI doesn't provide visual feedback for long delays, and errors do not offer a fluid path to enter manual numbers while retaining the captured photo.

This design adds live countdown UI for rate-limit pauses, model tier fallback cascades, and seamless manual entry preservation.

## Goals / Non-Goals

**Goals:**
- Provide real-time countdown progress feedback when waiting out a rate-limit duration.
- Cascade model fallbacks (e.g. Gemini 2.5 Flash $\rightarrow$ Gemini 2.5 Flash Lite) before giving up.
- Provide a 1-tap "Switch to Manual Entry" button on the error card that retains the captured photo and dish name.

**Non-Goals:**
- Retrying authentication failures or invalid API keys.
- Sending user photos to external untrusted proxies.

## Decisions

### Decision 1: Live countdown state in `app/review.tsx`
* **Approach**: Extend `onRetryWait` callback in `estimateMeal()` to report ticks (e.g. every second) or use an interval timer based on `delayMs` to render a visual countdown banner: *"Waiting X seconds for quota reset..."* with a "Cancel & Log Manually" button.

### Decision 2: Model Fallback Cascade in `src/api/gemini.ts`
* **Approach**: On HTTP 429 / RESOURCE_EXHAUSTED from `gemini-2.5-flash`, immediately try `gemini-2.5-flash-lite` before surfacing a rate limit error.

### Decision 3: Photo preservation during manual fallback
* **Approach**: Transitioning from review error to manual entry passes the existing `photoUri` so the user does not lose their image.

## Risks / Trade-offs

- [Risk] Both models rate-limited concurrently.
  → **Mitigation**: Gracefully bubble up `rate_limited` error with the clear manual entry fallback action.

## Modules Touched

- `src/api/vision.ts`
- `src/api/gemini.ts`
- `src/api/transport.ts`
- `app/review.tsx`
- `test/vision-retry.test.ts`
