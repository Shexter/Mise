# dedicated-shop-tab Specification

## Purpose

Elevates grocery haul management, nearby shop detection, and receipt auditing to a primary, first-class tab in the bottom navigation.

## Requirements

### Requirement: Dedicated bottom tab for shopping and receipts

The app navigation SHALL expose a primary `Shop` tab in the bottom bar alongside `Today`, `Pantry`, and `Settings`.

#### Scenario: User navigates to Shop tab
- **WHEN** the user taps the Shop icon in the bottom navigation bar
- **THEN** the Shop screen opens with the grocery checklist, nearby shop detection link, and receipt audit shortcuts
- **AND** the view does not depend on nested segments inside Pantry

### Requirement: Streamlined Pantry tab hierarchy

The Pantry screen SHALL focus exclusively on kitchen inventory and recipe collections, removing the Shop and Receipts sub-segments from its internal segment switcher.

#### Scenario: User visits Pantry tab
- **WHEN** the user visits the Pantry tab
- **THEN** the view offers clear segments for Kitchen Stock and Saved Recipes
- **AND** does not display nested Shop or Receipt switcher options
