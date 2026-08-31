# Master Profile Evidence: Mise

## 1. Review metadata

- **Repository and purpose:** Mise is a local-first food and nutrition application for pantry stock, meal logging, grocery activity, and food decisions. The repository describes that purpose in [README.md](./README.md#L1-L11).
- **Local repository path:** `./`
- **Remote repository identity:** `https://github.com/Shexter/Mise.git`
- **Reviewed branch:** `main`, tracking `origin/main`
- **HEAD commit SHA:** `7808e2bd6c695df40973d368e5e2833eb4a01fd5`
- **Reachable history inspected:** All 122 commits reachable from local branches, remote-tracking branches, and tags. The reachable range starts at `b4835f1b563cd6cb7ecac018bc1a98656a3c14e9` and ends at HEAD.
- **Other refs inspected:** `origin/claude/changes-openspec-progress-uvdxsn`, `origin/claude/opensec-identity-layer-schd87`, `origin/codex/openai-endpoint`, `origin/docs/note-greenlight-pre-publish`, and all 26 local tags.
- **Review date:** 2026-08-29
- **Initial worktree state:** Clean. `git status --short --branch` reported only `## main...origin/main` before this file was created.
- **Access limits:** This review used the locally reachable Git graph. It did not fetch current remote state, inspect pull-request discussions, download CI artifacts, call provider APIs, or run the application on a device.
- **Instruction files:** No repository-owned `AGENTS.md`, `CLAUDE.md`, or `CONTRIBUTING.md` applies to this root file. Dependency-owned instructions under `node_modules` were out of scope.
- **Existing-file mode:** No prior `MASTER_PROFILE_EVIDENCE.md` existed at the start of the review.
- **Profile-owner confirmation:** On 2026-08-29, the profile owner confirmed primary contribution for all six Section 6 candidates and approved their generic candidate statements for external use. This is an attestation, not independent proof of sole unaided authorship, runtime success, adoption, or impact. Section 13 restrictions still govern sensitive supporting evidence.

## 2. Executive summary

Mise is an Expo and React Native application for one household user on one device. It combines meal and nutrition logging with pantry inventory, receipts, shopping, recipes, and dinner suggestions. The product premise is that meal logs can also provide pantry-depletion signals. These statements come from the project overview in [README.md](./README.md#L3-L43).

The current checkout implements a broad application surface. Its root navigator registers onboarding, capture, review, pantry, shopping, analytics, fasting, receipt, barcode, recipe, and maintenance screens in [app/_layout.tsx](./app/_layout.tsx#L74-L110). The implementation uses a 34-version SQLite schema in [src/db/schema.ts](./src/db/schema.ts#L763-L799). Automated source-level verification passes, as recorded in Section 11.

The repository calls the project active development in [README.md](./README.md#L9-L11). Tags and the Android workflow show a sideloadable APK process, but they do not prove that an APK was installed or used. The pre-publish checklist says store distribution has not happened in [docs/pre-publish-checklist.md](./docs/pre-publish-checklist.md#L1-L6). No production use, user adoption, or business outcome was observed.

This evidence may support a standalone Mise project dossier. Whether it belongs to employment, consulting, education, or an independent project is **uncertain and requires the profile owner's decision**. Do not merge it with another experience without that decision.

## 3. Chronological project narrative

### 2026-07-31: initial application and product framing

- **Repository-proven:** Commit `b4835f1` introduced the Expo application, local database, meal capture, onboarding, provider code, product documentation, and OpenSpec material. Commit `e94c00f` renamed the application from Snap to Mise.
- **Interpretation:** The large initial commit suggests that work existed before this Git history. That interpretation is unverified because no earlier reachable commits exist.
- **Owner question:** What work preceded `b4835f1`, and which parts did the profile owner personally design or implement?

### 2026-07-31 to 2026-08-01: identity, pantry, depletion, and dinner decisions

- **Repository-proven:** Commit `8e88c5e` added canonical ingredients, aliases, matching, and a review queue. Commit `c5f2f46` added pantry stock. Commit `882c77c` connected committed meal logs to pantry depletion. The resulting schema boundaries remain visible in [src/db/schema.ts](./src/db/schema.ts#L64-L129) and [src/db/schema.ts](./src/db/schema.ts#L131-L211).
- **Repository-proven:** Commits `b87870b` and `779382d` addressed date selection and expanded its regression assertions. The retained design explains the stale module-load date in [openspec/changes/fix-day-selection/design.md](./openspec/changes/fix-day-selection/design.md#L1-L27).
- **Interpretation:** The sequence suggests an architecture-first iteration from identity to inventory to depletion. The repository does not establish who set that sequence or why.
- **Owner question:** Who defined the identity-first approach and the rule that only home meals deplete pantry stock?

### 2026-08-04 to 2026-08-06: receipt, dietary, matching, and suggestion expansion

- **Repository-proven:** Commits `795a4ab`, `2fc812f`, `d56db07`, and `ab619c1` built and completed the first receipt-import plan. Commits `f6722bb`, `b6cb75d`, and `1ab09b4` added dish scoring, dietary rules, and CJK-aware matching.
- **Repository-proven:** Commit `d34f9b8` added the Android APK workflow. Commit `e6cb4af` moved that workflow to Node 22. The current workflow runs typecheck, tests, Expo prebuild, and Gradle assembly in [.github/workflows/android-apk.yml](./.github/workflows/android-apk.yml#L33-L77).
- **Interpretation:** Commit messages and OpenSpec records suggest repeated plan, implementation, review, and reconciliation cycles. They do not prove the profile owner's decision authority.
- **Owner question:** Which requirements came from personal use, external feedback, or competitive research?

### 2026-08-07 to 2026-08-10: catalogue, history, editing, capture, and providers

- **Repository-proven:** Commit `5945d56` expanded catalogue provenance, expiry data, and nullable nutrition. Commit `b507334` added catalogue, meal editing, and history work. Commits `4bec5f5`, `baf0319`, `8cf1104`, `a1d92e3`, and `8e06590` expanded provider configuration, pantry flows, barcode flows, capture, and nutrition suggestions.
- **Interpretation:** These commits suggest a transition from core data structures toward a broader daily-use product. Adoption and usability are not evidenced.
- **Owner question:** Which of these flows did the profile owner test personally, and what feedback changed the implementation?

### 2026-08-12 to 2026-08-23: shopping, recipes, analytics, themes, and onboarding

- **Repository-proven:** Commit `431c4bc` added shopping-list and grocery-haul behavior. Commit `5180099` added body-composition intake, hybrid receipt OCR, shop locations, and extended nutrients. Later commits added editing coverage, themes, swipe suggestions, meal deletion, demo data, and onboarding changes. The current screen registry is visible in [app/_layout.tsx](./app/_layout.tsx#L80-L109).
- **Repository-proven:** Tags from `apk-release-20260812-431c4bc` through `pre-release-2026-08-23` point to milestones in this period. A tag proves a named Git reference, not a successful build or installation.
- **Interpretation:** The tag names suggest repeated device-distribution checkpoints. Runtime use remains unverified.
- **Owner question:** Which tagged APKs were installed, by whom, and what defects were observed?

### 2026-08-24 to 2026-08-26: resilience and navigation refinement

- **Repository-proven:** Commits `63f546c` and `e3898c8` hardened grocery-haul category recovery. The archived change describes corrupt or legacy values and defensive fallbacks in [the shop-crash proposal](./openspec/changes/archive/2026-08-25-fix-shop-crash/proposal.md#L1-L31).
- **Repository-proven:** Commit `ec82598` streamlined review and pantry flows. Commit `1663a0a` promoted Shop to a bottom tab and added shopping restock. HEAD `7808e2b` added vision retry feedback, manual fallback, and quick re-log support. The current tab layout is in [app/(tabs)/_layout.tsx](./app/(tabs)/_layout.tsx#L23-L58).
- **Interpretation:** These changes appear feedback-driven, but neither the source of feedback nor observed improvement is recorded.
- **Owner question:** Were the crash and retry changes responses to owner testing, other users, or automated review?

### Current state

- **Repository-proven:** The checkout contains 34 migrations, 139 passing test files, 1,342 passing tests, and 13 valid canonical OpenSpec specs. See Sections 9 and 11.
- **Uncertain:** Device behavior, APK upgrade behavior, accessibility on physical devices, provider compatibility, and production distribution were not observed in this review.

## 4. Architecture and system boundaries

### Application and state flow

1. Expo Router maps file-based screens and four primary tabs. See [app/_layout.tsx](./app/_layout.tsx#L74-L110) and [app/(tabs)/_layout.tsx](./app/(tabs)/_layout.tsx#L23-L58).
2. Screens use Zustand stores and service functions. The Today screen reads the day and capture stores in [app/(tabs)/index.tsx](./app/(tabs)/index.tsx#L56-L85).
3. Logic modules resolve identities, calculate nutrition, plan depletion, reconcile receipts, score suggestions, and plan restocks. Meal depletion crosses these layers in [src/logic/depletionService.ts](./src/logic/depletionService.ts#L15-L20) and [src/logic/depletionService.ts](./src/logic/depletionService.ts#L116-L134).
4. Modular query files own persistence operations and map SQLite rows into domain types. Their public surface is re-exported by [src/db/queries/index.ts](./src/db/queries/index.ts).

### Persistence and schema

- SQLite stores the profile, targets, meals, pantry, receipts, shopping, recipes, suggestions, dietary rules, fasting records, and shop locations. The initial tables start in [src/db/schema.ts](./src/db/schema.ts#L8-L62), and the complete migration list is in [src/db/schema.ts](./src/db/schema.ts#L763-L799).
- Database startup enables WAL and foreign keys, applies forward migrations, and loads seed data in [src/db/index.ts](./src/db/index.ts#L21-L47).
- The database retains the historical filename `snap.db` to avoid losing existing local installs after the rename. This rationale appears in [src/db/index.ts](./src/db/index.ts#L6-L12).
- Photos use application file storage rather than SQLite. This boundary is suggested by photo deletion calls in [app/(tabs)/index.tsx](./app/(tabs)/index.tsx#L170-L174). Exact backup and operating-system protection behavior remains **uncertain**.
- The JSON export includes profile, daily targets, meals, pantry items, recipes, and shopping items in [src/db/queries/analytics.ts](./src/db/queries/analytics.ts#L172-L220). It is sensitive personal data.

### Authentication and authorization

- No account, login, remote application backend, or multi-user authorization layer was found. The repository states this constraint in [README.md](./README.md#L165-L172).
- Provider credentials live in Expo SecureStore. Their access boundary is [src/api/keyStore.ts](./src/api/keyStore.ts#L1-L20) and [src/api/keyStore.ts](./src/api/keyStore.ts#L107-L155).
- This review did not inspect a real key or local environment value. The existence of ignored local `.env` state was treated as sensitive and excluded.

### External integrations and trust boundaries

- The application sends image or prompt payloads directly to Anthropic, Google Gemini, or an OpenAI-compatible endpoint through the transport map in [src/api/transport.ts](./src/api/transport.ts#L1-L62).
- Provider selection depends on key shape in [src/api/keyStore.ts](./src/api/keyStore.ts#L68-L88) and [src/api/keyStore.ts](./src/api/keyStore.ts#L185-L204). Shape detection is not authentication.
- Barcode lookups send the GTIN to Open Food Facts in [src/api/openFoodFacts.ts](./src/api/openFoodFacts.ts#L4-L38).
- Foreground camera, photo-library, and coarse-location permissions are declared in [app.config.ts](./app.config.ts#L31-L57). Location is configured without background access in [app.config.ts](./app.config.ts#L90-L103).
- A custom OpenAI-compatible endpoint is accepted without prior validation. That trust boundary is documented in [src/api/keyStore.ts](./src/api/keyStore.ts#L141-L150).

### Import, reconciliation, and reporting pipelines

- Meal capture flows from image selection or camera capture to provider estimation, review, meal persistence, and optional pantry depletion. Provider estimation is in [src/api/vision.ts](./src/api/vision.ts#L27-L52). Depletion is applied only after commit in [src/logic/depletionService.ts](./src/logic/depletionService.ts#L15-L20).
- Receipt intake stores frames and lines, resolves canonical ingredients, and applies accepted changes. The service surface is shown by [src/logic/receiptService.ts](./src/logic/receiptService.ts).
- Receipt OCR can use local recognition and optional cloud text enhancement. The preference defaults off in [src/db/schema.ts](./src/db/schema.ts#L733-L755).
- Barcode intake checks local product data and Open Food Facts, then supports review and recovery. Source and tests exist, but no live lookup was observed.
- Nutrition reporting aggregates stored meals and targets. Export assembly is in [src/db/queries/analytics.ts](./src/db/queries/analytics.ts#L184-L220).

### Deployment and operational model

- Local development uses Expo SDK 54 and Node 22.5 or later, as declared in [package.json](./package.json#L8-L20) and [README.md](./README.md#L66-L78).
- GitHub Actions defines a sideloadable Android APK build on pushes to `main` and manual dispatches. It uses a debug keystore and explicitly excludes store readiness in [.github/workflows/android-apk.yml](./.github/workflows/android-apk.yml#L1-L14).
- EAS configuration also defines internal preview APKs and production app bundles in [eas.json](./eas.json#L6-L24). Configuration does not prove that either build profile ran.

## 5. Feature inventory

| Capability | User or operator | Evidenced behavior | Implementation and tests | Known limits | Runtime observed |
| --- | --- | --- | --- | --- | --- |
| Onboarding and targets | Device user | Captures body and goal inputs, computes targets, and supports measured body-composition intake. | [onboarding routes](./app/onboarding/), [body-composition parser tests](./src/logic/bodyCompositionParser.test.ts), [target persistence](./src/db/queries/profile.ts#L198-L256) | Medical accuracy and usability are not established. | No |
| Manual and photo meal logging | Device user | Supports manual entries and provider-estimated photo entries with review before save. | [app/manual.tsx](./app/manual.tsx), [app/review.tsx](./app/review.tsx), [vision facade](./src/api/vision.ts#L27-L52), [capture parsing tests](./test/capture-parse.test.ts) | Provider output and real-camera behavior were not tested. | No |
| Meal history, edit, delete, and quick re-log | Device user | Browses dates, edits or removes meals, and clones recent or favorite meals into review. | [Today screen](./app/(tabs)/index.tsx#L87-L155), [meal queries](./src/db/queries/meals.ts#L155-L313), [quick re-log tests](./test/meal-cloning.test.ts) | Cross-version device migration and gesture behavior are unverified. | No |
| Nutrition analytics | Device user | Aggregates energy, macros, fibre, and configured nutrients across dates and ranges. | [analytics queries](./src/db/queries/analytics.ts#L23-L168), [nutrition report tests](./src/components/NutritionReport.test.ts), [range tests](./src/logic/nutritionRange.test.ts) | Health outcomes and calculation validity outside test fixtures are unverified. | No |
| Fasting tracking | Device user | Starts and ends local fasting intervals and stores history. | [fasting queries](./src/db/queries/profile.ts#L105-L196), [fasting tests](./test/fasting-tracking.test.ts) | Notifications and real elapsed-time behavior were not observed. | No |
| Pantry and expiry | Device user | Stores physical items, locations, stock state, predicted expiry, and user corrections. | [pantry schema](./src/db/schema.ts#L131-L176), [pantry queries](./src/db/queries/pantry.ts), [expiry tests](./src/logic/expiry.test.ts) | Predictions are rules, not observed food-safety guarantees. | No |
| Meal-driven depletion | Device user | Resolves home-meal ingredients, applies explainable ledger entries, and reverses them during edit or delete. | [depletion service](./src/logic/depletionService.ts#L116-L233), [depletion tests](./test/depletion.test.ts) | Accuracy depends on matching and estimates. Non-home meals intentionally do not deplete stock. | No |
| Ingredient identity and matching | Device user or reviewer | Maps raw references to canonical ingredients, records aliases, and queues uncertain matches. | [identity schema](./src/db/schema.ts#L64-L129), [identity queries](./src/db/queries/identity.ts), [cascade tests](./test/cascade.test.ts), [CJK tests](./test/cjk-matching.test.ts) | Catalogue coverage and multilingual quality were not measured in use. | No |
| Receipt capture and OCR | Device user | Stores multi-frame receipts, extracts lines, permits correction, and applies accepted pantry changes. | [receipt queries](./src/db/queries/receipts.ts), [receipt service](./src/logic/receiptService.ts), [receipt import tests](./test/receipt-import.test.ts), [OCR service tests](./test/receipt-ocr-service.test.ts) | Real receipts, camera quality, and provider privacy behavior were not observed. | No |
| Barcode lookup and recovery | Device user | Checks products by GTIN, queries Open Food Facts, caches misses, and offers recovery review. | [Open Food Facts client](./src/api/openFoodFacts.ts#L22-L49), [barcode tests](./test/barcode.test.ts), [recovery tests](./test/barcode-recovery.test.ts) | External catalogue availability and product accuracy are unverified. | No |
| Dinner suggestions | Device user | Generates, caches, ranks, and presents suggestions based on pantry and nutrition inputs. | [suggestion service](./src/logic/suggestionService.ts), [scoring tests](./src/logic/suggest.test.ts), [service tests](./test/suggestion-service.test.ts) | Suggestion quality, safety, and user acceptance are unmeasured. | No |
| Recipes and cooking | Device user | Imports or edits recipes, stores ingredients, and turns a recipe into a reviewed meal. | [recipe routes](./app/recipe/), [recipe queries](./src/db/queries/recipes.ts), [recipe parity tests](./test/recipe-cooking-parity.test.ts) | Share-target behavior and recipe extraction were not tested on a device. | No |
| Shopping list and restock | Device user | Manages manual and derived shopping items, matches receipts, and creates pantry restock records. | [Shop tab](./app/(tabs)/shop.tsx), [shopping queries](./src/db/queries/shopping.ts), [restock planner](./src/logic/stockRestock.ts#L15-L51), [restock tests](./test/stock-restock.test.ts) | Corrupt-data recovery is test-backed only. Real grocery-haul use is unverified. | No |
| Shop locations | Device user | Remembers shops using foreground coarse location and shows needed ingredients. | [location configuration](./app.config.ts#L90-L103), [shop queries](./src/db/queries/shops.ts), [shop tests](./test/shop-locations.test.ts) | Location is sensitive. Permission UX and coordinate behavior were not observed. | No |
| Export and deletion | Device user | Builds a local JSON export and can rebuild the local database after deletion. | [export bundle](./src/db/queries/analytics.ts#L172-L220), [reset flow](./src/db/index.ts#L88-L104), [reset tests](./test/reset.test.ts) | Export destination, secure deletion, backups, and operating-system copies are unverified. | No |

## 6. Personal-contribution candidates

These are candidate records, not approved profile claims. Git author fields and package metadata do not establish identity, sole ownership, authority, or unaided authorship.

```yaml
claim_key: mise-catalogue-history-editing
statement: Contributed a commit that added catalogue, meal-editing, and history-calendar code and tests.
project: Mise
claim_type: implementation
ownership_candidate: primary
evidence_strength_candidate: moderate
primary_evidence:
  - type: commit
    locator: b507334
    proves: The commit changes catalogue, editing, history, database, and test paths under one Git author identity.
limitations:
  - The profile owner attests primary contribution; the commit does not independently prove sole authorship, detailed decision authority, or runtime adoption.
needs_profile_owner_confirmation: false
external_use_candidate: safe
```

```yaml
claim_key: mise-shopping-and-restock
statement: Contributed implementation for a shopping list, grocery-haul reconciliation, and pantry restock flow.
project: Mise
claim_type: implementation
ownership_candidate: primary
evidence_strength_candidate: moderate
primary_evidence:
  - type: commit
    locator: 431c4bc
    proves: The commit adds shopping UI, schema, logic, and tests.
  - type: commit
    locator: 1663a0a
    proves: The commit adds the Shop tab and restock logic with regression tests.
  - type: test
    locator: "[test/stock-restock.test.ts](./test/stock-restock.test.ts)"
    proves: Automated cases exist for the restock planner.
limitations:
  - The profile owner attests primary contribution; Git history does not independently establish detailed workflow authority or user validation.
  - Passing tests do not prove grocery use on a device.
needs_profile_owner_confirmation: false
external_use_candidate: safe
```

```yaml
claim_key: mise-resilient-local-data
statement: Contributed defensive handling for legacy or invalid shopping-list category data.
project: Mise
claim_type: implementation
ownership_candidate: primary
evidence_strength_candidate: moderate
primary_evidence:
  - type: commit
    locator: e3898c8
    proves: The commit changes grocery-haul loading and invalid-category recovery paths.
  - type: document
    locator: "[shop-crash proposal](./openspec/changes/archive/2026-08-25-fix-shop-crash/proposal.md)"
    proves: The repository records the failure modes and intended recovery behavior.
limitations:
  - The profile owner attests primary contribution; the repository does not independently prove who reproduced, diagnosed, or reported the original failure.
  - No affected production user or production incident is evidenced.
needs_profile_owner_confirmation: false
external_use_candidate: safe
```

```yaml
claim_key: mise-vision-fallback
statement: Contributed bounded vision retries, retry feedback, and a manual-entry fallback that preserves capture context.
project: Mise
claim_type: implementation
ownership_candidate: primary
evidence_strength_candidate: moderate
primary_evidence:
  - type: commit
    locator: 7808e2b
    proves: HEAD changes transport, review, manual-entry, test, and OpenSpec paths for fallback behavior.
  - type: file
    locator: "[src/api/transport.ts](./src/api/transport.ts)"
    proves: The current transport retries rate limits and transient failures once.
  - type: test
    locator: "[test/vision-retry.test.ts](./test/vision-retry.test.ts)"
    proves: Automated retry cases exist and pass in the current suite.
limitations:
  - No real provider rate-limit event was observed during this review.
  - The profile owner attests primary contribution; the evidence does not independently establish detailed retry-policy authority.
needs_profile_owner_confirmation: false
external_use_candidate: safe
```

```yaml
claim_key: mise-local-first-architecture
statement: Helped shape a local-first architecture with SQLite data, device-secured provider keys, and no application account backend.
project: Mise
claim_type: architecture
ownership_candidate: primary
evidence_strength_candidate: weak
primary_evidence:
  - type: file
    locator: "[src/db/index.ts](./src/db/index.ts)"
    proves: The application opens and migrates an on-device SQLite database.
  - type: file
    locator: "[src/api/keyStore.ts](./src/api/keyStore.ts)"
    proves: Provider credentials use device secure storage.
  - type: document
    locator: "[README.md](./README.md)"
    proves: The repository describes a no-account, no-server product boundary.
limitations:
  - The profile owner attests primary contribution; final code does not independently prove the original rationale.
  - Commit authorship is split across several identities and agent-attributed commits, so detailed contribution allocation remains unverified.
needs_profile_owner_confirmation: false
external_use_candidate: safe
```

```yaml
claim_key: mise-apk-operations
statement: Participated in a repeatable Android APK build and test workflow.
project: Mise
claim_type: operations
ownership_candidate: primary
evidence_strength_candidate: weak
primary_evidence:
  - type: file
    locator: "[.github/workflows/android-apk.yml](./.github/workflows/android-apk.yml)"
    proves: The repository defines automated typecheck, test, prebuild, Gradle build, and artifact-upload steps.
  - type: commit
    locator: d34f9b8
    proves: A commit introduced the workflow.
  - type: commit
    locator: e6cb4af
    proves: A later commit corrected its Node runtime requirement.
limitations:
  - No CI run or artifact was inspected.
  - The profile owner attests primary operational contribution; tags do not prove an APK was built, installed, or distributed successfully.
needs_profile_owner_confirmation: false
external_use_candidate: safe
```

## 7. Decisions and trade-offs

| Decision | Context and visible alternatives | Consequences | Primary evidence | Profile-owner role |
| --- | --- | --- | --- | --- |
| Keep application data local and omit accounts | A server or sync layer was possible but excluded from the documented product boundary. | Simpler trust boundary and no multi-device sync. Provider requests still leave the device. | [README privacy boundary](./README.md#L165-L172), [provider transport](./src/api/transport.ts#L36-L62) | Not proven; confirmation required. |
| Use the user's provider key | Bundled service credentials were avoided. A development seed remains possible but unsafe for shared builds. | Users bear provider setup and billing. Credentials stay in SecureStore at runtime. | [key storage](./src/api/keyStore.ts#L4-L20), [build-time warning](./app.config.ts#L3-L14) | Not proven; confirmation required. |
| Retain `snap.db` after rename | Renaming the file without migration could hide existing local data. | Internal naming debt remains, but existing installs keep their database. | [src/db/index.ts](./src/db/index.ts#L6-L12) | Rationale is documented; personal role is not proven. |
| Apply append-only numbered migrations | Editing shipped migrations risks divergent local databases. | The schema now has 34 ordered migrations and reset complexity. | [src/db/schema.ts](./src/db/schema.ts#L1-L6), [migration list](./src/db/schema.ts#L763-L799) | Not proven; confirmation required. |
| Record reversible depletion only for home meals | Meal estimates and venue can be uncertain. Silent exactness would overstate confidence. | Home meals affect stock; restaurant meals do not. Ledger rows support reversal. | [depletion planner](./src/logic/depletionService.ts#L116-L134), [edit and delete reversal](./src/logic/depletionService.ts#L212-L233) | Not proven; confirmation required. |
| Normalize invalid shopping categories to `other` | Legacy or corrupt rows could crash grouping and rendering. Throwing would block access to local data. | The screen remains usable, but damaged categories can lose specificity. | [shop-crash design](./openspec/changes/archive/2026-08-25-fix-shop-crash/design.md#L18-L32) | Diagnosis and authority require confirmation. |
| Store only coarse foreground shop locations | Shop recognition needs approximate place data but not a movement history. | No background permission is configured. Coordinates remain sensitive. | [app.config.ts](./app.config.ts#L90-L103), [schema rationale](./src/db/schema.ts#L698-L706) | Not proven; confirmation required. |
| Bound retries and preserve manual fallback | Provider limits and mobile failures can block vision capture. Infinite or broad retries were avoided. | One rate-limit retry and one transient retry occur before surfaced recovery. | [src/api/transport.ts](./src/api/transport.ts#L70-L123), [src/api/vision.ts](./src/api/vision.ts#L66-L135) | Policy ownership requires confirmation. |
| Build sideloadable APKs before store distribution | Internal testing needs installable artifacts without store signing. | Workflow output uses debug signing and is intentionally not Play-ready. | [.github/workflows/android-apk.yml](./.github/workflows/android-apk.yml#L1-L14), [pre-publish status](./docs/pre-publish-checklist.md#L1-L6) | Operational role requires confirmation. |

## 8. Operational events and incidents

### Date-selection defect

- **Observed event:** Repository documentation says a module-load date could become stale and a saved meal could land on a different date than the visible list. See [the retained design](./openspec/changes/fix-day-selection/design.md#L1-L24).
- **Diagnosis:** The store held a date value without distinguishing a deliberate historical selection from following today.
- **Action:** Commits `b87870b` and `779382d` added following-state behavior and broader assertions.
- **Verified result:** The current automated suite passes, including [test/day-selection.test.ts](./test/day-selection.test.ts). The original standalone-APK scenario was not reproduced.
- **Profile-owner candidate role:** Unknown.
- **Missing evidence:** Reporter identity, affected-user count, device logs, and installed-build verification.

### Grocery-haul legacy-category crash or loading failure

- **Observed event:** The archived proposal records a crash or frozen state from legacy categories, stale sources, or unmapped titles in [the proposal](./openspec/changes/archive/2026-08-25-fix-shop-crash/proposal.md#L1-L12).
- **Diagnosis:** Invalid local rows could reach SQL mapping, grouping, and UI label lookup without safe normalization.
- **Action:** Commits `63f546c` and `e3898c8` added recovery and defensive fallback behavior.
- **Verified result:** The current suite passes [test/shopping-list-db.test.ts](./test/shopping-list-db.test.ts) and [test/shopping-list-ui.test.ts](./test/shopping-list-ui.test.ts). No corrupt device database was exercised in this review.
- **Profile-owner candidate role:** Unknown.
- **Missing evidence:** Original stack trace, precise reproducer, affected build, and confirmation of recovery on the original database.

### Vision rate limits and transient failures

- **Observed event:** The archived design records provider rate-limit and quota failures as the motivating condition in [the design](./openspec/changes/archive/2026-08-26-vision-fallback-resilience/design.md#L1-L16).
- **Diagnosis:** Transport retry existed, but the user-facing wait and manual continuation were incomplete.
- **Action:** HEAD added bounded retries, progress state, and manual-entry preservation.
- **Verified result:** [test/vision-retry.test.ts](./test/vision-retry.test.ts) passes within the complete suite. No real provider failure was induced.
- **Profile-owner candidate role:** Unknown.
- **Missing evidence:** Provider response logs, device observation, quota configuration, and real manual-fallback usability.

### Android workflow runtime correction

- **Observed event:** The workflow comments record that Node 20 cannot import the test harness's `node:sqlite` dependency in [.github/workflows/android-apk.yml](./.github/workflows/android-apk.yml#L36-L42).
- **Diagnosis:** The test runtime required Node 22.5 or later.
- **Action:** Commit `e6cb4af` changed the workflow to Node 22.
- **Verified result:** Local tests pass under the current environment. No historical or current GitHub Actions run was inspected.
- **Profile-owner candidate role:** Unknown.
- **Missing evidence:** Failed run URL, correction run URL, artifact identity, and owner involvement.

## 9. Outcome candidates

| Outcome candidate | Baseline | Current measurement | Source | Limitations and status |
| --- | --- | --- | --- | --- |
| Automated regression suite passes | No historical baseline was established in this review. | 139 files and 1,342 tests passed. | `npm test`, 2026-08-29 | Reproducible source-level result. It does not measure product quality, coverage, device behavior, or adoption. |
| TypeScript gate passes | No error-count baseline was established. | Exit status 0 with no diagnostics. | `npm run typecheck`, 2026-08-29 | Reproducible compile-time result. It does not prove bundling or runtime correctness. |
| Canonical OpenSpec specs validate | No prior invalid-count baseline was established. | 13 passed and 0 failed. | `openspec validate --specs`, 2026-08-29 | Reproducible structural result. It does not prove active change completion or product approval. |
| Forward schema reaches version 34 | Initial schema was migration 1. | `MIGRATIONS.length` is 34. | [src/db/schema.ts](./src/db/schema.ts#L763-L799) | Reproducible structural growth, not a user or business outcome. Migration on an existing device was not observed. |
| Sideloadable build path is defined | Initial commit had EAS configuration; commit `d34f9b8` added a GitHub workflow. | Workflow contains test, prebuild, Gradle, and artifact steps. | [.github/workflows/android-apk.yml](./.github/workflows/android-apk.yml#L33-L77) | **Unverified outcome.** A defined pipeline and APK tags do not prove successful current artifacts. |

No measured revenue, adoption, time saved, reliability rate, health improvement, or business impact appears in inspected primary evidence. Any such outcome remains unsupported.

## 10. Primary-evidence index

- [README.md](./README.md#L1-L43) proves the stated product purpose and premise. It does not prove user adoption or that every described behavior works.
- [README.md](./README.md#L99-L125) proves the documented provider-key workflow. It does not prove provider availability or correct billing guidance today.
- [package.json](./package.json#L1-L20) proves package identity, declared author metadata, Node floor, and verification scripts. Author metadata does not prove personal ownership of the repository.
- [app/_layout.tsx](./app/_layout.tsx#L74-L110) proves the current screen registry. It does not prove that every route renders successfully.
- [app/(tabs)/_layout.tsx](./app/(tabs)/_layout.tsx#L23-L58) proves the four-tab navigation definition. It does not prove device layout or accessibility.
- [app.config.ts](./app.config.ts#L16-L57) proves application identifiers and requested platform permissions. It does not prove store approval or runtime permission handling.
- [src/db/index.ts](./src/db/index.ts#L21-L47) proves SQLite open, migration, and seed sequencing. It does not prove successful migration of an existing device database.
- [src/db/schema.ts](./src/db/schema.ts#L763-L799) proves the ordered 34-migration schema. It does not prove that each historical migration shipped to users.
- [src/api/keyStore.ts](./src/api/keyStore.ts#L107-L155) proves current SecureStore operations for keys and endpoint configuration. It does not prove operating-system keychain security or absence of leaked historical keys.
- [src/api/transport.ts](./src/api/transport.ts#L36-L62) proves supported transport implementations. It does not prove provider compatibility at review time.
- [src/api/transport.ts](./src/api/transport.ts#L90-L123) proves bounded retry logic. It does not prove behavior against a live provider.
- [src/api/openFoodFacts.ts](./src/api/openFoodFacts.ts#L22-L49) proves an Open Food Facts request and response parser. It does not prove catalogue accuracy.
- [src/logic/depletionService.ts](./src/logic/depletionService.ts#L116-L233) proves planning, applying, editing, and reversing depletion. It does not prove estimate accuracy.
- [src/logic/stockRestock.ts](./src/logic/stockRestock.ts#L15-L51) proves the pure shopping-to-pantry restock plan. It does not prove operator use.
- [src/db/queries/analytics.ts](./src/db/queries/analytics.ts#L172-L220) proves which records enter a JSON export. It also identifies a sensitive-data boundary.
- [.github/workflows/android-apk.yml](./.github/workflows/android-apk.yml#L33-L77) proves the intended APK CI sequence. It does not prove any run passed.
- [docs/pre-publish-checklist.md](./docs/pre-publish-checklist.md#L1-L6) proves the repository's own statement that store publication is future work. It may become stale after this review.
- [test/depletion.test.ts](./test/depletion.test.ts) and [test/stock-restock.test.ts](./test/stock-restock.test.ts) prove regression cases exist and passed in the complete suite. They do not prove device integration.
- Commits `b4835f1`, `8e88c5e`, `882c77c`, `ab619c1`, `b507334`, `431c4bc`, `5180099`, `ec82598`, `1663a0a`, and `7808e2b` prove historical path changes. Their author fields do not prove sole ownership or personal identity.
- Tags `apk-release-20260806-8ed86f7` through `apk-debug-streamline-ux-ec82598` prove named milestone refs. They do not prove that matching artifacts remain available or were installed.

## 11. Verification commands and results

| Command | Exit | Important result | Proves | Does not prove |
| --- | ---: | --- | --- | --- |
| `git status --short --branch` before editing | 0 | `main` matched `origin/main`; no changed paths were listed. | Initial worktree was clean. | Remote state was current; no fetch ran. |
| `git log --all`, `git branch --all`, `git tag --list` | 0 | 122 reachable commits, four non-main remote branches, and 26 tags were inspected. | Locally reachable history and refs were available. | Server-side deleted refs, issue discussions, or un-fetched commits. |
| `npm test` | 0 | 139 test files passed; 1,342 tests passed; Vitest reported a future Vite native-config warning. | Current automated unit, contract, query, and source-inspection tests pass. | Device UI, provider calls, APK behavior, production, or complete coverage. |
| `npm run typecheck` | 0 | `tsc --noEmit` completed with no diagnostics. | Current TypeScript satisfies the configured static type gate. | Expo bundling, native compilation, or runtime behavior. |
| `openspec validate --specs` | 0 | 13 specs passed and 0 failed. | Canonical OpenSpec specs are structurally valid. | Active change completion, archived task accuracy, implementation parity, or product approval. |
| `git diff --check -- MASTER_PROFILE_EVIDENCE.md` | 0 | No output. The file is untracked, so this required command did not include its content. | The required command ran successfully. | Whitespace validity of the untracked content. |
| `git diff --no-index --check -- /dev/null MASTER_PROFILE_EVIDENCE.md` | 1 | No whitespace diagnostics; exit 1 is the expected no-index difference status for a new file. | The untracked file content has no whitespace errors. | Factual correctness, link semantics, or runtime behavior. |

No build, emulator, device, provider, network, CI, APK installation, deployment, or production verification was performed.

## 12. Uncertainties and contradictions

1. **Personal authorship and ownership:** The profile owner attests primary contribution for all six Section 6 candidates. Reachable commits use several author identities, including agent-attributed commits, so the identity mapping, detailed human/agent allocation, review depth, and decision authority remain unverified by the repository.
2. **History before the initial commit:** `b4835f1` contains a large application and documentation set. Earlier discovery, prototypes, and authorship are absent from reachable history.
3. **README query-layout drift:** [README.md](./README.md#L158-L161) says all SQL lives in `src/db/queries.ts`. The current checkout has modular files under [src/db/queries/](./src/db/queries/) and a compatibility barrel. The README convention is stale.
4. **Build-path drift:** [README.md](./README.md#L80-L95) emphasizes EAS preview builds, while [.github/workflows/android-apk.yml](./.github/workflows/android-apk.yml#L1-L14) describes local Gradle assembly in GitHub Actions. Both may be valid, but the preferred current distribution route is uncertain.
5. **Stale workstation instructions:** The Android build guide contains workstation-specific paths and environment examples. They were not copied here. The guide needs sanitation before external reuse.
6. **Vision design drift:** [the archived vision design](./openspec/changes/archive/2026-08-26-vision-fallback-resilience/design.md#L20-L27) names an older Gemini fallback example. Current provider choices differ in [src/api/keyStore.ts](./src/api/keyStore.ts#L34-L56). Treat the code as current behavior and the design as historical intent.
7. **OpenSpec status boundaries:** Thirteen canonical specs validate, but many active change folders remain. Structural validation does not establish which planned capabilities are implemented or accepted.
8. **Deployment maturity:** APK and pre-release tag names suggest distribution checkpoints. No artifact, signature, installation, upgrade, CI run, store listing, or external user was inspected.
9. **Runtime privacy:** Code confines keys to SecureStore and documents direct provider requests. This review did not inspect device backups, provider retention, transport capture, operating-system logs, or historical bundles.
10. **Health and food accuracy:** Nutrition, expiry, dietary, and body-composition logic has automated tests. Clinical validity, food-safety validity, and real-world input accuracy remain unverified.
11. **Ignored local environment:** An ignored `.env` file exists. Its contents were not read or copied. Whether it holds a live credential is intentionally unknown.
12. **Current remote parity:** `main` matched the locally stored `origin/main`, but no fetch ran. Remote parity after the last local fetch is unknown.
13. **Interview linkage:** The profile-owner attestation resolves the high-level ownership confirmation for Section 6. Unanswered Section 14 questions still limit detailed rationale, authority, runtime, adoption, incident, and outcome claims.

## 13. Confidentiality and external-use review

| Evidence group | Classification | Handling |
| --- | --- | --- |
| Public source architecture, generic feature names, tests, and commit SHAs | `safe` | May be discussed with repository-relative locators. Recheck repository visibility before external publication. |
| Profile, body measurements, dietary rules, fasting records, nutrition history, and goals | `local-only` | Describe schema categories only. Never include real records or exports. |
| Meal and pantry photos, receipt images, line items, prices, and shopping history | `local-only` | Do not reproduce fixtures that resemble personal data without review. Never expose real device data. |
| Provider API keys, ignored environment files, secure-store values, bundled build keys, and signing material | `redact` | Exclude values, fragments, screenshots, logs, and compiled bundles. The local `.env` was not inspected. |
| Custom provider endpoints and provider-account details | `redact` | Generic architecture is safe. A real endpoint, account identifier, quota, or billing state is not. |
| Shop names and stored coordinates | `redact` | The feature can be named. Real locations, movement implications, and coordinates require removal or aggregation. |
| Git author email addresses and local machine metadata | `redact` | Do not copy emails, usernames, home paths, or machine directory structure into profile material. |
| Product decision and competitive-analysis documents | `unknown` | Review for private reasoning, third-party screenshots, and attribution before external reuse. Cite only narrow non-sensitive facts here. |
| Open-data catalogue assets and third-party product records | `unknown` | Confirm source licences, attribution, and redistribution terms before external publication or portfolio screenshots. |
| APK and CI operational details | `safe` | The generic debug-build boundary is safe. Signing keys, private artifacts, account data, and internal logs remain redacted. |

No credential, token, key, cookie, personal record, customer financial detail, or raw proprietary dataset was copied into this file.

## 14. Guided-interview queue

The profile owner has confirmed primary contribution for all Section 6 candidates. These questions remain to improve independent evidence, detailed attribution, rationale, runtime proof, and outcome boundaries. Answers should preserve limitations and should not become polished stories without later approval.

### Ownership and authorship

1. Which Git author identities belong to you, and how did agent-generated commits enter your review workflow? This resolves all Section 6 ownership candidates and uncertainty 1.
2. What did you personally create before the initial commit, and is any earlier evidence available? This resolves uncertainty 2 and candidate `mise-local-first-architecture`.
3. For commits `b507334`, `431c4bc`, `e3898c8`, `1663a0a`, and `7808e2b`, which code, tests, and documents did you author, review, or direct? This resolves the implementation candidates in Section 6.
4. Were any capabilities primarily another person's or a team's work? Which claims must remain shared, supporting, or team outcomes?

### Requirements, stakeholders, and decisions

5. Was Mise an independent project, employment project, client engagement, or learning project? This resolves the dossier boundary in Section 2.
6. Who were the intended and actual users? Did anyone besides you install a build or provide feedback? This resolves adoption and stakeholder uncertainty.
7. What evidence led to the identity-first, local-first, and use-first depletion architecture? Which alternatives did you personally reject?
8. Who decided to use user-owned provider keys and no application backend? What privacy, cost, or operational constraints mattered?
9. Which features came from interviews, support requests, personal use, competitor analysis, or automated critique? Link each answer to a commit or document.

### Incidents and debugging

10. Who first observed the date-selection defect, on which build and device, and how did you reproduce it? This resolves the first Section 8 incident.
11. Did the grocery-haul crash occur on a real device database? Preserve the sanitized stack trace, input shape, fix validation, and affected build if available.
12. Did you personally diagnose the Node runtime failure in Android CI? Provide failed and successful run references if they can be shared.
13. Which live provider failures motivated the retry and manual-fallback work? Record sanitized error categories, not keys or account details.

### Operations, outcomes, and support

14. Which APK tags correspond to successful builds and installations? Who installed them, and did upgrades preserve existing SQLite data?
15. Was any build distributed outside personal testing? If yes, what distribution channel, support burden, and privacy notice applied?
16. What outcomes were actually measured? Possible evidence includes defect recurrence, task time, successful imports, or test-gate changes. Do not estimate missing numbers.
17. Did you train or support anyone using API keys, receipt review, pantry reconciliation, or APK installation? What durable support material exists?

### Reflection and relearning

18. What would you change now in the SQLite migration strategy, query modularization, provider abstraction, or local-first backup model?
19. Which trade-off was hardest: privacy versus cloud capability, estimate usefulness versus false precision, or breadth versus device validation?
20. Relearn and be ready to explain SQLite WAL, foreign-key migration ordering, transaction boundaries, and reversal ledgers. These concepts support the architecture candidates in Sections 4 and 7.
21. Relearn and be ready to explain Expo Router, native prebuild, Android signing, EAS versus Gradle builds, and why source tests do not prove an APK upgrade.
22. Relearn and be ready to explain SecureStore limits, build-time secret exposure, direct-provider privacy, retry classification, cancellation, and unvalidated custom endpoints.
23. Relearn and be ready to explain ingredient normalization, alias confidence, CJK matching, suggestion scoring, and the distinction between tested fixtures and measured quality.
24. Which parts are you comfortable discussing publicly, and which product decisions, datasets, locations, or operational details must stay local-only?
