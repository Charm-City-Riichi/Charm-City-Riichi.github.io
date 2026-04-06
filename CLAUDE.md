# CLAUDE.md — Charm City Riichi Website

## Project Overview

**Charm City Riichi** is a riichi mahjong club based in Baltimore and Savage, Maryland. This website serves as the club's public information hub: events, rules, scoring reference, and community links.

- **Hosted on:** GitHub Pages (`charm-city-riichi.github.io`)
- **Stack:** Pure HTML, CSS, vanilla JavaScript — no build tools, no frameworks, no dependencies beyond Google Fonts
- **Deployment:** Push to `main` branch → live immediately on GitHub Pages

---

## Folder Structure

```
ccr_website/
├── index.html                      # Home page
├── events.html                     # Events overview/hub
├── how-to-play.html                # Beginner rules guide
├── scoring.html                    # Scoring reference + interactive calculator
├── contact.html                    # Contact info and community links
├── 404.html                        # Branded error page
├── css/
│   └── style.css                   # ALL styles (1,052 lines, single file)
├── events/
│   ├── weekly-meet-ups.html        # Weekly meetup schedule and details
│   ├── one-day-events.html         # One-day tournaments with photo grid
│   └── ccro.html                   # Charm City Riichi Open 2026 announcement
├── mahjong images/
│   ├── nlb/                        # No Land Beyond venue photos
│   ├── 0326/                       # March 2026 tournament photos
│   ├── omni/                       # Omnihedral venue photos
│   ├── cool hands/                 # Scoring/hand example images
│   └── branding/                   # Logos (PNG + WebP)
├── Aero 2.ttf                      # Custom heading font (local file)
├── favicon.png                     # Site favicon
├── favicon.webp                    # Site favicon (WebP)
├── robots.txt                      # Allows all crawlers, links sitemap
├── sitemap.xml                     # 8 URLs with priorities
└── README.md                       # Simple file listing (minimal)
```

---

## Pages & Sections

### `index.html` — Home
- **Hero:** Club intro, welcoming tone, Discord CTA button
- **Features Band:** 6 cards (Weekly Meetups, Beginner Instruction, Local & Regional Events, Community Building, Online Games, Discord Server) on a sage green (`--color-green`) background
- **Photo Gallery:** 8 images, masonry CSS grid (4 cols desktop / 2 cols mobile), dense auto-flow with specific items spanning 2×2 or 2×1
- **Lightbox:** Inline JS — click image to expand, click outside or press Escape to close

### `events.html` — Events Hub
- Three event blocks: Weekly Club Meet-Ups, One-Day Tournaments, CCRO '26
- Embedded Google Calendar iframe
- Links to Google Maps for venues (No Land Beyond, Omnihedral)
- Eventbrite links for registration

### `how-to-play.html` — Rules Guide
- Comprehensive beginner guide: tile composition, turn structure, winning hands, tenpai/riichi/yaku/furiten
- Floating sidebar table of contents with numbered jump links
- Callout boxes: amber (tips/warnings) and blue (mechanics/rules)
- Schema.org FAQ + Article markup

### `scoring.html` — Scoring Reference
- **Yaku Table:** Sortable, searchable, filterable by han level; color-coded han tags
- **Scoring Tables:** Han/fu point lookup
- **Fu Grid Cards:** Visual fu composition breakdowns
- **Interactive Calculator:** Two-column layout (hand input + result)
- **Limit Hands Chart:** Mangan → Yakuman

### `contact.html` — Contact
- Three contact methods: Discord (primary), email (`charmcityriichi@gmail.com`), in-person meetups
- Schema.org Organization + ContactPoint markup

### `404.html` — Error Page
- Simple branded message with a home button, consistent nav/footer

### `events/weekly-meet-ups.html`
- Schedule: two venues (Baltimore & Savage), three time slots
- Cover fees, parking info, reservation requirements
- Schema.org Event markup for each recurring meetup

### `events/one-day-events.html`
- Tournament info and recent event recap
- Horizontal scrolling photo grid (9 images from March 2026)

### `events/ccro.html`
- Charm City Riichi Open 2026 (June 20–21, Juneteenth weekend)
- First ARA-certified two-day tournament for the club
- Registration, pricing, venue/logistics details

---

## Design System

### Fonts

| Role | Font | Source |
|------|------|--------|
| Headings / display | **Aero** | Local file `Aero 2.ttf` |
| Heading fallback | DM Serif Display | Google Fonts |
| Body / UI | **Outfit** (400, 500, 600, 700) | Google Fonts |

### Color Palette (CSS variables in `css/style.css`)

```css
--color-bg: #ffffff          /* page background */
--color-bg-alt: #f5f5f0      /* alternating section background */
--color-surface: #eaeae5     /* card/table surface */
--color-accent: #e87a1e      /* warm orange — buttons, highlights, underlines */
--color-accent-hover: #d06a12
--color-text: #1a1a1a
--color-text-muted: #666660
--color-heading: #111111
--color-border: rgba(26, 26, 26, 0.12)
--color-green: #b1c5a4       /* sage green — features band background */
```

### Layout Conventions

- **Max content width:** 1200px (`.container`)
- **Sticky header height:** 60px with `backdrop-filter: blur` (glassmorphism effect)
- **Page title style:** `.page-title` — orange bottom-border underline accent
- **Two-column splits:** 40/60 for event rows and scoring calculator
- **Card hover:** `border-color` changes to accent + `translateY(-3px)` lift
- **Button style:** Orange fill, `padding: 0.75rem 2rem`, `border-radius: 6px`, hover darkens + lifts

### Responsive Breakpoints

| Width | Change |
|-------|--------|
| 1024px | Tablet layout adjustments |
| 768px | Mobile nav (hamburger) activates |
| 700px | Gallery drops to 2 columns |
| 640px | Full mobile stacking |
| 580px | Extreme small screen adjustments |

---

## Navigation Structure

```
Home
Events ▼
  └── Weekly Meet-Ups
  └── One-Day Events
  └── CCRO '26
How to Play
Scoring
Contact
```

- Desktop: horizontal nav with CSS hover dropdown for Events
- Mobile: hamburger toggle, inline JS `classList.toggle`

---

## JavaScript Patterns

- **No separate JS files** — all JS is inline `<script>` at the bottom of each HTML file
- **Lightbox** (`index.html`): click to open overlay, click backdrop or Escape key to close
- **Mobile menu** (all pages): hamburger button toggles a class on the nav
- **Yaku table** (`scoring.html`): sort by column header click, search input filter, han-level filter buttons
- No frameworks, no libraries — vanilla JS only

---

## SEO & Metadata

Every page includes:
- `<meta charset>`, `<meta viewport>`, `<meta theme-color>`
- OpenGraph tags (`og:title`, `og:description`, `og:image`, `og:url`, `og:type`)
- Twitter Card (`summary_large_image`)
- `<link rel="canonical">`
- Schema.org JSON-LD (varies by page: `SportsClub`, `Organization`, `Event`, `Article`, `FAQPage`, `BreadcrumbList`)
- Google Fonts loaded with `rel="preconnect"` to `fonts.googleapis.com` and `fonts.gstatic.com`

---

## Image Conventions

- **Primary format:** WebP (modern, smaller file size)
- **Fallback:** PNG/JPEG where needed
- **Always include:** `alt` text, `loading="lazy"` on gallery images
- **Object-fit:** `cover` for consistent display in grid cells

---

## Key Preferences & Conventions

- **Single CSS file** (`css/style.css`) — all styles live here, never inline styles
- **No build process** — files must be deployable directly to GitHub Pages without any compilation
- **Vanilla JS only** — no jQuery, no React, no bundlers
- **CSS variables for all colors** — never hardcode hex values outside of `style.css`
- **WebP images** preferred for performance
- **Semantic HTML** — proper heading hierarchy, landmark elements (`<header>`, `<main>`, `<footer>`, `<nav>`)
- **Accessibility** — alt text on all images, ARIA labels where needed
- **Schema.org markup** on every page for SEO

---

## External Services & Links

| Service | Purpose |
|---------|---------|
| Discord (`discord.gg/SzCeUjuGFP`) | Primary community hub |
| `charmcityriichi@gmail.com` | Club email |
| Eventbrite | Event registration/ticketing |
| Google Calendar (embedded) | Public event calendar |
| Google Maps | Venue location links |
| ARA (American Riichi Association) | Tournament certification body |
| Omnihedral | Board game store (One-Day Events venue) |
| No Land Beyond | Bar/venue (Weekly Meetups) |
