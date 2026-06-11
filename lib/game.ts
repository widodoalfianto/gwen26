// Shared, pure game logic. No DOM / Node / Worker APIs so it can be bundled
// by both the Next.js app (browser) and the Cloudflare Worker.

export type Team = "A" | "B";
export type Phase = "lobby" | "setup" | "play" | "roundEnd" | "done";

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
export interface RoundBreakdown {
  A: { guess: number; bingo: boolean };
  B: { guess: number; bingo: boolean };
}
export interface GameState {
  code: string;
  hostId: string | null;
  phase: Phase;
  players: Player[];
  round: number;
  shuffled: string[];
  deck: { A: string[]; B: string[] };
  boards: { A: Board; B: Board };
  got: { A: boolean[]; B: boolean[] };
  turn: Team | null; // team currently guessing
  turnActive: boolean;
  turnEndsAt: number | null;
  turnsDone: { A: boolean; B: boolean };
  scores: { A: number; B: number };
  roundBreakdown: RoundBreakdown | null;
}

export type ClientMsg =
  | { type: "hello"; id: string; name: string }
  | { type: "setName"; name: string }
  | { type: "switchTeam"; playerId: string }
  | { type: "start" }
  | { type: "saveBoard"; team: Team; words: string[]; lock: boolean }
  | { type: "mark"; team: Team; idx: number }
  | { type: "got"; team: Team; idx: number }
  | { type: "startTurn"; team: Team }
  | { type: "endTurn" }
  | { type: "tally" }
  | { type: "nextRound" }
  | { type: "reset" };

export type ServerMsg = { type: "state"; state: GameState };

/* ---------------- constants ---------------- */

export const TURN_SECONDS = 60;
export const ROUNDS = 3;

// Free-space layout matches the physical board:
//   . . F .
//   . . . F
//   F . . .
//   . . F .
export const FREE_SET = new Set<number>([2, 7, 8, 14]);
export const FILLABLE: number[] = [0, 1, 3, 4, 5, 6, 9, 10, 11, 12, 13, 15];

// Gwen's favourite things live in the free spaces.
export const FREE_SPACES: { idx: number; emoji: string; label: string }[] = [
  { idx: 2, emoji: "🍋", label: "a lemon" },
  { idx: 7, emoji: "🌻", label: "sunflowers & mums" },
  { idx: 8, emoji: "🍯", label: "the hunny pot" },
  { idx: 14, emoji: "☀️", label: "a sunny day" },
];

export const TEAM_LABEL: Record<Team, string> = { A: "Team Meadow", B: "Team Sky" };

export const DECK: string[] = [
  "Pizza","Volcano","Sunglasses","Robot","Penguin","Skateboard","Lightning","Cactus",
  "Treasure","Wizard","Tornado","Umbrella","Dinosaur","Rainbow","Spaceship","Pancake",
  "Mermaid","Lighthouse","Bicycle","Avocado","Jellyfish","Telescope","Marshmallow","Octopus",
  "Snowman","Cowboy","Vampire","Waterfall","Helicopter","Cupcake","Tiger","Compass",
  "Igloo","Trampoline","Hammock","Lobster","Pirate","Bubble","Cathedral","Ferris wheel",
  "Glacier","Hedgehog","Kangaroo","Lantern","Meteor","Nutcracker","Origami","Parachute",
  "Quicksand","Sandcastle","Tightrope","Unicorn","Violin","Windmill","Xylophone","Yo-yo",
  "Zeppelin","Anchor","Bonfire","Chandelier","Domino","Escalator","Flamingo","Gondola",
  "Harmonica","Iceberg","Jukebox","Kaleidoscope","Lava lamp","Magnet","Nest","Oasis",
  "Periscope","Quilt","Rollercoaster","Scarecrow","Tambourine","Tugboat","Vending machine","Whirlpool",
  "Acorn","Balloon","Cannon","Drumstick","Eclipse","Fountain","Gargoyle","Hamburger",
  "Joystick","Kite","Ladder","Microscope","Noodle","Otter","Pinwheel","Raccoon",
  "Saxophone","Toaster","Walrus","Anvil","Beehive","Catapult","Doughnut","Engine",
  "Fossil","Gnome","Hourglass","Iguana","Jackpot","Koala","Lasso","Mushroom",
  "Narwhal","Onion","Popcorn","Quokka","Rocket","Submarine","Trophy","Vortex","Wagon","Yeti",
];

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/* ---------------- helpers ---------------- */

export const otherTeam = (t: Team): Team => (t === "A" ? "B" : "A");

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

export function dealRound(shuffled: string[], round: number): { A: string[]; B: string[] } {
  const base = (round - 1) * 10;
  return { A: shuffled.slice(base, base + 5), B: shuffled.slice(base + 5, base + 10) };
}

export function emptyBoard(): Board {
  const words = Array<string>(16).fill("");
  return { words, marked: Array<boolean>(16).fill(false), locked: false };
}

export function boardFull(b: Board | undefined): boolean {
  if (!b) return false;
  return FILLABLE.every((i) => b.words[i] && b.words[i].trim() !== "" && b.marked[i]);
}
export function boardFilledCount(b: Board | undefined): number {
  if (!b) return 0;
  return FILLABLE.filter((i) => b.words[i] && b.words[i].trim() !== "").length;
}

const freshGot = () => [false, false, false, false, false];

export function initialState(code: string): GameState {
  return {
    code,
    hostId: null,
    phase: "lobby",
    players: [],
    round: 0,
    shuffled: [],
    deck: { A: [], B: [] },
    boards: { A: emptyBoard(), B: emptyBoard() },
    got: { A: freshGot(), B: freshGot() },
    turn: null,
    turnActive: false,
    turnEndsAt: null,
    turnsDone: { A: false, B: false },
    scores: { A: 0, B: 0 },
    roundBreakdown: null,
  };
}

/* ---------------- reducer (authoritative; runs on the server) ----------------
   Returns the next state and, optionally, an alarm timestamp to set
   (number) or clear (null). `undefined` means leave the alarm alone. */

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
        const a = s.players.filter((x) => x.team === "A").length;
        const b = s.players.filter((x) => x.team === "B").length;
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
      if (p) p.team = otherTeam(p.team);
      return { state: s };
    }
    case "start": {
      if (!isHost() || s.phase !== "lobby" || s.players.length < 2) return { state: prev };
      s.shuffled = shuffle(Array.from(new Set(DECK))).slice(0, ROUNDS * 10);
      s.round = 1;
      s.deck = dealRound(s.shuffled, 1);
      s.boards = { A: emptyBoard(), B: emptyBoard() };
      s.got = { A: freshGot(), B: freshGot() };
      s.phase = "setup";
      s.turn = null; s.turnActive = false; s.turnEndsAt = null;
      s.turnsDone = { A: false, B: false };
      s.roundBreakdown = null;
      return { state: s, alarm: null };
    }
    case "saveBoard": {
      const p = me();
      if (!p || p.team !== msg.team || s.phase !== "setup") return { state: prev };
      const b = s.boards[msg.team];
      if (b.locked) return { state: prev };
      const words = b.words.slice();
      for (let i = 0; i < 16; i++) if (!FREE_SET.has(i)) words[i] = (msg.words[i] ?? "").slice(0, 24);
      s.boards[msg.team] = { ...b, words, locked: msg.lock ? true : b.locked };
      return { state: s };
    }
    case "mark": {
      const p = me();
      const listening = s.turn ? otherTeam(s.turn) : null;
      if (s.phase !== "play" || !s.turnActive || !p || !listening) return { state: prev };
      if (p.team !== listening || msg.team !== listening || FREE_SET.has(msg.idx)) return { state: prev };
      const b = s.boards[msg.team];
      const marked = b.marked.slice();
      marked[msg.idx] = !marked[msg.idx];
      s.boards[msg.team] = { ...b, marked };
      return { state: s };
    }
    case "got": {
      const p = me();
      if (s.phase !== "play" || !s.turnActive || !s.turn || !p) return { state: prev };
      if (p.team !== s.turn || msg.team !== s.turn) return { state: prev };
      const g = s.got[msg.team].slice();
      g[msg.idx] = !g[msg.idx];
      s.got[msg.team] = g;
      return { state: s };
    }
    case "startTurn": {
      if (!isHost() || (s.phase !== "setup" && s.phase !== "play")) return { state: prev };
      if (s.turnsDone[msg.team]) return { state: prev };
      s.phase = "play";
      s.turn = msg.team;
      s.turnActive = true;
      s.turnEndsAt = Date.now() + TURN_SECONDS * 1000;
      return { state: s, alarm: s.turnEndsAt };
    }
    case "endTurn": {
      if (!isHost() || s.phase !== "play" || !s.turn) return { state: prev };
      s.turnActive = false;
      s.turnsDone = { ...s.turnsDone, [s.turn]: true };
      return { state: s, alarm: null };
    }
    case "tally": {
      if (!isHost() || s.phase !== "play" || !(s.turnsDone.A && s.turnsDone.B)) return { state: prev };
      const count = (g: boolean[]) => g.filter(Boolean).length;
      const aG = count(s.got.A), bG = count(s.got.B);
      const aB = boardFull(s.boards.A), bB = boardFull(s.boards.B);
      s.scores = { A: s.scores.A + aG + (aB ? 3 : 0), B: s.scores.B + bG + (bB ? 3 : 0) };
      s.roundBreakdown = { A: { guess: aG, bingo: aB }, B: { guess: bG, bingo: bB } };
      s.phase = "roundEnd";
      s.turnActive = false;
      return { state: s, alarm: null };
    }
    case "nextRound": {
      if (!isHost() || s.phase !== "roundEnd") return { state: prev };
      if (s.round >= ROUNDS) {
        s.phase = "done";
        return { state: s, alarm: null };
      }
      s.round += 1;
      s.deck = dealRound(s.shuffled, s.round);
      s.boards = { A: emptyBoard(), B: emptyBoard() };
      s.got = { A: freshGot(), B: freshGot() };
      s.phase = "setup";
      s.turn = null; s.turnActive = false; s.turnEndsAt = null;
      s.turnsDone = { A: false, B: false };
      s.roundBreakdown = null;
      return { state: s, alarm: null };
    }
    case "reset": {
      if (!isHost()) return { state: prev };
      const ns = initialState(s.code);
      ns.players = s.players.map((p) => ({ ...p }));
      ns.hostId = s.hostId;
      return { state: ns, alarm: null };
    }
    default:
      return { state: prev };
  }
}
