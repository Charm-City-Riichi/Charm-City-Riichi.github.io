# CLAUDE.md — Charm City Riichi Website

> ## ⚠️ DO NOT TRY TO RUN A PREVIEW SERVER
>
> The `preview_*` tools **do not work in this project**. 
>
> **How to verify changes here:** read the source code carefully, reason about CSS/HTML/JS by hand, and ship. The user will check the result in their own browser. Do **not** ask the user to start a server for you.

## Project Overview

**Charm City Riichi** is a riichi mahjong club based in Baltimore and Savage, Maryland. This website serves as the club's public information hub: events, rules, scoring reference, and community links.

**Stack:** Pure HTML, CSS, vanilla JavaScript — no build tools, no frameworks, no dependencies beyond Google Fonts

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
