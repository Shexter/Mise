## 1. Vision Transport & Cascade Enhancements

- [x] 1.1 Add model fallback cascade in `src/api/gemini.ts` from primary model to `gemini-2.5-flash-lite` on quota/rate errors
- [x] 1.2 Update `retryRateLimitedOnce` in `src/api/transport.ts` to support real-time tick progress callbacks

## 2. Review UI Progress & Manual Transition

- [x] 2.1 Render live countdown progress banner on `app/review.tsx` when rate limit wait is active
- [x] 2.2 Provide a "Cancel & Log Manually" button during countdown that retains captured photo and opens manual editor
- [x] 2.3 Update error card copy to offer direct 1-tap manual logging button when retries fail

## 3. Verification & Testing

- [x] 3.1 Add unit tests in `test/vision-retry.test.ts` for model fallback cascade and delay reporting
- [x] 3.2 Verify test suite passes with `npm test` and `npm run typecheck`
