---
name: PascalIA
description: "Ideas que hacen florecer tu organización": warm white and cream pages, yellow for action, graphite for results, and the original six-petal PascalIA flower.
colors:
  yellow: "#FFC107"
  yellow-hover: "#FFB300"
  yellow-soft: "#FFD54F"
  gold-ink: "#8A6100"
  graphite: "#1F1F1F"
  graphite-deep: "#181818"
  muted: "#5C5C5C"
  gray: "#E9E9E9"
  cream: "#FFF8E1"
  cream-line: "#F3E7BE"
  white: "#FFFFFF"
typography:
  display:
    fontFamily: "Montserrat, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "clamp(2.5rem, 6vw, 4.75rem)"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Montserrat, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "clamp(2rem, 4vw, 3.25rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Montserrat, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "clamp(1.35rem, 2.2vw, 1.75rem)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  figure:
    fontFamily: "Montserrat, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "clamp(2.6rem, 5vw, 4rem)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  lead:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "clamp(1.0625rem, 1.6vw, 1.25rem)"
    fontWeight: 400
    lineHeight: 1.65
  body:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Montserrat, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.1
  fine:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.65
rounded:
  field: "12px"
  tile: "14px"
  inner: "16px"
  item: "18px"
  window: "20px"
  panel: "24px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "22px"
  lg: "36px"
  xl: "64px"
  section-sm: "72px"
  section: "104px"
  wrap: "1200px"
components:
  button-primary:
    backgroundColor: "{colors.yellow}"
    textColor: "{colors.graphite}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "14px 28px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.yellow-hover}"
    textColor: "{colors.graphite}"
  button-dark:
    backgroundColor: "{colors.graphite}"
    textColor: "{colors.white}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "14px 28px"
    height: "48px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.graphite}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "14px 28px"
    height: "48px"
  button-ghost-hover:
    backgroundColor: "{colors.cream}"
  button-outline-on-dark:
    backgroundColor: "transparent"
    textColor: "{colors.white}"
    rounded: "{rounded.pill}"
    padding: "14px 28px"
  button-sm:
    rounded: "{rounded.pill}"
    padding: "10px 20px"
    height: "40px"
  play-dot:
    backgroundColor: "{colors.yellow}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.pill}"
    size: "48px"
  chip:
    backgroundColor: "{colors.white}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.pill}"
    padding: "10px 18px"
  chip-hover:
    backgroundColor: "{colors.cream}"
  chip-picked:
    backgroundColor: "{colors.yellow}"
    textColor: "{colors.graphite}"
  option:
    backgroundColor: "{colors.white}"
    textColor: "{colors.muted}"
    rounded: "{rounded.pill}"
    padding: "10px 18px"
    height: "44px"
  option-checked:
    backgroundColor: "{colors.yellow}"
    textColor: "{colors.graphite}"
  askbar:
    backgroundColor: "{colors.white}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.pill}"
    padding: "8px 8px 8px 12px"
    height: "68px"
  input-field:
    backgroundColor: "{colors.white}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.field}"
    padding: "11px 13px"
  card-window:
    backgroundColor: "{colors.white}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.window}"
  card-result:
    backgroundColor: "{colors.graphite}"
    textColor: "{colors.white}"
    rounded: "{rounded.panel}"
    padding: "36px"
  card-faq:
    backgroundColor: "{colors.white}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.item}"
    padding: "20px 22px 20px 26px"
  nav-link:
    textColor: "{colors.muted}"
    typography: "{typography.label}"
  nav-link-hover:
    textColor: "{colors.graphite}"
---

# Design System: PascalIA

> **Scope.** This system is recorded from the redesigned MesaViva sales page (`/mesaviva/`: `mesaviva.css`, `mesaviva.js`, `mesaviva/img/`), the first surface built in the PascalIA corporate world fixed by the owner's brand sheet. It is the system going forward for pascalia.lat. **The other pages (home, `/desarrollos/`, `/cuentafacil/`, the public health suite pages, legal pages) have not been migrated to it yet**: they still run on `sitio.css` / `pascalia.css` / `inicio.css`, which share the brand palette but use older components. Do not read those stylesheets as the reference for new work. Sub-brands keep their own identities (CuentaFacil green with its calendar-with-check logo, NANA DNT's own logo and palette, Misión Médica's official module logo); this system frames them as PascalIA, it does not repaint them.

## Overview

**Creative North Star: "The Idea That Blooms"**

PascalIA pages are bright, warm and conversational. White carries most of the page, cream (#FFF8E1 family) marks alternating sections and inner panels, and graphite takes over only where something resolves: the recommended plan, the strip of rules, the closing call, the footer. Yellow is not a background color; it is the color of doing something (buttons, the send button, picked chips, checked options), of emphasis (the marker drawn under a key phrase) and of the flower mark. Everything interactive is round: pills and circles, never sharp corners.

The signature is the original PascalIA flower (`/flower.svg`): six pointed petals in Amarillo PascalIA at 82 % fill opacity, so their overlaps read slightly deeper, with curved white veins running out from the center and white nodes at the vein tips. It is the logo mark, it turns slowly and very faintly behind the hero, it blooms from the corner of the graphite result card, and it watermarks the footer. Pascal, the 3D character in the yellow cap, is a real presence on the page, always in the site's own art from `/pascal/`: his face is the avatar in the ask bar and in his replies, a yellow full-body panel of him leans into the hero as a tilted card, and a wink panel stands beside the FAQ.

The page feels like a conversation you can touch: an ask bar where you write to Pascal, suggestion chips, white interface mockups that assemble themselves as you scroll, and numbers set in Montserrat with tabular figures so sums line up. Density is relaxed: sections breathe at 104px, cards have 22–36px of padding, and text sits at 1.65 line height.

**Key Characteristics:**
- White page with cream sections; graphite reserved for results and closings.
- Yellow means act, mark or bloom; text on yellow is always graphite.
- Pills (999px) for everything you press; 20–24px corners for containers.
- Hairline 1px gray outlines drawn as inset shadows, plus soft warm-neutral lift.
- Montserrat 600–800 for voice and numbers, Inter 400–500 for reading.
- The original pointed-petal flower and Pascal (site art) as the two recurring brand figures.

## Colors

A sunny yellow family over white and cream, grounded by near-black graphite and a single mid-gray for secondary text.

### Primary
- **Amarillo PascalIA** (`yellow`): the flower mark (at 82 % fill opacity), primary buttons, the ask-bar send button, play dots, picked chips and checked options, check bullets, the highlighter marker under key phrases, the active nav underline, progress bars, and the large figures on graphite.
- **Amarillo Hover** (`yellow-hover`): hover state of every yellow control, the input caret and typing cursor, small stroke accents (ticks, chip icons in the marquee).
- **Amarillo Suave** (`yellow-soft`): the light end of the brand gradient (`yellow-soft → yellow → yellow-hover`, 135deg) used on the small floating dots in the hero and on the split fill bars (never on the flower, which is flat yellow); text selection; secondary highlight lines on graphite.
- **Tinta Dorada** (`gold-ink`): the only yellow-family tone allowed to carry meaning on white at small size (a status icon inside a cream badge). Use sparingly.

### Neutral
- **Gris Grafito** (`graphite`): all headings and body ink; the dark surfaces (result card, rules strip, closing section, demo phone frame); the dark button; focus outlines on light surfaces.
- **Grafito Profundo** (`graphite-deep`): the footer only, under a faint flower watermark.
- **Texto Muted** (`muted`): subtitles, secondary paragraphs, nav links at rest, captions, table headers.
- **Gris Claro** (`gray`): every hairline: card outlines, list dividers, chip outlines, table rules, empty progress tracks.
- **Crema** (`cream`): alternating section bands, inner panels, hover fill for ghost buttons and chips, the active step background, icon tiles.
- **Línea Crema** (`cream-line`): the hairline used on cream-on-cream containers (the demo stage, icon tiles on cream).
- **Blanco** (`white`): page background and every card, window and bubble.

### Named Rules
**The Graphite-On-Yellow Rule.** Text and icons on any yellow fill are graphite. Never white on yellow.

**The Yellow Means Act Rule.** Yellow fills are for controls, selected state, the marker and the flower. Large yellow areas appear only as low-opacity glows (the hero radial at 14 %, the spotlight at 16 %), as the flower itself, or as Pascal's yellow art panels, never as a section background.

**The Graphite Resolves Rule.** Dark surfaces are reserved for the moment something resolves: the recommended plan, the rules, the closing call and the footer. On graphite, the big figures and the plan name turn yellow; secondary text steps down through light grays.

## Typography

**Display Font:** Montserrat 600/700/800 (with system-ui, -apple-system, Segoe UI, Roboto, sans-serif)
**Body Font:** Inter 400/500/600 (with the same system stack)

**Character:** Montserrat at 800 is the brand's confident, rounded geometric voice (the logo wordmark, the hero, plan names, figures); Inter keeps long Spanish sentences easy to read on a phone.

### Hierarchy
- **Display** (800, clamp 2.5–4.75rem, 1.05, -0.02em): the hero headline only, max 13ch, balanced, words rise in one by one.
- **Headline** (700, clamp 2–3.25rem, 1.1, -0.02em): section headings, centered over a 720px header block with a muted lead under it. The closing headline goes to 800.
- **Title** (700, clamp 1.35–1.75rem, 1.2, -0.01em): story beats, rows, step titles (steps at 1.25rem).
- **Figure** (800, clamp 2.6–4rem, 1, tabular figures): rule numbers on graphite, plan name in the result card (clamp 2.4–3.25rem), totals inside mockups (1.6rem). All money and counts use tabular figures in Montserrat.
- **Lead** (Inter 400, clamp 1.0625–1.25rem, muted): hero subtitle (max 36em), section intros at 1.125rem.
- **Body** (Inter 400, 1.0625rem, 1.65): paragraphs, max about 30em beside a mockup.
- **Label** (Montserrat 600, 0.9–1rem): buttons, nav links, tabs, chips in option groups, pills, window-bar captions.
- **Fine** (Inter 0.875rem, muted): disclaimers such as "Pagos, documentos DIAN y mensajes de la demo son simulados."

### Named Rules
**The Two Voices Rule.** Montserrat speaks (headings, labels, buttons, numbers); Inter explains (paragraphs, chips you can type, inputs). Do not set paragraphs in Montserrat or headings in Inter.

**The One Marker Rule.** At most one phrase per heading gets the yellow highlighter (a band from 58 % to 90 % of the line height), and it draws itself left to right on reveal (900ms). On graphite, emphasis is yellow text instead of a marker.

## Layout

A centered 1200px wrap with a 16px minimum gutter on each side. The hero is centered and stacked (status pill, headline, subtitle, CTAs, ask bar with tabs and chips), with Pascal standing at the left edge of the ask bar on wide screens (hidden below 1080px). Content sections alternate white and cream bands at 104px vertical padding (72px below 860px). Story and feature rows are two-column grids (1fr/1.1fr or 1fr/1fr, 64px gap) that alternate sides with `flip`, and collapse to one column below 860px with the copy first. Section headers are centered, max 720px, 56px above the content.

The plan configurator is a 1.15/0.85 split with the graphite result card sticky on the right; it stacks below 1080px. The method section uses a sticky preview panel on the right that changes with the active step; on phones the panel is removed and every step shows at full opacity. The FAQ uses a 0.8/1.2 split with a sticky heading. The rules strip and values strip are four equal columns divided by 1px rules, becoming 2×2 on phones.

Breakpoints observed: 1240px (Pascal shrinks), 1080px (Pascal hidden, stacked configurator and stage), 860px (mobile nav, single columns), 520px (plan table becomes cards, simplified mockups). Navigation is sticky at 72px and compresses to 60px with a frosted white background once scrolled.

## Elevation & Depth

A light hybrid: surfaces are outlined with a 1px gray inset shadow (never a CSS border on cards) and lifted with a soft, low-contrast neutral shadow. The yellow glow shadow belongs to yellow controls only. Graphite cards use a deeper lift. Depth also comes from layering: white cards on cream panels, cream badges inside white cards, the translucent flower behind the hero.

### Shadow Vocabulary
- **Card** (`box-shadow: 0 8px 24px rgba(31,31,31,.08)`): default lift for windows, bubbles, open FAQ items, tickets, the status pill. Always paired with the 1px gray inset outline.
- **Brand glow** (`box-shadow: 0 10px 30px -10px rgba(255,193,7,.55)`): primary button on hover, play dots, back-to-top, send button on hover.
- **Lift** (`box-shadow: 0 22px 48px -18px rgba(31,31,31,.28)`): the graphite result card.
- **Ask bar** (`box-shadow: inset 0 0 0 1px #E9E9E9, 0 18px 44px -20px rgba(31,31,31,.25)`): turns into a 2px yellow inset with a warm glow on focus.
- **Device** (`box-shadow: 0 30px 60px -30px rgba(31,31,31,.5)`): the phone frame of the demo.

### Named Rules
**The Hairline-Plus-Warmth Rule.** Every white container is a 1px gray inset outline plus the soft card shadow. No heavy borders, no offset or solid shadows.

## Shapes

Round everywhere. Everything you press is a pill (999px) or a circle: buttons, chips, tabs and their sliding indicator, option buttons, steppers, the ask bar, the send button, play dots, step letters, check bullets, the menu button. Containers step down by size: large panels and the demo stage 24px, interface windows and the plan table 20px, FAQ items and icon tiles 18px, inner mockup cards 16px, tickets and mini tables 14px, form fields 12px. Pascal's reply bubble is the one asymmetric shape (6px top-left, 22px elsewhere), pointing back at the avatar. Pascal's face sits in a circle ringed 2px in yellow; his art panels are 22px cards. Left-edge accent bars (3–4px yellow, scaling in vertically) mark the open FAQ item and the active method step. The flower's pointed petals are the system's one pointed form and belong to the mark alone; nothing interactive has a sharp corner.

## Components

### Buttons
Confident, round and lively.
- **Shape:** full pill (999px), 48px minimum height, Montserrat 600 1rem, 0.55em gap to a trailing arrow icon that slides 4px right on hover.
- **Primary:** yellow fill, graphite text. Hover lifts 2px, deepens to yellow-hover and adds the brand glow. A diagonal white shimmer crosses it every 4s and once on hover. Press scales to 0.97.
- **Dark:** graphite fill, white text; hover goes to black with a 1.5px yellow inset ring.
- **Ghost:** transparent with a 1.5px graphite inset ring; hover fills cream.
- **Outline on dark:** white text with a 1.5px white-70 % ring; hover turns ring and text yellow; focus outline yellow.
- **Small:** 40px, 10px 20px, 0.92rem (nav CTA).
- **Focus:** 3px graphite outline, 2px offset (yellow on graphite surfaces).

### Play Button
The brand sheet's "Ver cómo trabajamos" control: a 48px yellow circle with a graphite play triangle and the brand glow, followed by a Montserrat 600 label. The dot scales to 1.08 on hover; a 76px variant sits on the demo poster.

### Chips
- **Suggestion chips:** white pills with a 1px gray outline, Inter 500 0.92rem, 10px 18px. Hover fills cream with a 1.5px yellow ring and lifts 1px; the picked chip turns solid yellow. On phones they stack full width, left aligned.
- **Option chips (single and multi choice):** the same pill in Montserrat 600 muted, 44px minimum; checked turns solid yellow with graphite text. Multi-choice options carry an 18px rounded checkbox that fills graphite with a yellow check.
- **Status pill:** a white-80 % pill with outline and card shadow and a pulsing yellow dot, used once per page for a true product status ("en desarrollo"). It is not a section label.

### Ask Bar (signature)
The "Cuéntale a Pascal…" input: a white pill with a 1px outline and long soft shadow, Pascal's face (40px circle, 2px yellow ring) at its left end, a 52px input in Inter 500, a self-typing placeholder with a blinking yellow caret, and a 52px yellow circular send button. Below it, segmented tabs (pill track at gray 55 %, white sliding indicator with a 3px yellow underline) switch the chip set. Pascal answers in a reply bubble beside the same face avatar (44px), with the plan name set on a yellow tag.

### Brand Mark
The original PascalIA flower, `/flower.svg` (inlined on the page as a symbol with the same geometry): six pointed petals in Amarillo PascalIA at 0.82 fill opacity, curved white veins (3.5 stroke, round caps) from the center to five of the petals plus one straight vein down, a 9-unit white center node and 8-unit white nodes at the vein tips. `/flower-outline.svg` is the line version (warm gray strokes, no fill) for quiet backgrounds. Sizes in use: 34px in the logo, 20px in window bars, 64px in mockups, 240px in the result card and closing section, 640px behind the hero at 13 % opacity, and a 520px footer watermark under a 94 % graphite veil. The wordmark sets "Pascal" in graphite and "IA" in yellow, Montserrat 800.

### Pascal
The character always comes from the site's own art: `/pascal/pascal-rostro.webp` (face, cropped to a circle with a 2px yellow ring) for avatars, `mesaviva/img/pascal-panel.webp` (yellow full-body panel cropped from `/pascal/pascal.webp`) as a 22px card tilted -3deg with the lift shadow beside the ask bar on wide screens (hidden below 1080px), and `mesaviva/img/pascal-guino.webp` (wink panel) as a 22px card with the card shadow beside the FAQ heading (hidden on phones).

### Cards / Containers
- **Interface window:** white, 20px, outline plus card shadow, a window bar with a 20px flower, the product name in Montserrat 800 and a muted caption, list rows divided by 1px gray, and a cream footer row for totals. Rows and ticks animate in on reveal; a radial yellow spotlight follows the cursor and the card tilts slightly.
- **Result card:** graphite, 24px, 36px padding, lift shadow, a large flower blooming from the bottom-right corner (rotates 60deg on change), yellow plan name, yellow check bullets, white text.
- **Feature art panel:** white 24px, 4:3, outline plus card shadow, holding illustrative scenes (NFC tag with rings, kitchen tickets, delivery route).
- **Icon tile:** 60px white square at 18px radius on cream (cream-line outline), graphite stroke icon at 28px.
- **Internal padding:** 22px inside windows, 36px in configurator and result cards (24/20px and 28/22px on phones).

### Inputs / Fields
- **Style:** the shared contact form (`contacto.css`, class `pf`): white fields, 1.5px border, 12px radius, 11px 13px padding, bold labels at 0.92rem; on this system its accent is graphite and its submit is a yellow pill.
- **Focus:** border goes graphite and a 3px yellow outline appears with 1px offset.
- **Error:** border and message in red (#B3261E).
- **Stepper:** a pill track with 44px cream circular buttons (hover yellow) around a Montserrat 800 tabular count.

### Navigation
Sticky white bar with the flower and a two-line wordmark (product name in Montserrat 800, "de PascalIA" with "IA" bold). Links are Montserrat 600 0.95rem muted; hover turns graphite and grows a 2px yellow underline from the left. The link back to PascalIA keeps a 35 % underline at rest (the brand sheet's "Iniciar sesión" treatment). A yellow reading-progress line runs under the bar. Below 860px a 46px yellow circular menu button opens a full-screen white sheet with 1.6rem Montserrat 800 links separated by gray rules, staggered in.

### Numbered Steps
Circular step markers: 32px yellow circles with Montserrat 800 numbers in the demo stage; 48px circles with A–D letters in the method list (white with a graphite ring at rest, yellow when active, the active row on cream with a yellow left bar).

### FAQ Accordion
White items at 18px with a gray outline, Montserrat 700 questions, a 28px cream circular plus that rotates 45deg and turns yellow when open, a 3px yellow left bar, and an animated height for the answer.

### Footer
Graphite-deep with a faint flower watermark at the bottom right, four columns (brand, Soluciones, Empresa, Legal), light-gray links that turn yellow on hover, a 1px dark rule above the legal line.

## Do's and Don'ts

### Do:
- **Do** keep text on yellow graphite, and keep yellow for controls, selected states, the marker and the flower.
- **Do** alternate white and cream bands and save graphite for the result, the rules, the closing call and the footer.
- **Do** make every pressable thing a pill or a circle, and give containers 20–24px corners.
- **Do** outline white containers with the 1px gray inset and the soft card shadow; reserve the yellow glow for yellow controls.
- **Do** set money and counts in Montserrat with tabular figures.
- **Do** use the stroke icon set (`/iconos.svg` and inline symbols, 1.85 stroke, round caps) for icons.
- **Do** use the original flower geometry from `/flower.svg` (six pointed petals at 0.82 opacity, curved white veins, white nodes) whenever the mark appears, and `/flower-outline.svg` for the line version.
- **Do** draw Pascal only from the site art in `/pascal/` and its crops.
- **Do** honor `prefers-reduced-motion`: the spinning flower, marquee, rings, tickets and petals stop, and reveals show in place.
- **Do** keep sub-brand pages in their own identity inside this frame.

### Don't:
- **Don't** put white text on yellow, or yellow text on white (use `gold-ink` for a small yellow-family accent on white).
- **Don't** use yellow as a section background or a large flat fill.
- **Don't** use sharp-cornered buttons or chips, solid or offset shadows, or heavy borders on cards.
- **Don't** put a small label above section headlines; sections open on the headline itself.
- **Don't** use text characters or emoji as icons; draw them with the stroke icon set.
- **Don't** redraw the flower with round petals or a gradient fill, and don't use the brand-sheet character cutouts.
- **Don't** take `sitio.css`, `pascalia.css` or `inicio.css` as the reference for new components; they predate this system.
