---
name: "Single-File Frontend"
description: "Use when changing the Bachata Coach browser UI, theme, video player, review flow, saved reviews, or AI chat in src/public."
applyTo: "src/public/**"
---
# Single-File Frontend

- Edit `src/public/index.html`, never the generated `dist/public/index.html` copy.
- The page is plain HTML/CSS/JavaScript with no frontend build framework. Reuse existing DOM helpers, state, and player functions instead of introducing a parallel UI layer.
- Preserve custom video controls; do not add the native `controls` attribute.
- Apply mirror state to `#videoMirrorWrap`, not directly to the `<video>` element.
- Keep theme choice explicit (`light`, `dark`, or system) during early page initialization so the system media query cannot override a stored user choice.
- The chat panel sends current player context to `/videos/:id/chat`; server-side history remains authoritative and must not be duplicated in request bodies.
- Keep inline JavaScript function boundaries intact. After editing a shared handler, exercise that handler plus neighboring chat, review, and theme flows in the running app.
- Confirm frontend assets still copy during `npm run build` and verify the changed flow at desktop and mobile widths.