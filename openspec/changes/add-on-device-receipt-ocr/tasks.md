## 1. Contract and research

- [ ] 1.1 Inventory the existing receipt/unified-capture extraction, review, queue, and fallback seams; document integration points and decisions 8, 21, 55, 60, 111, and 113.
- [ ] 1.2 Define OCR model state, engine, line geometry, confidence, temporary-data retention, and fallback types with platform-neutral tests.
- [ ] 1.3 Build a receipt fixture corpus covering tiny type, columns, wrapped lines, blur, skew, lighting, totals, non-food lines, and Latin/CJK candidates; record baseline extraction quality.

## 2. Local image and OCR pipeline

- [ ] 2.1 Implement local crop, perspective, contrast, and sharpening preprocessing with bounded memory and temporary-file cleanup.
- [ ] 2.2 Add Android ML Kit dynamic model lifecycle: availability, explicit download, progress/cancel, retry, remove, offline use, and Google-services-unavailable state.
- [ ] 2.3 Add Android OCR adapter returning ordered lines, geometry, confidence, and engine metadata without network calls during recognition.
- [ ] 2.4 Add iOS Vision OCR adapter behind the same contract, with recognition-language configuration and accuracy mode.
- [ ] 2.5 Add pure line-ordering, confidence-band, and fallback decisions; keep OCR confidence distinct from canonical match confidence.

## 3. Receipt integration and UX

- [ ] 3.1 Integrate local OCR as an opt-in first-use/recovery pass into the existing receipt service without bypassing semantic parsing or review.
- [ ] 3.2 Add first-use download sheet with approximate size, Download, Continue without OCR, progress, cancel, retry, and unavailable states.
- [ ] 3.3 Add Settings model management: installed status, size, language pack, remove, and retry.
- [ ] 3.4 Show low-confidence OCR lines and geometry-aware grouping in receipt review; preserve edit, exclude, retake, and provenance behavior.
- [ ] 3.5 Ensure unified capture routes receipt-shaped input to OCR only when selected/available and never sends local OCR data to a provider implicitly.

## 4. Verification and release decision

- [ ] 4.1 Add no-network tests proving installed local OCR does not call provider transports and fallback remains usable.
- [ ] 4.2 Add download-failure, cancellation, removal, restart, offline, low-storage, and no-Google-services tests/fakes.
- [ ] 4.3 Run receipt fixture comparisons and report line recall, total accuracy, food/non-food classification impact, and review correction rate.
- [ ] 4.4 Measure base APK, arm64 APK, installed model storage, first-use download time, and cold-start/runtime impact; record bundled versus dynamic recommendation.
- [ ] 4.5 Run typecheck, full test suite, strict OpenSpec validation, and `git diff --check`.
- [ ] 4.6 Perform owner Android/iOS checks across first-use download, skip, offline OCR, failed download, model removal, large text, themes, screen readers, and receipt review correction.
- [ ] 4.7 Update the receipt/unified-capture handoffs and queue with measured accuracy, model sizes, release choice, and remaining platform evidence.
