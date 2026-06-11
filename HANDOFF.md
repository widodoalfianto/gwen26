# Things & Sayings — Engineering Handoff

A multiplayer party-bingo web game (a gift project). This doc is written for a coding agent picking up the work. It describes what exists, how it is wired, the deployment model, the current blocker, and what is left.

Repo: `https://github.com/widodoalfianto/gwen26`

---

## 1. What this is

A companion app for an in-person party game. Two teams (~6 players total) on their phones; the actual guessing happens out loud in the room. The app handles dealing, board setup, the turn timer, marking, and scoring.

Only the **Bingo round** is implemented. Two more rounds (*Name a Number*, *Sam Says*) are planned but not built.

---

## 2. Stack & hosting model

- **Web app:** Next.js 15 (App Router) + React 19 + TypeScript. No CSS framework; plain CSS in `app/globals.css`. Deploys to **Vercel**.
- **Realtime:** a Cloudflare **Durable Object** Worker using [`partyserver`](https://github.com/cloudflare/partykit) (the maintained successor to PartyKit; PartyKit's hosted CLI is folded into Cloudflare). Client uses `partysocket`. Deploys to **Cloudflare** via `wrangler`.

Two deploy targets. The app (Vercel) talks to the Worker (Cloudflare) over WebSockets. This split is intentional: Vercel has no long-lived WebSocket server, and a Durable Object gives one authoritative instance per lobby.

### Why server-authoritative
An earlier prototype made the host's browser the source of truth (state synced via polling). It died if the host closed the tab and had timer drift. The Worker now owns state, which fixes all three:
- The 60s turn timer is driven by a Durable Object **alarm**, not a client clock.
- The host can disconnect without killing the game; the crown auto-migrates to another connected player (`onClose`).
- Any player can refresh and reconnect into the live game.

---

## 3. Repo layout

```
gwen26/
├─ app/                       Next.js app (Vercel)
│  ├─ layout.tsx              <head> font links (fallbacks) + metadata
│  ├─ globals.css             theme tokens + all component styles
│  ├─ page.tsx                home: name entry, create/join lobby
│  └─ room/[code]/page.tsx    reads code from URL, mounts <Game>
├─ components/
│  ├─ Board.tsx               4x4 board (free / editable / markable cells)
│  └─ Game.tsx                all screens: TopBar, Lobby, Setup, Play, RoundEnd, Done
├─ lib/
│  ├─ game.ts                 *** SHARED *** types + constants + rules + reducer
│  ├─ useRoom.ts              partysocket hook -> { state, send, pid, connected }
│  └─ id.ts                   localStorage player id + name
├─ public/fonts/README.txt    where licensed fonts go
├─ partyserver/               Cloudflare Worker (deploy separately)
│  ├─ src/server.ts           Lobby Durable Object; imports ../../lib/game
│  ├─ wrangler.jsonc          DO binding + SQLite migration
│  ├─ tsconfig.json           includes ../lib for typecheck
│  └─ package.json            partyserver + wrangler
├─ package.json               Next app deps
├─ tsconfig.json              @/* -> ./*  ; excludes partyserver/
├─ next.config.mjs
├─ .env.local.example         NEXT_PUBLIC_PARTYKIT_HOST
└─ README.md                  user-facing setup/deploy guide
```

### Critical detail: `lib/game.ts` is shared by both runtimes
It is the single source of truth for rules. It is bundled into the Next app **and** imported by the Worker via the relative path `../../lib/game` from `partyserver/src/server.ts`. Keep it **pure**: no DOM, no Node, no Worker APIs. It may use `Math.random`, `Date.now`, and `structuredClone` (all available in both browser and workerd). If you add rules, add them here, not in the client.

---

## 4. Game rules (authoritative spec)

Board is 4x4. Free spaces are fixed at indices **2, 7, 8, 14**; the other 12 (`FILLABLE`) are user-filled.

```
. . F .
. . . F
F . . .
. . F .
```

Per round:
1. Each team is dealt 5 secret "Things" cards (words from `DECK`).
2. Before swapping, each team fills its own board with predictions of words the **opposing** team will say out loud while guessing.
3. Cards swap: a team guesses the *other* team's drawn cards.
4. On a team's 60s turn, one person describes and teammates guess. **+1 per card guessed** (max 5).
5. The **listening** team marks its own board when it hears a predicted word. A full board (all 12 fillable squares marked; free spaces auto-count) = **bingo, +3** for that team.
6. 3 rounds, fresh cards + boards each round. Most points wins.

### Scoring mapping (do not get this backwards)
- `turn` = the team currently **guessing**. `listening = otherTeam(turn)`.
- The guessing team sees `deck[listening]` (the cards the other team drew).
- `got[turn]` tracks which of those 5 the guessing team got.
- The listening team marks `boards[listening]`. If `boardFull(boards[listening])`, the listening team scores +3.
- Round tally: `score[T] += count(got[T]) + (boardFull(boards[T]) ? 3 : 0)` for each team T. (A team's board fills up during the *other* team's turn, which is consistent with the above.)

This is implemented in `reduce()` (`tally` case) in `lib/game.ts`. Trust that file over this prose if they ever diverge.

---

## 5. Realtime protocol

One Durable Object instance per lobby; the room name is the lobby code (via `routePartykitRequest`, which matches `/parties/:server/:name`). Binding class is `Lobby`, so the client connects with `party: "lobby"` (kebab-case of the binding name).

**State** (`GameState` in `lib/game.ts`) is persisted to `this.ctx.storage` under key `"state"` and re-broadcast on every change. Shape includes: `code, hostId, phase, players[], round, shuffled[], deck{A,B}, boards{A,B}, got{A,B}, turn, turnActive, turnEndsAt, turnsDone{A,B}, scores{A,B}, roundBreakdown`. `phase` is one of `lobby | setup | play | roundEnd | done`.

**Client -> server** (`ClientMsg`): `hello`, `setName`, `switchTeam`, `start`, `saveBoard`, `mark`, `got`, `startTurn`, `endTurn`, `tally`, `nextRound`, `reset`.

**Server -> client** (`ServerMsg`): `{ type: "state", state }` only. The client never mutates state locally; it sends actions and renders whatever it receives. No optimistic updates (latency is sub-100ms over WS; this avoids divergence).

**Identity:** client generates a UUID in `localStorage` (`lib/id.ts`), passes it as the `partysocket` connection `id`, and sends `{type:"hello", id, name}` on every (re)connect. Server stores `playerId` on the connection via `connection.setState({playerId})` and resolves the sender as `hello.id` -> `connection.state.playerId` -> `connection.id`.

**Authority/validation** lives entirely in `reduce(prev, msg, sid)`:
- Host-only actions check `state.hostId === sid`.
- `saveBoard`/`mark`/`got` check the sender is a seated player on the relevant team and the phase/turn is valid.
- `reduce` returns `{ state, alarm? }` where `alarm` is a timestamp to set, `null` to clear, or `undefined` to leave alone. The server applies the alarm to `this.ctx.storage`.

**Timer:** `startTurn` sets `turnEndsAt = now + 60s` and returns `alarm: turnEndsAt`. `onAlarm()` ends the turn if it is still active and time has passed. The client only *displays* the countdown (computed from `turnEndsAt`).

**Host migration:** `onClose` checks whether the disconnecting connection was the host's last open connection; if so it promotes another present player to `hostId`.

`partyserver` API used (verified against the current README): lifecycle `onStart / onConnect / onMessage / onClose / onAlarm`; `this.ctx.storage.{get,put,getAlarm,setAlarm,deleteAlarm}`; `broadcast(msg, exclude?)`; `getConnections()`; `this.name`; `connection.setState()/state`; `static options = { hibernate: true }`. Do **not** override `alarm()` directly; use `onAlarm()`.

---

## 6. Styling

A bright spring/summer theme. All tokens are at the top of `app/globals.css`.
- **Accent:** lemon yellow (`--lemon`), used for points, bingo, and primary CTAs.
- **Team Meadow = Team A:** pastel green (`--green`). **Team Sky = Team B:** pastel blue (`--blue`).
- Light background gradient (pale sky to warm cream). Dark leaf-green ink.
- Dynamic team color is applied by setting `--accent`/`--accent-deep`/`--soft` CSS custom properties inline on elements (see `teamVars()` in `Game.tsx`).

**Fonts** (both commercial, not in the repo):
- Headings: **Superior Title**, *italic* (Sharp Type).
- Body: **Mundial** (Latinotype).
- Wired via `@font-face` in `globals.css` pointing to `/fonts/*.woff2`. Until those files exist, the stack falls back to **Fraunces** (italic) and **Onest**, loaded from Google Fonts in `layout.tsx`. So the app renders correctly without the licensed files; it just upgrades when they are added. Expected filenames: `SuperiorTitle-Italic.woff2`, `Mundial-Regular.woff2`, `Mundial-Bold.woff2`.

**Free spaces** = the recipient's favourite things, configured in `FREE_SPACES` in `lib/game.ts` (emoji + label per board index):
- idx 2: 🍋 a lemon
- idx 7: 🌻 sunflowers & mums
- idx 8: 🍯 the hunny pot
- idx 14: ☀️ a sunny day

IP note: the "hunny pot" square deliberately uses a generic honey-pot emoji, **not** Disney's Winnie-the-Pooh artwork, which is copyrighted. If anyone swaps in custom art for the free spaces, confirm rights first. There are 4 free squares but only 3 favourites were given; "a sunny day" was added as the 4th to fit the theme and is safe to change.

---

## 7. Local dev

Two terminals.

```bash
# 1) realtime Worker
cd partyserver
npm install
npm run dev            # wrangler dev -> 127.0.0.1:8787

# 2) web app (repo root)
npm install
cp .env.local.example .env.local      # defaults to 127.0.0.1:8787
npm run dev            # -> localhost:3000
```

Open multiple tabs/devices on `localhost:3000`, create a lobby, join with the code.

---

## 8. Deployment

### Worker -> Cloudflare
```bash
cd partyserver
npx wrangler login
npx wrangler deploy
```
Prints `https://gwen26-party.<subdomain>.workers.dev`. The `<subdomain>` is the account's one-time workers.dev subdomain. Durable Objects here use SQLite storage (`new_sqlite_classes` in `wrangler.jsonc`) so they run on the free Workers plan.

### App -> Vercel
1. Import the GitHub repo. Framework = Next.js.
2. Env var: `NEXT_PUBLIC_PARTYKIT_HOST = gwen26-party.<subdomain>.workers.dev` (no protocol; client infers `wss://`).
3. Deploy. Redeploy after changing the env var.

---

## 9. CURRENT BLOCKER (unresolved as of handoff)

`https://gwen26.vercel.app/` returns a **page-level 404**. The app code is correct (`app/page.tsx` is a valid root route), so this is a deploy/layout problem. In priority order:

1. **Files nested one level too deep (most likely).** The project was delivered as a zip whose top folder is `gwen26/`. If that folder was pushed into the repo as-is, the repo root is `gwen26/app/...` instead of `app/...`, and Vercel (building from repo root) finds no Next app -> 404.
   - Fix A (Vercel): Settings -> Build & Deployment -> **Root Directory** = `gwen26`, redeploy.
   - Fix B (repo): move the app contents up to the repo root and push.
   - **Verify which:** look at the repo root on GitHub. Do `app/`, `package.json`, `next.config.mjs` sit at the top, or are they inside a `gwen26/` folder?
2. **Production branch mismatch.** Vercel's Production Branch (Settings -> Git) does not match the pushed branch (e.g. pushed `master`, Vercel builds `main`).
3. **Build failed.** Check the deployment's build logs; a failed build leaves the previous 404 in place.

The agent should confirm the repo's actual root layout first (the GitHub API was rate-limited during the prior session, so this was never visually confirmed), then apply the matching fix. Note: `NEXT_PUBLIC_PARTYKIT_HOST` does **not** affect the 404; without it the page still loads and only realtime fails.

---

## 10. Known constraints / gotchas

- `lib/game.ts` must stay runtime-agnostic (see section 3). Adding a browser/Node import there will break the Worker bundle.
- The Worker's `tsconfig.json` includes `../lib/**/*.ts` so the shared file type-checks in the Worker context; `wrangler` bundles the relative import via esbuild.
- The root `tsconfig.json` **excludes** `partyserver/` so the Next build does not try to compile Worker code.
- Connection state across hibernation is not fully relied upon; clients resend `hello` on every open, so `playerId` is always recoverable.
- Lobby codes are 5 chars from an unambiguous alphabet (no `0/O/1/I`). Collisions are possible but astronomically unlikely; a "create" that lands on an existing active code would simply join it.
- No auth, no persistence cleanup/TTL on old finished rooms (storage is cheap; add an alarm-based sweep if desired).
- Concurrent board edits within a team are last-write-wins; in practice one person types a team's board.

---

## 11. Roadmap (not started)

Build into the same shell, reusing the lobby/teams/scoring and the shared-reducer pattern:
- **Name a Number** round.
- **Sam Says** round.

Each new round = new `phase` values + new `ClientMsg` cases in `reduce()`, plus a screen component in `Game.tsx`. Keep all rule logic in `lib/game.ts`. Carry `scores` across rounds; the existing `done` phase already shows a cumulative winner.

---

## 12. Verification done so far

All TS/TSX files and the Worker were bundle-checked with esbuild (syntax + import resolution clean). Full `tsc`/`next build` and an end-to-end multiplayer run were **not** performed in the build environment. The agent should run `npm run build` (app) and `npx wrangler deploy --dry-run` (Worker), then do a live 2-tab smoke test, before trusting it.