# CoffeeStop — Project Handoff

## Overview

**CoffeeStop** (working name, formerly *Grounds*) is a mobile coffee shop discovery app prototype. Specialty-coffee-first: it surfaces not just where to get coffee but what's in the cup — bean origin, processing method, trade relationship, brew methods, atmosphere. The prototype is a fully self-contained single HTML file with no external dependencies beyond Google Fonts.

**Prototype file:** `coffeestop.html`  
**~1540 lines** — inline CSS, HTML, and JavaScript.

---

## Design Language

### Colour palette (CSS variables)

```css
--espresso:   #2A1A10   /* primary dark, text, buttons */
--roast:      #6B4226   /* secondary warm brown */
--roast-soft: #8A5A38   /* muted brown for pills */
--caramel:    #C17A35   /* primary accent, active states, scores */
--caramel-dk: #A8631F   /* darker caramel for gradients */
--crema:      #F3E9D6   /* score pill background */
--foam:       #FBF5EA   /* sheet backgrounds, cards */
--kraft:      #E3D2B0   /* map background, pill backgrounds */
--kraft-dk:   #D6C19A
--sage:       #7E8A5E   /* open/available status LED */
--clay:       #A8503A   /* closed status LED */
--water:      #9DB3A8   /* you-are-here dot */
--ink-60:     rgba(42,26,16,.60)
--ink-40:     rgba(42,26,16,.40)
--nav-dark:   #1a1008   /* nav bar background */
```

### Typography

```css
--f-display: 'Lora', Georgia, serif      /* shop names, headings */
--f-ui:      'Outfit', system-ui, sans-serif  /* all UI text */
--f-mono:    'Outfit', system-ui, sans-serif  /* scores, distances */
```

Loaded via Google Fonts: `Lora:wght@400;600;700` + `Outfit:wght@400;500;600;700`.

### Phone frame

- Container: `width: min(390px, 100%)`, `height: min(844px, calc(100dvh - 48px))`
- `border-radius: 44px`, dark ring shadow
- `isolation: isolate` on `.phone` for stacking context

---

## Architecture

### Screen system

Four screens, only one `.active` at a time:

| ID  | Name    | State     |
|-----|---------|-----------|
| s0  | Nearby  | Built (map view) |
| s1  | Search  | Stub |
| s2  | Saved   | Built (list view) |
| s3  | You     | Stub |

### DOM hierarchy (s0 — the main screen)

```
.phone
  .screen.active#s0
    .map-wrap
      .map-zoom-layer#mapZoom          ← scales on pin tap
        svg.streets                    ← static SVG map illustration
        .grain                         ← dot texture overlay
        .me-wrap > .me-ring + .me-dot  ← you-are-here at left:50% top:48%
        #pins                          ← pins injected by JS
      .logo-mark                       ← caramel dot watermark, 14px, opacity .42
      .filter-ctrl                     ← filter icon OR active pill
      .loc-chip                        ← "Mission District" (left-aligned)
  .screen#s1 (stub)
  .screen#s2
    .saved-screen
      .saved-hdr > h2 + .saved-count
      .saved-list#savedList              ← cards injected by renderSaved()
      .saved-empty#savedEmpty            ← shown when nothing is saved
  .screen#s3 (stub)
  nav.lnav                             ← liquid valley nav
  #detailOverlay                       ← transparent dismiss overlay, z-index 24
  .detail-screen#detailScreen          ← bottom sheet, z-index 25
  .f-scrim                             ← filter panel scrim, z-index 29
  .f-panel                             ← filter panel, z-index 30
```

---

## Navigation — Liquid Valley Nav

**Design:** Cut-in valley bezier shape drawn on a `<svg viewBox="0 0 390 72">`. A caramel latte ball (`<ellipse>`) rides the valley centre. Spring physics animate the ball to the active tab.

**Spring parameters:** stiffness = 0.09, damping = 0.70  
**Squish effect:** valley half-width widens (46 → 70px) at high velocity; depth shallows (28 → 17px)

**JS functions:**
- `drawValley(x, vel)` — redraws the SVG path and repositions the bean
- `springTick()` — rAF loop running the spring physics
- `navTo(idx)` — switches screen and retargets the spring

**Tab positions:** `[VW/8, VW*3/8, VW*5/8, VW*7/8]` (4 evenly spaced across 390px)

---

## Map

Static SVG illustration (`viewBox="0 0 390 660"`). Not a real map engine.

**Layers (bottom to top):**
1. Kraft rectangle background
2. Water strip (SVG path, `#9DB3A8`)
3. Park fill (`#cdd5b0` + `#7E8A5E` overlay)
4. Main roads (`#EFE2C7`, stroke-width 14)
5. Side streets (`#E0CDA6`, stroke-width 6)
6. Grain texture overlay (radial-gradient dots, `mix-blend-mode: multiply`)

**Zoom system:** `.map-zoom-layer` wraps the SVG, grain, you-are-here, and pins. On pin tap: `transform: scale(2.4) translate(dx%, dy%)` with `transform-origin: 50% 50%`. The floating controls (loc-chip, logo-mark, filter-ctrl) are **outside** the zoom layer — they stay fixed.

**Important:** `will-change: transform` is intentionally NOT set on `.map-zoom-layer` — adding it creates a CSS stacking context that traps pin z-indexes and prevents the selected pin from appearing above the detail sheet.

**Zoom target formula:**
```js
const S = 2.4;
const dx = 50 - px;          // centres pin horizontally
const dy = 37.5 - py;        // centres pin in the visible 40% above the 60% sheet
// target_y = 50 + S × (dy - 50 + py ... ) ≈ 20% from top
```

---

## Pins

**Normal state:** Rotated-square diamond (rotated 45°, caramel background), small cup SVG glyph inside. Name label floats above at 72% opacity always visible.

**CSS classes:**
- `.pin` — base pin button, `position: absolute`, `transform: translate(-50%, -100%)`
- `.pin.sel` — selected/highlighted state (not used currently, kept for future)
- `.pin.morphing` — detail open: cup fades, espresso cup SVG springs in; **z-index: 30** (above detail sheet at z-index 25)
- `.pin.un-morphing` — closing: espresso cup fades, regular cup returns

**Pin morphing animation (open):**
1. `openDetail(id)` is called
2. `.morphing` class added to selected pin
3. `.cup` fades to `opacity: 0`, `scale: 0.25` over 220ms
4. `.pin-espresso` (22px espresso cup SVG) springs from `scale(0.12)` to `scale(1)` starting at 220ms, 420ms duration, `cubic-bezier(.2,.9,.3,1.1)`
5. Map zooms simultaneously

**Pin morphing animation (close):**
1. `.un-morphing` added BEFORE `.morphing` is removed (prevents snap)
2. Espresso cup fades out, regular cup fades back in (0.28–0.30s)
3. Label returns with 0.28s delay

**Espresso cup SVG** (22×22px, scales to ~53px at 2.4× zoom):
```svg
<svg viewBox="0 0 58 58">
  <ellipse cx="29" cy="50" rx="21" ry="4.5" fill="#FBF5EA"/>  <!-- saucer -->
  <path d="M18 24 L38 24 L36 44 Q36 48 32 48 L24 48 Q20 48 18.5 44 Z" fill="#C17A35"/>  <!-- body -->
  <ellipse cx="28" cy="24.5" rx="9.5" ry="2.3" fill="#2A1A10" opacity="0.45"/>  <!-- lid -->
  <path d="M36 29 Q44 29 44 34.5 Q44 40 36 40" stroke="#C17A35" stroke-width="4"/>  <!-- handle -->
</svg>
```

**Other pins during detail:** fade to `opacity: 0` (transition 0.38s ease). Restored after close.

---

## Shop Data Schema

```js
const SHOPS = [
  {
    id:      Number,          // 1–6
    name:    String,          // display name
    score:   Number,          // SCA-style cup score (87–94)
    dist:    Number,          // metres from user
    walk:    Number,          // walking minutes
    open:    Boolean,
    hours:   String,          // "Open until 6 pm" / "Opens at 8 am"
    brews:   String[],        // brew methods, e.g. ['Pour-over','V60']
    price:   String,          // '$' | '$$' | '$$$'
    x:       String,          // CSS % position on map, e.g. '27%'
    y:       String,          // CSS % position on map, e.g. '43%'
    atmo:    String[],        // atmosphere tags, e.g. ['Quiet','No laptops']
    origin:  String,          // bean origin, e.g. 'Ethiopia, Guji'
    process: String,          // 'Washed' | 'Natural' | 'Honey'
    trade:   String[],        // e.g. ['Direct trade','Organic']
    desc:    String,          // 1–2 sentence description
  }
]
```

**Score labels** (real SCA cupping conventions):
- 90+ → "Outstanding"
- 85–89 → "Excellent"
- 80–84 → "Very good"
- < 80 → "Good"

The highest-scoring shop gets "highest-rated nearby"; others get "specialty grade".

---

## Filter System

**State object:**
```js
fState = {
  openNow:  Boolean,
  brews:    Set<String>,
  minScore: Number,    // 0, 85, 90, or 95
  price:    Set<String>  // '$', '$$', '$$$'
}
```

**Badge / active pill:** When filters are inactive, a square icon button shows in the top-right. When active, it transforms into a caramel pill showing a 2-item summary (e.g. "Pour-over · Open now"). The × on the pill calls `clearFilters()` directly.

**Filter sections:** Open now toggle, Brew method (multi-select, shows shop count per method), Min cup score (single-select: Any / 85+ / 90+ / 95+), Price tier (multi-select).

**Zero-results state:** Apply button becomes `"No spots match — clear filters"` and clears on click.

**`applyToMap()`:** Dims non-matching pins to `opacity: 0.18`, `pointer-events: none`.

**Key functions:**
- `getFiltered()` → filtered SHOPS array
- `activeFilterCount()` → total individual options selected
- `filterSummaryText()` → max 2-part summary string
- `onFilterChange()` → updates button, count, zero state
- `openFilters()` / `closeFilters()` / `clearFilters()` / `applyToMap()`

---

## Detail Screen

**Layout:** `position: absolute; bottom: 0; left: 0; right: 0; height: 60%; z-index: 25`  
Slides up via `translateY(100%) → translateY(0)`, `cubic-bezier(.32,.72,0,1)`, 420ms.

**Dismiss:** Tap the × button top-right of the sheet, OR tap anywhere on the visible map above the sheet (transparent `#detailOverlay` at z-index: 24 with `pointer-events: auto` when open).

**Content sections (top to bottom):**
1. Handle bar + × close button
2. Shop name (Lora 22px) + score (20px caramel) + score context ("Outstanding · specialty grade")
3. Status LED + hours + walk time + distance
4. Brew method pills + price pill (kraft background)
5. Atmosphere pills (sage-tinted outline style — visually distinct from brew pills)
6. "Currently pouring" card (tinted background): origin name (Lora 15px) + process + trade
7. Description paragraph
8. Save button (animated heart) + Get directions button

**Guard:** `detailOpen` boolean prevents `openDetail()` firing mid-close animation.

**Open sequence:**
1. `openDetail(id)` — map zoom starts, other pins fade to 0, selected pin adds `.morphing`
2. 340ms delay — detail sheet slides up
3. Overlay enabled

**Close sequence:**
1. Sheet slides down, overlay disabled
2. 200ms delay — zoom-out starts, `.un-morphing` replaces `.morphing`, other pins restore
3. 500ms — `applyToMap()` called to reapply any active filter dimming
4. 700ms — zoom layer transform hard-reset (transition disabled for one double-rAF frame, then re-enabled)

---

## Save Animation

**Heart button:** SVG clipPath approach. A `<rect id="saveRect">` with `y` attribute controls how much fill is revealed. `y=24` = empty, `y=0` = full.

**Save (fill):**
- Stroke flips to caramel synchronously on tap (zero perceived delay)
- `animateSaveHeart()`: ease-out-sine `sin(t × π/2)`, 420ms
- State change (`btn.classList.add('saved')`, label → "Saved") fires when `ease >= 0.95` (visually complete before technically done)
- Scale pulse: instant snap to `scale(1.26)`, double-rAF → ease back to `scale(1)` via `cubic-bezier(.2,.9,.3,1.15)`, 220ms

**Unsave (drain):**
- `unsaveHeart()`: ease-in-sine `1 - cos(t × π/2)`, 420ms (liquid drains slowly then rushes out)
- State change fires when drain reaches 88%
- `saveAnimating` guard prevents double-tap

**Persistence:** `localStorage` under `SAVE_KEY` (`coffeestopSaved`; values under the old `groundsSaved` key are migrated once on load) — Set of saved shop IDs. `persistSaved()` writes it; every mutation calls `persistSaved()` then `renderSaved()` so the Saved screen is always in sync. Read on `openDetail()` to set initial heart state.

---

## Saved Screen (s2)

Renders live from the `savedIds` Set — no separate data source.

**Order:** most recently saved first (`[...savedIds].reverse()` — JS Sets preserve insertion order). IDs with no matching shop are filtered out, so stale localStorage entries can't break the render.

**Card anatomy** (`.saved-card`, crema background, 16px radius):
1. Name (Lora 16.5px) + cup score (caramel) with score label underneath
2. Status LED + hours · walk time · distance
3. Brew pills + price pill (same kraft styling as the detail sheet)
4. Footer: bean icon + `origin · process`, and a filled-caramel heart to unsave

Cards stagger in at 45ms intervals via the `cardIn` keyframe; `renderSaved()` is re-run on every visit to tab 2 (in `navTo`) so the entrance replays.

**Interactions:**
- **Tap a card** → `openSavedShop(id)`: calls `navTo(0)` to return to the map, waits 240ms for the screen swap, then `openDetail(id)`. The pin morph and map zoom run exactly as they do from a pin tap.
- **Tap the heart** → `removeSavedShop(id, card)`: deletes from the Set and persists immediately, pins the card's measured height into `max-height`, then adds `.removing` to collapse it out (opacity + slide + height, ~300ms) before a full `renderSaved()` at 320ms. `stopPropagation()` keeps it from opening the detail sheet.
- Cards are keyboard-reachable (`tabindex="0"`, Enter/Space open the detail).

**Empty state:** bookmark icon, "Nothing saved yet", and a "Browse nearby →" button wired to `navTo(0)`. Toggled by `.show` on `#savedEmpty`; the list is `display: none` when empty.

**Key functions:**
- `savedShops()` → array of shop objects, newest-saved first
- `renderSaved()` → rebuilds the list, count line, and empty state
- `openSavedShop(id)` / `removeSavedShop(id, card)` / `persistSaved()`

---

## Z-Index Map

| Layer | Z-index |
|-------|---------|
| Pins (normal) | 4 |
| Floating controls (loc-chip, filter) | 6 |
| `.pin.morphing` (selected during detail) | 30 → BUT see note |
| Filter scrim | 29 |
| Filter panel | 30 |
| `#detailOverlay` | 24 |
| `.detail-screen` | 25 |

**Critical stacking context note:** Any active CSS `transform` (not just `will-change`) on `.map-zoom-layer` creates a stacking context. This means pins inside the layer can't escape above the detail-screen via z-index alone. The current fix is to position the pin target within the visible map area (top 40%) rather than relying on z-index to pierce the sheet. The `z-index: 30` on `.pin.morphing` only helps if the pin is physically above the sheet.

---

## Known Issues / Active Bugs

1. **Espresso cup position** — The pin zooms to ~20% from top (`dy = 37.5 - py`), centred in the visible 40% above the 60% sheet. The user requested true dead-centre (50%/50%) but this causes the cup to land inside the sheet due to the stacking context limitation above. A proper fix would require moving the selected pin element outside the zoom layer into a separate overlay at render time.

2. **Zoom target precision** — The formula `target_y = 50 + 2.4 × (py + dy - 50)` places the pin at ~20% from top. Works for all 6 shops since the formula cancels out each shop's y position.

---

## Stub Screens

- **Search (s1):** Empty with placeholder text "Find your next cup"
- **You (s3):** Empty profile screen

---

## Next Steps (Prioritised)

1. **Get directions** — `d-btn-dir` currently does nothing; link to `maps.apple.com/?q={name}&near=MissionDistrict`
2. **Search screen** — filter SHOPS by typed name
3. **Real location** — `navigator.geolocation` to replace hardcoded Mission District
4. **Real data** — Foursquare Places API swap-in; `fetchCafes()` is the intended entry point (not yet built)
5. **Swipe-to-dismiss detail sheet** — `touchstart` / `touchmove` / `touchend` handlers on the sheet
6. **Pin clustering** — needed once real data has many shops at map scale
7. **Real map** — Leaflet or MapLibre with Stadia Alidade Smooth tile style (closest warm aesthetic to current SVG)

**Saved screen follow-ons:** a count badge on the Saved nav tab, swipe-to-delete on cards, and sort options (distance / score / date saved) once the list can grow past a handful.

---

## File Reference

```
coffeestop.html          — the entire prototype (self-contained, ~1540 lines)
coffeestop-handoff.md    — this document
```

Both live at the root of `dramadanov.github.io`, so the prototype is served at
`https://dramadanov.github.io/coffeestop.html`. The site's `index.html` (the writings
archive) is untouched and does not link to it.

The HTML file has no build step, no bundler, no server. Open directly in browser.
