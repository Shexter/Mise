# User-owned editing coverage

This matrix is the implementation inventory for `add-app-wide-editing`. A
user-supplied field is editable; derived, audit, and raw-source fields are not
edited in place. Each row names the owning surface that must refresh after a
save.

| Record | Add/review surface | Edit surface | User-owned fields | Derived state to refresh |
|---|---|---|---|---|
| Pantry item | Pantry add, receipt/barcode apply | Pantry item sheet | canonical identity, location, acquired date, typed quantity/unit | expiry/status, dinner, recipe gaps, shopping, analytics |
| Logged meal | Photo/manual/review | Meal detail editor | meal name/type, venue, servings, date, meal-item identity/quantity | macros, depletion, history, analytics |
| Saved recipe | Recipe intake | Recipe detail | title, steps, ingredients, stated quantities/identity | recipe gaps, dinner suggestions |
| Capture result | Receipt/barcode review | Review before apply | resolved identity, quantity, location, expiry/date | pantry rows and provenance |
| Shopping item | Manual add or source refresh | Shopping row/detail | name, requested quantity/unit, note, category, status | grouping, source display, open count |
| Profile/preferences | Onboarding/settings | Existing settings screens | user-entered goals, targets, theme, units, restrictions | targets, labels, analytics presentation |

The first implementation slice is Pantry. Meal editing already has a domain
transaction and is the reference for later alignment; capture, recipe, and
shopping-list rows are subsequent slices.
