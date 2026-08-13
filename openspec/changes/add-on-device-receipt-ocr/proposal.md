## Why

Receipt reading is one of Mise’s highest-value input paths, but photographs vary in lighting, angle, paper quality, and tiny type. A cloud OCR provider could improve extraction while weakening the local-first promise and exposing shopping history. On-device OCR gives Mise a stronger receipt-reading foundation without uploading the receipt, while an optional first-use model download keeps the initial APK small for people who never scan receipts.

## What Changes

- Add an optional on-device receipt OCR capability, downloaded only when the user first requests receipt improvement or enables it in Settings.
- Use the platform-appropriate local engine: ML Kit Text Recognition on Android and the native Vision framework on iOS, behind one Mise receipt-OCR interface.
- Preprocess receipt images locally with crop, perspective correction, contrast, and sharpening before recognition.
- Preserve line text, ordering, bounding boxes, and recognition confidence as temporary local extraction data for the existing receipt parser/review flow.
- Show clear model states: not installed, downloading, installed, unavailable, failed, and retry/remove controls.
- Keep the existing receipt vision/manual path available when the user skips the model, is offline before download, or the local OCR result is insufficient.
- Never upload receipt images or OCR text as part of local OCR; any configured provider fallback remains an explicit separate path.
- Keep OCR output editable and require review before pantry or spending changes are applied.

## Capabilities

### New Capabilities

- `on-device-receipt-ocr`: Private, local receipt text recognition with optional first-use model installation and graceful fallback.

### Modified Capabilities

- `receipt-import`: Receipt extraction can use local OCR as a first or recovery pass while preserving review, correction, reconciliation, and offline behavior.
- `unified-capture`: The unified Add to pantry route can offer local OCR for receipt-shaped captures without exposing a separate provider requirement.

## Impact

- Native Android/iOS configuration and a small platform bridge exposed to TypeScript.
- Receipt image preprocessing and extraction orchestration under `src/logic/`, `src/media/`, and receipt services.
- Receipt capture/review and Settings UI for first-use download, model status, fallback, and retry.
- Temporary/local OCR result types, confidence handling, tests, and owner device acceptance.
- APK/IPA size and first-use storage/download behavior; measure both before choosing bundled versus dynamic model packaging.
- No new account, server, receipt upload, or cloud OCR dependency is introduced by this change.

## Non-goals

- Replacing the existing semantic receipt parser or canonical resolver with OCR alone.
- Automatically applying OCR results without review.
- Shipping every script/language model in the initial app. Start with the smallest required script pack and add others deliberately.
- Cloud OCR, receipt analytics, merchant accounts, or cross-device model synchronization.
