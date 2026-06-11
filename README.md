# Things & Sayings 🍋

A sunny multiplayer party-bingo game. Two teams, a 4×4 board of predictions, and a 60-second clock. This repo ships the **Bingo round**; *Name a Number* and *Sam Says* are stubbed for later.

- **Web app** → Next.js (App Router), deploys to **Vercel**
- **Realtime** → a Cloudflare **Durable Object** Worker (via [`partyserver`](https://github.com/cloudflare/partykit)), one authoritative room per lobby code

The Worker owns the game state, so the 60s timer is server-driven, the host can drop without killing the game (the crown auto-migrates), and anyone can refresh and reconnect into the live game.

---

## Architecture

```
gwen26/
├─ app/                 Next.js app (Vercel)
│  ├─ page.tsx          home: name + create/join
│  └─ room/[code]/      the live game
├─ components/          Board + Game UI
├─ lib/
│  ├─ game.ts           SHARED types + rules + authoritative reducer
│  ├─ useRoom.ts        partysocket hook
│  └─ id.ts             local player id/name
└─ partyserver/         Cloudflare Worker (deploy separately)
   ├─ src/server.ts     Lobby Durable Object (imports ../../lib/game)
   └─ wrangler.jsonc
```

`lib/game.ts` is the single source of truth for rules and is bundled into **both** the app and the Worker.

---

## Run it locally

You need two terminals.

**1. Realtime Worker**
```bash
cd partyserver
npm install
npm run dev          # wrangler dev → http://127.0.0.1:8787
```

**2. Web app** (repo root)
```bash
npm install
cp .env.local.example .env.local   # defaults to 127.0.0.1:8787
npm run dev          # → http://localhost:3000
```

Open `localhost:3000`, start a lobby, then open the same URL in other tabs/devices and join with the code.

---

## Deploy for real

### A. Realtime Worker → Cloudflare

Requires a free Cloudflare account. Durable Objects here use SQLite storage, which is available on the free Workers plan.

```bash
cd partyserver
npx wrangler login
npx wrangler deploy
```

Note the deployed host it prints, e.g. `gwen26-party.<your-subdomain>.workers.dev`.

### B. Web app → Vercel

1. Push this repo to GitHub (`https://github.com/widodoalfianto/gwen26`).
2. In Vercel, **Import** the repo. Framework auto-detects as Next.js; root directory is the repo root (the `partyserver/` folder is ignored by the app build).
3. Add an environment variable:

   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_PARTYKIT_HOST` | `gwen26-party.<your-subdomain>.workers.dev` |

   (No `https://` — the client infers `wss://`.)
4. Deploy. Redeploy after changing the env var.

That's it: the Vercel app talks to the Cloudflare Worker over WebSockets.

---

## Customizing

- **Free spaces / favourite things** — edit `FREE_SPACES` in `lib/game.ts` (emoji + label per board position). The four free positions are fixed at indices 2, 7, 8, 14.
- **Word deck** — edit `DECK` in `lib/game.ts`. You need at least 30 unique words (10 per round × 3).
- **Fonts** — drop licensed `SuperiorTitle-Italic.woff2`, `Mundial-Regular.woff2`, `Mundial-Bold.woff2` into `public/fonts/`. Without them the app falls back to Fraunces + Onest. See `public/fonts/README.txt`.
- **Colors** — all tokens live at the top of `app/globals.css` (`--lemon`, `--green` = Team Meadow, `--blue` = Team Sky).

---

## How the Bingo round scores

- Each team is dealt 5 secret cards. Cards swap; you guess the other team's cards.
- Your turn (60s): one describes, teammates guess. **+1 per card guessed** (max 5).
- The *listening* team marks its own board when it hears a predicted word. **Full board = bingo, +3.**
- 3 rounds, fresh cards + boards each round. Most points wins.

> ⚠️ This game uses generic emoji for the free spaces. If you swap in custom artwork, make sure you have the rights to it.
