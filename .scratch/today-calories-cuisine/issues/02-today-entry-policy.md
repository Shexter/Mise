# Choose how Today restores Meal plan or Calories

Type: grilling
Label: wayfinder:grilling
Status: resolved
Parent: ../map.md
Blocked by: none

## Question

Should ordinary Today entry remember the last chosen subtab, or always open Meal plan? Explicit meal-save navigation should open Calories in either case.

## Comments

8 September 2026: Asked the owner. Recommended remembering the last tab, with Meal plan as the first-use default. Planning and logging return destinations must override that preference. Tab restoration must remain separate from the existing date-following policy.

## Resolution

8 September 2026: Owner accepted the recommendation. Ordinary Today entry restores the last manually selected subpage; the first entry on an install with no stored preference opens Meal plan. Explicit route intent — a saved meal, a scheduled recipe, the onboarding Week handoff, an analytics/history return — always wins over the stored preference and is consumed once. The preference is presentation state only and does not change either page's date-following policy.
