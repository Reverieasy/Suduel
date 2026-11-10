# SUDUEL V2 design system

## Inspected Figma source

File: https://www.figma.com/design/NKTF0YPvaohA9AhBmF46fe/Suduel

The actual editable hierarchy, generated layer/style context and screenshots
were read through the connected Figma integration. Main references:

| V2 reference | Node |
| --- | --- |
| Arcade website page | 14:2 |
| Landing | 16:2 |
| Mode selection | 16:171 |
| Solo practice | 18:2 |
| Mobile compact arena | 20:120 |
| Registration / sign-in | 19:158 / 25:67 |
| How to play | 19:241 |
| Arcade design system | 14:21 |
| Gameplay UX handoff | 72:2 |

V1 pages were not used as the implementation foundation. No Figma file was
edited. Public icons from the mode-selection frame are downloaded in
`public/figma/`; there are no temporary Figma asset URLs in application code.

## Shared tokens

`src/styles/index.css` defines the palette in Tailwind's existing CSS-first
`@theme static` block. Component CSS uses the same variables.

| Token | Value | Role |
| --- | --- | --- |
| background | #081523 | Canvas |
| surface | #0E1A2B | Header |
| card | #101F32 | Cards |
| elevated | #13253B | Raised controls |
| dark-panel | #0B192A | Secondary panels and board |
| border | #29425E | Panel and cell borders |
| primary | #149FFF | Player and actions |
| opponent | #FF4658 | Rival and errors |
| accent | #FFD03B | Energy and highlights |
| success | #2FCB99 | Success |
| freeze | #B379FF | Future Freeze |
| scramble | #FFA939 | Future Scramble |
| foreground | #F6F8FF | Primary text |
| muted-foreground | #96AAC3 | Secondary text |

Bright filled action buttons use dark navy text for readable contrast.
Grid box separators use a brighter neutral than individual cell lines.

## Typography and spacing

- Russo One: naturally flowing branding, page and card headings, primary actions.
- Oxanium: board digits, timer labels, controls and statistics.
- Inter: body copy, forms and navigation.
- Font assets are bundled from Fontsource, with system fallbacks.
- Spacing is based on 4/8/12/16/24/32/48px; most panels use 24 or 28px padding.
- Headings use normal tracking; the wordmark uses a restrained -0.02em.
- Large SUDUEL lettering is centered independently of its decorative pixel mark.
  The mark sits to the left without offsetting the text's center.
- Components use CSS Grid and Flexbox. Absolute positions are limited to
  decorations, in-cell focus treatment, and the board's pause overlay.

## Intentional corrections and phase differences

Separate Figma letter/word layers were replaced by flowing text and color spans;
there are no individually positioned letters. Navigation and button labels use
normal font metrics and centered flex alignment. Container padding, card gaps,
borders, and breakpoints are shared instead of copying inconsistent coordinates.

The landing preserves navy surfaces, tilted blue/red boards, square accents,
large centered branding, the tagline and the three feature cards. Decorative
boards are valid 9x9 grids rather than reproducing incomplete conceptual grids.
Phase 2 account fields and private Classic Race controls are now connected to
Supabase. Battle and ranked modes remain Coming Soon. Guest practice is prominent.
Fake profile initials, rank badges and opponents from
reference frames are not presented as real user data.

## Responsive and accessible behavior

Breakpoints at 1200/900/700px adapt layout, while widths 390/768/1024/1440px are
covered by browser tests. The mobile practice board occupies available width;
statistics and actions flow below it. Keyboard legends are omitted on narrow
screens, and touch number/notes/erase/undo controls remain available.

Reduced-motion styles remove transitions and the loading animation. Focus rings,
semantic grid roles, roving tab order, text feedback, native dialog focus handling,
visible error underlines and a skip link support accessible interaction.
Manual screen-reader, device and cross-browser review remains a release task.
