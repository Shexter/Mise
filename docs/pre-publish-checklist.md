# Pre-publish checklist

Not relevant today — Mise ships as a sideloadable APK via the EAS `preview`
profile (see `docs/building-android-apks.md`), not through the App Store or
Google Play. This file exists so the items below aren't lost between now
and whenever store distribution actually happens.

## Run Greenlight before any App Store / Play Store submission

[RevylAI/greenlight](https://github.com/RevylAI/greenlight) — a
pre-submission compliance scanner for Apple App Store and Google Play. Run
it against the app before the first submission and before any submission
that touches permissions, tracking, or account/purchase flows.

What it checks, relevant to Mise specifically:

- **Privacy manifest completeness** (`PrivacyInfo.xcprivacy`) cross-referenced
  against detected tracking SDKs — worth checking closely given the vision
  API key setup and any third-party SDKs in use by then.
- **Account deletion pathway** — Mise is local-first with no accounts today
  (decision: local-first, no server, no auth), so this may not apply, but
  re-check against whatever the app's data model looks like at
  submission time, especially if any cloud/sync feature has landed by then.
- **Android**: target API deadlines, restricted permissions, 16 KB page
  alignment, 64-bit ABI requirements — relevant given the app already
  targets arm64 for the release APK.
- **Hardcoded secrets / private API usage** — worth a clean run given the
  API key handling already lives in `src/api/keyStore.ts`, but confirming
  nothing else leaked in is cheap insurance.
- Runtime testing (optional, via Revyl cloud devices) for account deletion,
  purchase restoration, and Sign-in-with-Apple flows, if any of those exist
  by the time of submission.

Static analysis only, runs offline, no store account needed — cheap to run
early and re-run before each submission rather than only once.
