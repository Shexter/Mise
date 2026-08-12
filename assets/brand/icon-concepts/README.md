# Mise icon concepts

These PNGs are the approved icon source collection. They must not be rebuilt,
recoloured, separated into layers, or converted into a Figma/Icon Composer
source. A selected file is resized or copied into the existing platform asset
slots only after device review.

All images are PNG files at 1254 x 1254 pixels, imported from `Full Icon set.zip`
on 2026-08-11.

## Light organic

| File | Description |
| --- | --- |
| `light-organic/mise-icon-light-organic-sage-orange.png` | Original `1.png`; approved Android regular icon, with creamy parchment, sage glass bowls, and an orange centre. |
| `light-organic/mise-icon-light-organic-warm-umber.png` | Brighter warm organic glass variant with a restrained umber palette. |

## Dark glass

| File | Description |
| --- | --- |
| `dark-glass/mise-icon-dark-glass-navy-sage.png` | Original `2.png`; approved lighter-dark iOS icon variant. |
| `dark-glass/mise-icon-dark-glass-umber-orange.png` | Dark espresso glass with an orange centre. |
| `dark-glass/mise-icon-dark-glass-umber-orange-alt.png` | Alternate dark umber-and-orange treatment. |
| `dark-glass/mise-icon-dark-glass-navy-smoke.png` | Navy background with neutral smoky glass. |
| `dark-glass/mise-icon-dark-glass-monochrome.png` | Original `7.png`; approved pure-dark iOS icon variant. |

## Production path

For the current release, configure Expo's `ios.icon.light` with the original
`2.png` file and `ios.icon.dark` with the original `7.png` file. Do not set a
tinted variant. Configure Android's regular and adaptive foreground image from
original `1.png`. Before shipping, inspect both iOS variants at 60 px on an
iPhone, then test the Android export under circular and squircle launcher masks.
