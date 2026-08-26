# PixelForge Design Directions

## Three possible approaches

### 1. Cartographer’s Workbench
**Very Brief Intro:** A tactile digital atlas that feels like a field desk shared by systems designers and world-builders. Layered panels, topographic ink, and precise map annotations make procedural systems feel tangible.

**Probability:** 0.07

### 2. Monastic Simulation Lab
**Very Brief Intro:** An austere research-console aesthetic defined by quiet paper surfaces, typewriter-like labels, and a restrained analytical cadence. The world becomes the visual spectacle rather than decorative interface chrome.

**Probability:** 0.04

### 3. Signal Terrain Observatory
**Very Brief Intro:** A dark, instrument-led observatory with mineral-toned terrain readouts and luminous contour data. It emphasizes the sense of watching a living simulation emerge from raw parameters.

**Probability:** 0.08

## Chosen Direction — Cartographer’s Workbench

### Design Movement
**Contemporary cartographic editorial design** fused with the material logic of a surveyor’s field notebook and a technical geographic-information system. The application should feel like a serious world-design instrument—not a generic admin dashboard.

### Core Principles
1. **The map is the protagonist.** Interface chrome stays quiet, while the generated terrain carries color, texture, and kinetic change.
2. **Tactile precision.** Hairline rules, coordinate-style labels, subtle paper grain, tabular numerals, and disciplined panel edges signal craft and reliability.
3. **Asymmetric orchestration.** A persistent instrument rail, a wide panoramic map surface, and a compact evidence panel create a working-desk rhythm rather than a centered card layout.
4. **Inspectable systems.** Every generator decision should have a visual counterpart: layers, terrain legend, validation marks, paths, and human-readable statistics.

### Color Philosophy
The interface is set on a warm **drafting-paper ground** rather than stark white. Terrain appears in restrained natural pigments—moss, water blue, sandstone, charcoal, and dried-clay red—so the map communicates at a glance. A muted saturated **survey orange** is reserved for active edits, key controls, and selected waypoints; it should feel like a pencil annotation on a printed atlas rather than an app accent.

### Layout Paradigm
A **cartographic workbench**: a narrow vertical command rail anchors navigation on the left; controls are positioned in a secondary right-side instrument column; the map occupies an expansive, slightly inset central canvas. On smaller viewports the right instrument column collapses into sequential, clearly grouped inspector panels beneath the map.

### Signature Elements
1. **Coordinate ribbons:** tiny monospaced labels along map edges and panel headers.
2. **Survey marks:** orange crosshairs, route pins, and topographic contour ticks used for focused states.
3. **Layered paper surfaces:** subtle grain, inset shadows, and low-contrast ruling evoke printed mapping material without reducing readability.

### Interaction Philosophy
Every interaction should resemble working with a drafting instrument: generate performs a focused map refresh, changing parameters updates measured readouts, layer toggles clarify rather than overwhelm, and selection announces itself with a modest survey-orange marker. Destructive operations require clear confirmation; utility actions remain close to the data they affect.

### Animation
Map generation uses a short staged reveal: base terrain fades in first, then river/road paths draw on, then settlements and validation marks appear with a 45–70 ms stagger. Panels and tooltips use a brisk `cubic-bezier(0.23, 1, 0.32, 1)` transition under 240 ms. Hover states shift only color, opacity, and 1–2 px transforms. All nonessential motion is disabled under reduced-motion preferences.

### Typography System
**DM Mono** is used for seeds, coordinates, statistics, validation, and action labels; its tabular rhythm reinforces technical exactness. **DM Sans** is the operational body type. **Fraunces** is reserved for prominent world titles and concise editorial annotations, using soft serif character as a counterpoint to the system UI. Headlines are never all-caps; instrument labels can use tracked uppercase DM Mono.

### Brand Essence
**PixelForge is a deterministic world-design workbench for game creators who need rich terrain that holds together under inspection.**

**Personality:** Methodical, tactile, exploratory.

### Brand Voice
Headlines should be concrete and constructive; CTAs should name an action and its payoff; microcopy should report evidence rather than cheerlead.

> “Shape a world that can explain itself.”

> “Regenerate the valley, preserve the frontier.”

### Wordmark & Logo
The logo is a compact **PF monogram built from two interlocking topographic contour lines** inside a squared survey marker. The wordmark uses a high-contrast serif treatment for “Pixel” paired with a precise monospace “Forge,” visually joining imaginative terrain and deterministic tooling.

### Signature Brand Color
**Survey Orange — `#E75D2A`**. Used sparingly for the active generation state, selected map features, and the brand mark.

## Style Decisions

- The wordmark visibly joins a high-character serif **Pixel** with a precise monospace **Forge**; the split is typographic as well as chromatic.
- The central atlas always displays cartographic evidence beyond terrain color: measured grid coordinates, survey edge annotations, paths, pins, and validation context.
