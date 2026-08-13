## Purpose

Improves receipt text extraction privately on the device, without requiring every user to download a large model or send receipt images to a remote OCR service.

## ADDED Requirements

### Requirement: Local OCR is optional and first-use downloadable

The app SHALL ship without a mandatory receipt OCR model in the base artifact. When a user first requests local OCR, the app SHALL explain the approximate download size and ask for confirmation before downloading the selected model. The receipt flow SHALL remain usable if the user declines.

#### Scenario: First receipt requests local OCR
- **WHEN** the user chooses to improve a receipt with local OCR and no model is installed
- **THEN** the app explains that an offline model will be downloaded, shows its approximate size, and offers Download or Continue without OCR

#### Scenario: User skips the model
- **WHEN** the user declines the download
- **THEN** the app continues with the existing receipt extraction/manual path and does not block pantry use

#### Scenario: Model download completes
- **WHEN** the confirmed model download succeeds
- **THEN** the model is marked installed locally and future OCR runs can operate without network access

### Requirement: OCR processing remains on-device

When local OCR is selected and its model is available, the app SHALL process the receipt image on-device and SHALL NOT upload the receipt image or OCR text as part of that operation. OCR output SHALL remain local temporary data until the existing receipt review/persistence flow decides what to retain.

#### Scenario: Offline installed model reads a receipt
- **WHEN** the device is offline and the local model is installed
- **THEN** OCR runs locally and returns a draft without a network request

#### Scenario: Local OCR failure
- **WHEN** local OCR cannot read the image or the device cannot run the model
- **THEN** the app reports the failure and offers the existing provider/manual fallback without silently discarding the receipt

### Requirement: OCR output carries structure and uncertainty

The OCR interface SHALL return recognized text lines with stable reading order, bounding geometry when available, and confidence metadata. The receipt parser SHALL be able to distinguish OCR output from semantic interpretation and SHALL not treat OCR confidence as food identity confidence.

#### Scenario: Dense receipt preserves line order
- **WHEN** OCR recognizes a receipt with multiple columns and wrapped lines
- **THEN** the returned draft preserves enough ordering/geometry for the parser and review screen to associate item text with adjacent quantity and price text

#### Scenario: Low-confidence line remains reviewable
- **WHEN** a line has low OCR confidence
- **THEN** it remains visible and editable in receipt review rather than being silently omitted or auto-applied

### Requirement: Model lifecycle is visible and recoverable

Settings and receipt capture SHALL expose the model state as not installed, downloading, installed, unavailable, or failed. The user SHALL be able to retry a failed download, remove an installed optional model, and return to the fallback path.

#### Scenario: Download fails
- **WHEN** model installation fails because of connectivity, storage, or platform availability
- **THEN** the app shows a recoverable error, preserves the receipt flow, and offers Retry and Continue without OCR

#### Scenario: User removes the model
- **WHEN** the user removes the optional OCR model from Settings
- **THEN** the local model files are deleted, receipt capture remains available, and the next OCR request explains the download again

### Requirement: OCR never bypasses receipt review

Local OCR SHALL feed the existing receipt parser, resolver, and review UI. OCR-derived lines, quantities, prices, and classifications SHALL remain editable, and pantry/spending mutations SHALL occur only after explicit user confirmation.

#### Scenario: OCR result enters review
- **WHEN** local OCR produces a receipt draft
- **THEN** the user sees the structured result and can edit, exclude, or retry lines before applying it

#### Scenario: Corrected OCR line is applied
- **WHEN** the user corrects an OCR line and confirms the receipt
- **THEN** the corrected value, not the original OCR guess, is used for pantry and spending writes while source provenance remains available
