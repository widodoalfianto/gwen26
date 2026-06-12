// Shared, pure game logic. No DOM / Node / Worker APIs so it can be bundled
// by both the Next.js app (browser) and the Cloudflare Worker.

export type Team = "A" | "B";

// Per-turn flow:
//   lobby → fill → ready → guess → (next turn) … → done
// A "round" is one Meadow turn + one Sky turn. The game runs until everyone
// on both teams has been the guesser at least once (maxRounds = the larger
// team's size; the smaller team re-uses guessers on its extra rounds).
export type Phase = "lobby" | "fill" | "ready" | "guess" | "done";

export interface Player {
  id: string;
  name: string;
  team: Team;
}
export interface Board {
  words: string[]; // length 16, free indices hold ""
  marked: boolean[]; // length 16
  locked: boolean;
}
// A completed turn, kept for the end-of-game reveal. Hidden until `done`.
export interface TurnLog {
  round: number;
  team: Team; // the guessing team
  guesserName: string;
  words: string[]; // the 5 secret words
  gotCount: number; // words[0..gotCount-1] were guessed (right); the rest weren't
  boardTeam: Team; // the listening team that owned the board
  board: { words: string[]; marked: boolean[] };
  bingo: boolean; // full board → +3 for boardTeam
}
export interface GameState {
  code: string;
  hostId: string | null;
  phase: Phase;
  players: Player[];

  // progression
  maxRounds: number; // max(|A|, |B|)
  turnNo: number; // 0-based global turn counter; G = turnNo even ? A : B
  shuffled: string[]; // word pool for the whole game (5 per turn)
  guessedIds: { A: string[]; B: string[] }; // who has guessed (random w/o replacement)

  // current turn
  turnTeam: Team | null; // the GUESSING team this turn (G); listener L = other(G)
  guesserId: string | null; // the picked guesser on G (never sees the words)
  boardHolderId: string | null; // the ONE listener (on L) who fills + marks the board
  secret: string[]; // 5 secret words; the whole guessing team is blind to these
  board: Board; // the listening team's board for this turn
  revealIdx: number; // during guess, words are revealed one-by-one; also = # gotten
  ready: string[]; // player ids who tapped Ready (ready phase)
  turnActive: boolean;
  turnEndsAt: number | null;

  // accrued server-side, hidden from clients until `done` (see server broadcast)
  scores: { A: number; B: number };
  history: TurnLog[]; // completed turns; revealed only at `done`
  usedWords: string[]; // words spent this session (persists across replays)
}

export type ClientMsg =
  | { type: "hello"; id: string; name: string }
  | { type: "setName"; name: string }
  | { type: "switchTeam"; playerId: string }
  | { type: "shuffleTeams" } // host: randomize everyone into fresh teams
  | { type: "start" }
  | { type: "saveBoard"; words: string[]; lock: boolean } // board-holder only
  | { type: "ready" }
  | { type: "got" } // a describer: the guesser got the current word → reveal next
  | { type: "mark"; idx: number } // board-holder only
  | { type: "forceStart" } // host: skip the ready gate
  | { type: "endTurn" } // host: end the 60s early
  | { type: "reset" };

export type ServerMsg = { type: "state"; state: GameState };

/* ---------------- constants ---------------- */

export const TURN_SECONDS = 60;
export const SECRETS_PER_TURN = 5;
export const MIN_PER_TEAM = 2;
export const MAX_PER_TEAM = 5;
export const MIN_PLAYERS = MIN_PER_TEAM * 2; // 4
export const MAX_PLAYERS = MAX_PER_TEAM * 2; // 10

// Free-space layout matches the physical board:
//   . . F .
//   . . . F
//   F . . .
//   . . F .
export const FREE_SET = new Set<number>([2, 7, 8, 14]);
export const FILLABLE: number[] = [0, 1, 3, 4, 5, 6, 9, 10, 11, 12, 13, 15];

// Gwen's favourite things live in the free spaces. `img` is preferred; `emoji`
// is the fallback until the image file exists in /public.
export const FREE_SPACES: { idx: number; img: string; emoji: string; label: string }[] = [
  { idx: 2, img: "/images/free/calcifer.png", emoji: "🔥", label: "Calcifer" },
  { idx: 7, img: "/images/free/kiki.png", emoji: "🐈‍⬛", label: "Kiki" },
  { idx: 8, img: "/images/free/pooh.png", emoji: "🍯", label: "Pooh" },
  { idx: 14, img: "/images/free/totoro.png", emoji: "🌳", label: "Totoro" },
];

export const TEAM_LABEL: Record<Team, string> = { A: "Dragon", B: "Champ" };

// Priority words — Gwen's inside jokes / favourites. These go into play FIRST
// in a session (shuffled), before anything from the general WORD_BANK.
export const PRIORITY: string[] = [
  "Gwen","IFGF","Shiki","Los Angeles","Seattle","Pooh","Go Greek","Banner","Doom Scroll",
  "Costco","In-N-Out","Birthday","Quarter Life Crisis","Jesus","Jerusalem","Moses","Iran",
  "FIFA","I-5","Lactose Intolerant","The boys","Trojan","Oysters","The Spheres","#sea-for-sale",
  "Facebook Marketplace","Green Lake","Seatac airport","The Link","Irvine","Salmon","Sushi",
  "Pizza","Disneyland","Basil","Chocolate","Australian shepherd","Avocado Toast",
  "Vietnamese Coffee","Matcha","Pickles","Trader Joe's","WhatsApp","Instagram","YouTube",
  "Justin Bieber","Coachella","Pearl","REI","Uniqlo","Soy Sauce","Ramen",
];

// General bank — life in America in your mid-20s + current trends. Used once the
// PRIORITY words are exhausted across replays. No overlap with PRIORITY.
export const WORD_BANK: string[] = [
  // apps & tech
  "TikTok","Spotify","Venmo","Zelle","Discord","Reddit","Twitch","LinkedIn","Snapchat","ChatGPT",
  "Notion","Slack","Zoom","AirPods","iPhone","Tesla","Uber","Lyft","DoorDash","Airbnb",
  "Netflix","Threads","BeReal","Robinhood","Cash App",
  // food & drink
  "Chipotle","Sweetgreen","Boba","Cold brew","Oat milk","Acai bowl","Erewhon","Shake Shack","Five Guys","Korean BBQ",
  "Hot pot","Dumplings","Kombucha","Celsius","Liquid Death","White Claw","Espresso martini","Natural wine","Smashburger","Pho",
  "Kimchi","Tacos","Burrito","Bagel","Croissant","Pancakes","Hot Cheetos","Takis","Gatorade","Energy drink",
  // fitness & lifestyle
  "Pilates","Hot yoga","Peloton","Marathon","Run club","CrossFit","Protein shake","Meal prep","Stanley cup","Lululemon",
  "Crocs","Birkenstocks","New Balance","Skincare","Sunscreen","Retinol","Gym","Sauna","Cold plunge","Hot girl walk",
  "Thrifting","Depop","Yoga","Hiking","Camping",
  // money & work
  "Roth IRA","401k","Crypto","Bitcoin","Side hustle","Freelance","Remote work","Layoffs","Burnout","Startup",
  "Student loans","Rent","Roommates","Inflation","Recession","Networking","Internship","Promotion","Resume","Taxes",
  // dating & social
  "Hinge","Tinder","Bumble","Situationship","Ghosting","Red flag","Green flag","The ick","Talking stage","Cuffing season",
  "Soft launch","Third wheel","Wingman","Blind date","Double date","Group chat","Wedding","Bridesmaid","Bachelor party","Breakup",
  // entertainment & culture
  "Taylor Swift","Eras Tour","Beyonce","Drake","Kendrick Lamar","Bad Bunny","Sabrina Carpenter","Olivia Rodrigo","SZA","Marvel",
  "Barbie","Oppenheimer","A24","Euphoria","The Bear","Stranger Things","Wordle","Spotify Wrapped","Podcast","True crime",
  "Love Island","The Bachelor","Anime","K-pop","Formula 1","Super Bowl","March Madness","NBA","Karaoke","Concert",
  // places & travel
  "New York","Brooklyn","Austin","Miami","Nashville","Portland","San Diego","San Francisco","Chicago","Denver",
  "Las Vegas","Road trip","National park","Joshua Tree","Big Sur","Cabo","Tulum","Tokyo","Euro trip","Hostel",
  "Layover","TSA","Cruise","Beach","Ski trip",
  // slang & trends
  "Rizz","Delulu","Slay","Mid","Vibe check","Main character","NPC","Glow up","Gatekeep","Girlboss",
  "Touch grass","Brain rot","Mercury retrograde","Manifesting","Astrology","Therapy","Self-care","Side eye","Bestie","FOMO",
  "Hot take","Plot twist","Labubu","Dubai chocolate","Crumbl Cookies",
];

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/* ---------------- helpers ---------------- */

export const otherTeam = (t: Team): Team => (t === "A" ? "B" : "A");
export const teamOf = (s: GameState, t: Team): Player[] => s.players.filter((p) => p.team === t);

export function makeCode(): string {
  let c = "";
  for (let i = 0; i < 5; i++) c += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return c;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function emptyBoard(): Board {
  return { words: Array<string>(16).fill(""), marked: Array<boolean>(16).fill(false), locked: false };
}

export function boardFull(b: Board | undefined): boolean {
  if (!b) return false;
  return FILLABLE.every((i) => b.words[i] && b.words[i].trim() !== "" && b.marked[i]);
}
export function boardFilledCount(b: Board | undefined): number {
  if (!b) return 0;
  return FILLABLE.filter((i) => b.words[i] && b.words[i].trim() !== "").length;
}

export function canStart(s: GameState): boolean {
  const a = teamOf(s, "A").length;
  const b = teamOf(s, "B").length;
  return a >= MIN_PER_TEAM && b >= MIN_PER_TEAM && a <= MAX_PER_TEAM && b <= MAX_PER_TEAM;
}

export const roundOf = (turnNo: number): number => Math.floor(turnNo / 2) + 1;
export const listeningTeam = (s: GameState): Team | null => (s.turnTeam ? otherTeam(s.turnTeam) : null);

export function initialState(code: string): GameState {
  return {
    code,
    hostId: null,
    phase: "lobby",
    players: [],
    maxRounds: 0,
    turnNo: 0,
    shuffled: [],
    guessedIds: { A: [], B: [] },
    turnTeam: null,
    guesserId: null,
    boardHolderId: null,
    secret: [],
    board: emptyBoard(),
    revealIdx: 0,
    ready: [],
    turnActive: false,
    turnEndsAt: null,
    scores: { A: 0, B: 0 },
    history: [],
    usedWords: [],
  };
}

// Draw `n` fresh words for a game: priority words first (shuffled), then the
// general bank, skipping anything already used this session. Recycles when the
// whole vocabulary has been spent. Returns the drawn words and the updated
// used-list to store back on state.
export function drawWords(used: string[], n: number): { words: string[]; used: string[] } {
  const spent = new Set(used);
  const pool = [
    ...shuffle(PRIORITY.filter((w) => !spent.has(w))),
    ...shuffle(WORD_BANK.filter((w) => !spent.has(w))),
  ];
  if (pool.length < n) {
    const words = [...shuffle(PRIORITY), ...shuffle(WORD_BANK)].slice(0, n);
    return { words, used: words }; // recycled — start the session's used-list over
  }
  const words = pool.slice(0, n);
  return { words, used: [...used, ...words] };
}

// Duplicate words aren't allowed on a board (case-insensitive).
export function boardDupes(words: string[]): Set<number> {
  const seen = new Map<string, number>();
  const dupes = new Set<number>();
  for (const i of FILLABLE) {
    const w = (words[i] || "").trim().toLowerCase();
    if (!w) continue;
    if (seen.has(w)) {
      dupes.add(i);
      dupes.add(seen.get(w)!);
    } else {
      seen.set(w, i);
    }
  }
  return dupes;
}

/* ---------------- turn orchestration ---------------- */

// Random guesser, without replacement until everyone on the team has gone.
function pickGuesser(s: GameState, team: Team): string | null {
  const members = teamOf(s, team).map((p) => p.id);
  if (members.length === 0) return null;
  let pool = members.filter((id) => !s.guessedIds[team].includes(id));
  if (pool.length === 0) {
    s.guessedIds[team] = [];
    pool = members;
  }
  const pick = pool[Math.floor(Math.random() * pool.length)];
  s.guessedIds[team].push(pick);
  return pick;
}

function pickRandom(s: GameState, team: Team): string | null {
  const members = teamOf(s, team).map((p) => p.id);
  if (members.length === 0) return null;
  return members[Math.floor(Math.random() * members.length)];
}

// Configure state for the turn indexed by s.turnNo. Meadow (A) guesses on even
// turns, Sky (B) on odd turns. The listening team gets one board-holder.
function setupTurn(s: GameState): void {
  const G: Team = s.turnNo % 2 === 0 ? "A" : "B";
  const L = otherTeam(G);
  s.turnTeam = G;
  s.guesserId = pickGuesser(s, G);
  s.boardHolderId = pickRandom(s, L);
  s.secret = s.shuffled.slice(s.turnNo * SECRETS_PER_TURN, s.turnNo * SECRETS_PER_TURN + SECRETS_PER_TURN);
  s.board = emptyBoard();
  s.revealIdx = 0;
  s.ready = [];
  s.turnActive = false;
  s.turnEndsAt = null;
  s.phase = "fill";
}

// End the current 60s turn: accrue the (hidden) score, then advance to the next
// turn or to the final reveal.
function concludeTurn(s: GameState): void {
  const G = s.turnTeam;
  if (G) {
    const L = otherTeam(G);
    const bingo = boardFull(s.board);
    s.scores[G] += s.revealIdx; // words gotten (sequential, no skips)
    if (bingo) s.scores[L] += 3;
    s.history.push({
      round: roundOf(s.turnNo),
      team: G,
      guesserName: s.players.find((p) => p.id === s.guesserId)?.name ?? "Someone",
      words: [...s.secret],
      gotCount: s.revealIdx,
      boardTeam: L,
      board: { words: [...s.board.words], marked: [...s.board.marked] },
      bingo,
    });
  }
  s.turnActive = false;
  s.turnEndsAt = null;
  s.turnNo += 1;
  if (s.turnNo >= s.maxRounds * 2) {
    s.phase = "done";
  } else {
    setupTurn(s);
  }
}

// Called by the server when the turn alarm fires.
export function onTimeout(prev: GameState): ReduceResult {
  if (prev.phase !== "guess" || !prev.turnActive) return { state: prev };
  const s = structuredClone(prev);
  concludeTurn(s);
  return { state: s, alarm: null };
}

/* ---------------- reducer (authoritative; runs on the server) ----------------
   Returns the next state and, optionally, an alarm timestamp to set (number)
   or clear (null). `undefined` means leave the alarm alone. */

export interface ReduceResult {
  state: GameState;
  alarm?: number | null;
}

export function reduce(prev: GameState, msg: ClientMsg, sid: string): ReduceResult {
  const s: GameState = structuredClone(prev);
  const isHost = () => s.hostId === sid;
  const me = () => s.players.find((p) => p.id === sid);

  switch (msg.type) {
    case "hello": {
      let p = s.players.find((x) => x.id === msg.id);
      if (!p) {
        if (s.phase !== "lobby" || s.players.length >= MAX_PLAYERS) return { state: prev };
        const a = teamOf(s, "A").length;
        const b = teamOf(s, "B").length;
        s.players.push({ id: msg.id, name: msg.name || "Player", team: a <= b ? "A" : "B" });
      } else if (msg.name && p.name !== msg.name) {
        p.name = msg.name;
      }
      if (!s.hostId) s.hostId = msg.id;
      return { state: s };
    }
    case "setName": {
      const p = me();
      if (p && msg.name) p.name = msg.name;
      return { state: s };
    }
    case "switchTeam": {
      if (!isHost() || s.phase !== "lobby") return { state: prev };
      const p = s.players.find((x) => x.id === msg.playerId);
      if (!p) return { state: prev };
      const dest = otherTeam(p.team);
      if (teamOf(s, dest).length >= MAX_PER_TEAM) return { state: prev };
      p.team = dest;
      return { state: s };
    }
    case "shuffleTeams": {
      if (!isHost() || s.phase !== "lobby") return { state: prev };
      s.players = shuffle(s.players).map((p, i) => ({ ...p, team: i % 2 === 0 ? "A" : "B" }));
      return { state: s };
    }
    case "start": {
      if (!isHost() || s.phase !== "lobby" || !canStart(s)) return { state: prev };
      s.maxRounds = Math.max(teamOf(s, "A").length, teamOf(s, "B").length);
      const need = s.maxRounds * 2 * SECRETS_PER_TURN;
      const draw = drawWords(s.usedWords, need);
      s.shuffled = draw.words;
      s.usedWords = draw.used;
      s.guessedIds = { A: [], B: [] };
      s.scores = { A: 0, B: 0 };
      s.history = [];
      s.turnNo = 0;
      setupTurn(s);
      return { state: s, alarm: null };
    }
    case "saveBoard": {
      // Only the designated board-holder fills the board, and only during `fill`.
      const p = me();
      if (!p || s.phase !== "fill" || p.id !== s.boardHolderId) return { state: prev };
      if (s.board.locked) return { state: prev };
      const words = s.board.words.slice();
      for (let i = 0; i < 16; i++) if (!FREE_SET.has(i)) words[i] = (msg.words[i] ?? "").slice(0, 24);
      // Don't lock if the board has duplicate words.
      const lock = !!msg.lock && boardDupes(words).size === 0;
      s.board = { ...s.board, words, locked: lock };
      if (lock) {
        s.phase = "ready";
        s.ready = [];
      }
      return { state: s };
    }
    case "ready": {
      // Everyone readies up; the last one in starts the 60s automatically.
      const p = me();
      if (!p || s.phase !== "ready") return { state: prev };
      if (s.ready.includes(p.id)) s.ready = s.ready.filter((id) => id !== p.id);
      else s.ready = [...s.ready, p.id];
      if (s.players.every((pl) => s.ready.includes(pl.id))) {
        s.phase = "guess";
        s.turnActive = true;
        s.turnEndsAt = Date.now() + TURN_SECONDS * 1000;
        return { state: s, alarm: s.turnEndsAt };
      }
      return { state: s };
    }
    case "forceStart": {
      if (!isHost() || s.phase !== "ready") return { state: prev };
      s.phase = "guess";
      s.turnActive = true;
      s.turnEndsAt = Date.now() + TURN_SECONDS * 1000;
      return { state: s, alarm: s.turnEndsAt };
    }
    case "got": {
      // A describer (non-guesser on the guessing team) confirms the guesser got
      // the current word; reveal the next one. No skipping — only ever advances.
      const p = me();
      if (s.phase !== "guess" || !s.turnActive || !s.turnTeam || !p) return { state: prev };
      if (p.team !== s.turnTeam || p.id === s.guesserId) return { state: prev };
      if (s.revealIdx >= SECRETS_PER_TURN) return { state: prev };
      s.revealIdx += 1;
      if (s.revealIdx >= SECRETS_PER_TURN) {
        concludeTurn(s); // all five gotten — end the turn early
        return { state: s, alarm: null };
      }
      return { state: s };
    }
    case "mark": {
      // Only the board-holder marks the board when the team hears a word.
      const p = me();
      if (s.phase !== "guess" || !s.turnActive || !p) return { state: prev };
      if (p.id !== s.boardHolderId || FREE_SET.has(msg.idx)) return { state: prev };
      const marked = s.board.marked.slice();
      marked[msg.idx] = !marked[msg.idx];
      s.board = { ...s.board, marked };
      return { state: s };
    }
    case "endTurn": {
      if (!isHost() || s.phase !== "guess") return { state: prev };
      concludeTurn(s);
      return { state: s, alarm: null };
    }
    case "reset": {
      // "Play again": reshuffle players into fresh random teams, keep the
      // session's used-words so priority words keep getting spent first.
      if (!isHost()) return { state: prev };
      const ns = initialState(s.code);
      ns.hostId = s.hostId;
      ns.usedWords = s.usedWords;
      ns.players = shuffle(s.players).map((p, i) => ({ ...p, team: i % 2 === 0 ? "A" : "B" }));
      return { state: ns, alarm: null };
    }
    default:
      return { state: prev };
  }
}
