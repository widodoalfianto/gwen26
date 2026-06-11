Fonts
=====

Design language:

  • Titles      → Geist (weight 800/900)
  • UI / body   → Geist (weight 400–700)

Geist powers everything and is loaded from Google Fonts in
app/layout.tsx — no local font files are needed, so this folder is
empty by design.

To change the title face, edit the --display token at the top of
app/globals.css (and load the new family in app/layout.tsx). If you
self-host a face, drop the .woff2 here and add an @font-face block in
app/globals.css.
