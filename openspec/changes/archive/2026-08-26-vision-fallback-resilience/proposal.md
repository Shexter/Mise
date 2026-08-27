## Why

When users hit vision provider rate limits (HTTP 429) or transient server errors, the meal review screen currently halts with an error card that can leave users frustrated or stranded without their estimated items.

Enhancing vision resilience with real-time countdown progress, automated fallback to lighter model tiers (e.g. `gemini-2.5-flash-lite`), and an immediate 1-tap transition to manual estimation preserves user meal context and eliminates dead ends.

## What Changes

- Add a live retry wait countdown banner on the meal review screen when the provider signals a rate limit with a `Retry-After` duration.
- Provide a clear, non-blocking **"Switch to Manual Entry"** option on rate-limit errors that preserves the photo and any partial dish name.
- Automatic graceful fallback across model tiers (e.g. Gemini Flash $\rightarrow$ Gemini Flash Lite) when primary models return quota or capacity exhaustion.
- Informative, polite error copy explaining rate limits and quota resets without requiring developer-level debugging.

## Capabilities

### New Capabilities
- `vision-fallback`: Automated model tier fallback, live rate-limit retry feedback, and manual entry handoff on vision estimation failures.

### Modified Capabilities
<!-- None -->

## Non-goals

- Bypassing provider rate limits or quotas artificially.
- Retrying non-recoverable errors (e.g. invalid API keys or rejected authentication).

## Impact

- `src/api/vision.ts` & `src/api/gemini.ts` & `src/api/anthropic.ts`: Enhances model fallback cascade and delay reporting.
- `app/review.tsx`: Adds live retry countdown indicator and manual fallback button on rate limits.
- Tests: Adds tests for model cascade and rate-limit recovery in `test/vision-retry.test.ts`.
