Fonts
=====

The design uses two licensed faces:

  • Superior Title (italic)  — headings/titles   (Sharp Type)
  • Mundial                  — body text          (Latinotype)

Neither ships with this repo (they're commercial). Drop your licensed
.woff2 files here with these exact names and they activate automatically:

  SuperiorTitle-Italic.woff2
  Mundial-Regular.woff2
  Mundial-Bold.woff2

Until the files exist, the app falls back to Fraunces (italic) for
headings and Onest for body — both loaded from Google Fonts in
app/layout.tsx — so everything still renders. Swap or remove the
@font-face blocks in app/globals.css if you license different weights.
