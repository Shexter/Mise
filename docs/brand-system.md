# Mise brand system

## North star

Mise is a calm kitchen companion. It helps people keep ingredients, meals, and
decisions in their place. It is practical before expressive.

The name is pronounced like the English word “meez.” It refers to *mise en
place*: preparing and arranging what you need before cooking.

## Personality and voice

Mise is composed, specific, and quietly confident. It describes what it knows.
It states uncertainty plainly. It never uses body evaluation, health promises,
or a scolding tone.

Use short sentences and direct action labels. Prefer “Add to pantry” over
“Let’s get organised.” Prefer “Needs review” over “Almost there!”

## Positioning hierarchy

The preferred product promise from the Organic exploration is **“Cook from
what you have, tracked as you go.”** It connects pantry awareness, cooking, and
meal tracking without reading like a feature list. Use it as a headline or
supporting line where the full product needs to be introduced. Do not repeat it
inside routine task flows.

Privacy is the proof beneath that promise, not a vague lifestyle claim. Use
short, factual language such as **“On your phone. Nowhere else.”** only where
the surrounding copy explains the precise boundary: no account, no Mise
server, and local data deleted with the app. Provider requests still leave the
device when the person uses photo or receipt analysis, so never say that *all*
data or every photograph stays on the phone.

Store and screenshot copy may be more literal than the in-app lockup. The
exploration's sequence—capture, pantry, dinner, privacy—is a useful narrative,
but store metadata and campaigns remain outside this implementation change.

## Visual rules

| Role | Current token | Use |
| --- | --- | --- |
| Ground | `color.ground` | Main app background and low-emphasis areas. |
| Surface | `color.surface` | Cards, sheets, rows, and editable controls. |
| Ink | `color.ink` | Primary text, icons, and high-emphasis actions. |
| Muted | `color.muted` | Supporting text and quiet metadata. |
| Line | `color.line` | Hairlines and separated groups. |
| Action | `color.action` | Primary controls, focus, active navigation, and selected state. |
| On action | `color.onAction` | Content shown on the action colour. |
| Paprika | `color.paprika` | Protein meaning and destructive emphasis only. |
| Wheat | `color.wheat` | Carbohydrate meaning and warm secondary emphasis. |
| Olive | `color.olive` | Fat meaning, affirming emphasis, and pantry accents. |

The app icon uses supplied PNG artwork. Its lighter-dark iOS variant is the
original `2.png`; its pure-dark iOS variant is the original `7.png`. The
current release intentionally has no bespoke tinted iOS icon.

## Type, shape, and depth

- Use Fraunces for display moments only. Use Archivo for interfaces and body
  text.
- Caprasimo and Figtree remain an explored alternative. All three colour themes
  use Fraunces and Archivo so changing appearance does not change layout metrics.
- Use the existing `type`, `space`, `radius`, `elevation`, and `duration`
  exports in `src/constants/theme.ts`. Do not add screen-local values.
- Cards and sheets use quiet depth. Do not stack shadows or add decorative glow.
- Icons explain actions. They do not decorate labels that already state an
  action.

The Organic direction adds a useful shape and composition vocabulary: warm
grounds, left-aligned asymmetric layouts, generous negative space, soft
circles, over-rounded feature containers, and restrained pill controls. Apply
that vocabulary through semantic tokens and shared components. Do not turn
every control into a pill, reduce a touch target, or replace platform-native
interaction merely to match the web prototype.

## Colour themes

Mise offers three palettes through one semantic token contract. Organic is the
default. A saved local choice is resolved before static React Native styles are
created; changing it from Settings reloads the app once so every surface changes
together. Invalid or unavailable preferences fall back to Organic.

| Theme | Ground / surface | Ink / action | Semantic accents |
| --- | --- | --- | --- |
| Organic (default) | `#F3EDE4` / `#EBE3D8` | `#211F1D` / `#A95A35` | paprika `#A45239`, wheat `#B68A43`, olive `#74825F` |
| Utility | `#EDEAE4` / `#FFFFFF` | `#1C1A17` / `#1C1A17` | paprika `#8C3F2B`, wheat `#C8992F`, olive `#5C6B33` |
| Cool Organic | `#F2F1EC` / `#FAFAF7` | `#202522` / `#4F7067` | clay `#B96F4F`, wheat `#A98236`, olive `#6C7B52` |

Organic deliberately keeps the original cream, sand, terracotta, wheat, and
olive scheme. Its ground and supporting neutrals are less yellow than the ZIP
prototype; this is temperature correction, not a shift to a green-led scheme.
Themes may change colours only. Screen layout, behavior, data meaning, type,
shape, motion, and accessibility contracts do not fork by theme.

## Component mapping

| Component | Brand role |
| --- | --- |
| `Screen` | Ground, layout rhythm, and readable safe areas. |
| `Card`, `Field`, `Sheet` | Surface, line, controlled corner radius. |
| `Button`, `Fab` | Clear action hierarchy using semantic emphasis. |
| `Toast` | Honest pending, success, and error feedback. |
| `EmptyState` | A specific next action, never decorative filler. |
| `MealRow`, `DayRail`, `MacroBars` | Data-first hierarchy with no invented certainty. |

## State feedback

| State | Rule |
| --- | --- |
| Uncertain | State what needs review. Do not use optimistic decoration. |
| Pending | Preserve the previous content and show a clear working state. |
| Destructive | Use explicit copy and a deliberate confirmation boundary. |
| Disabled | Keep label contrast readable. Explain why an action is unavailable. |
| Success | Confirm the saved result without blocking the next action. |

The three macro dots may replace a generic spinner when Mise is actively
interpreting food, such as photo or receipt analysis. They are a functional
progress signature, not a divider or logo ornament. The state still needs a
plain-language status label, accessible busy semantics, a static reduced-motion
treatment, and a timeout or recovery path where the underlying operation has
one.

## Illustration language

Illustrations appear only in named empty, recovery, or milestone states. Each
one uses a simple kitchen object, warm ground, an ink outline, one semantic
accent, generous negative space, and useful alt text.

Initial approved roles are: empty pantry, first saved meal, capture needs a
better photo, and no dinner suggestion. The product does not use mascots,
medical imagery, body-evaluating imagery, or decorative animation.

For the empty-pantry role, the current brief is a single half-empty shelf with
an ink outline and one olive or sage accent. Pair it with a specific next
action, for example “Add what's already in your kitchen, or let a receipt do
it.” The brief is approved. Finished artwork is not yet approved.

Washed, desaturated photography may be used for editorial or marketing imagery
so it sits behind the interface. Never wash, recolour, or lower the contrast of
camera evidence, receipt images, meal photographs under review, or any image a
person uses to verify an analysis.

## App icon system

The supplied PNG collection is the visual authority. `2.png`, stored as
`dark-glass/mise-icon-dark-glass-navy-sage.png`, is the lighter-dark iOS
variant. `7.png`, stored as `dark-glass/mise-icon-dark-glass-monochrome.png`,
is the pure-dark iOS variant. They are used directly; there is no Figma source,
layer separation, SVG reconstruction, or Icon Composer work in this release.
Android uses original `1.png`, stored as
`light-organic/mise-icon-light-organic-sage-orange.png`, for its regular icon.
The earlier Android monochrome override is not used. On a Pixel 10a emulator,
Android 37.1's Minimal icon style rendered that legacy file as an unrelated
chevron-like glyph rather than a recognisable Mise bowl. Mise therefore falls
back to its full-colour icon until a purpose-built monochrome export is approved.

## Do and do not

| Do | Do not |
| --- | --- |
| Make the next kitchen action clearer. | Add generic wellness decoration. |
| Use semantic tokens and shared components. | Add raw colours or one-off spacing. |
| Keep supplied icon PNGs unchanged. | Rebuild or separate the icon into layers. |
| Use platform-appropriate controls. | Recreate iOS visual effects in Android UI. |
| State uncertainty directly. | Imply certainty with colour or motion. |

## Review board

The repository inventory, five-surface code baseline, token-direction
comparison, and launcher-size icon evidence are recorded in
[`docs/brand-review-board.md`](./brand-review-board.md). The owner selected the
three-theme model: reduced-warmth Organic is the default, with Utility and Cool
Organic available in Settings. Fraunces/Archivo and the shared geometry remain
constant across themes.

At 60 px, both selected iOS PNGs retain a readable bowl silhouette and centre.
The Android `1.png` remains readable inside circular and rounded-square masks,
but its outer bowl extends beyond the strict 66/108 adaptive foreground guide.
The release APK built on 2026-08-11 from the working tree based on `25c8991`
confirmed that the foreground remains recognisable and unclipped under the
Pixel 10a's circular and rounded-square launcher masks. The full-colour fallback
also remains recognisable with the Pixel's Minimal style enabled, and Android
App Info renders the bowl correctly. Share-sheet and notification icon surfaces
were unavailable because this build exposes neither a share target nor active
notifications. Additional OEM mask acceptance remains part of the owner device
pass. The other light-organic PNG remains an exploration rather than a silent
fallback.

Final device captures must compare Today with meals, empty Pantry,
capture/review, saved recipe, and Settings. Check light and dark appearance
where available, large text, reduced motion, VoiceOver or TalkBack, and real
launcher surfaces.

## Exploration disposition

The August Organic ZIP is integrated as a reference, with these boundaries:

- Carry forward the product-promise and privacy hierarchy, soft composition,
  candidate palette, functional macro-dot loader, and empty-pantry brief.
- Keep the approved glass-bowl PNG collection as the app-icon authority. The
  earlier spoon, steam, and monogram sketches are historical alternatives.
- Keep Fraunces/Archivo and one semantic token API. Use reduced-warmth Organic
  by default, with Utility and Cool Organic as selectable palettes.
- Do not treat prototype screens, Anthropic-only copy, widgets, store listings,
  or marketing concepts as accepted product scope.
