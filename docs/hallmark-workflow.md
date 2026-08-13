# Hallmark workflow

Mise uses the project-scoped [Hallmark](../.agents/skills/hallmark/SKILL.md)
skill for future visual design, theme, and UI direction work. This is a standing
repository convention, not a one-off inspiration pass.

## Always apply

- Start from a short visual brief and choose a deliberate direction before
  editing UI code.
- Keep the existing semantic token contract in `src/constants/themePalettes.ts`
  and `src/constants/theme.ts`. Components consume roles such as `ground`,
  `surface`, `ink`, `action`, and `onAction`; they do not introduce screen-local
  hex values, typography, spacing, or geometry.
- Use the Hallmark rules for palette contrast, type hierarchy, 4-point spacing,
  interaction states, reduced motion, and a final anti-pattern/slop review.
- Treat the default Organic theme as the product baseline. Experimental ideas
  belong in an explicitly opt-in theme or an exploration document until accepted.
- Preserve platform-native behavior, touch targets, accessibility semantics,
  and the app's data meaning while exploring visual form.

## Theme boundaries

Mise currently has five selectable palettes:

1. **Organic** — default, reduced-warmth cream and terracotta.
2. **Utility** — quiet putty, white, ink, and olive.
3. **Cool Organic** — neutral stone with juniper accents.
4. **Test Lab** — experimental indigo, lilac, coral, amber, and teal.
5. **Coolors** — the supplied aqua, mint, pink, berry, and plum palette
   ([Coolors source](https://coolors.co/ddfff7-93e1d8-ffa69e-aa4465-462255)).

Test Lab and Coolors are safe sandboxes for unusually bold palette or hierarchy
ideas. They must remain opt-in, use the same semantic roles, and remain readable
in light mode and on Android. A successful experiment can later be distilled
into the production themes; do not silently change Organic to test an idea.

## Review checklist

Before handing off a visual change, verify:

- every new colour is a named semantic token;
- primary text, muted text, borders, and actions retain usable contrast;
- loading, empty, error, pressed, disabled, and reduced-motion states still
  communicate clearly;
- Today remains calm and information-first; dense analytics belong on Analytics;
- the change is documented in the relevant brand or OpenSpec artifact when it
  changes product direction.

The Hallmark skill is installed at `.agents/skills/hallmark` by the `skills`
installer and should be refreshed through that installer rather than copied
manually into the repository.
