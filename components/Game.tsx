"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { type Room } from "@/lib/useRoom";
import { getName, setName as storeName } from "@/lib/id";
import { buzz, HAPTIC } from "@/lib/haptics";
import { SOUND, unlockAudio } from "@/lib/sound";
import { Board } from "./Board";
import {
  TEAM_LABEL,
  otherTeam,
  boardFull,
  boardFilledCount,
  boardDupes,
  FILLABLE,
  canStart,
  teamOf,
  roundOf,
  MIN_PER_TEAM,
  MAX_PER_TEAM,
  type Team,
  type GameState,
  type Player,
  type TurnLog,
} from "@/lib/game";

const accentOf = (t: Team) => (t === "A" ? "var(--green)" : "var(--blue)");
const accentDeepOf = (t: Team) => (t === "A" ? "var(--green-deep)" : "var(--blue-deep)");
const softOf = (t: Team) => (t === "A" ? "var(--green-soft)" : "var(--blue-soft)");

function teamVars(team: Team): React.CSSProperties {
  return {
    ["--accent" as string]: accentOf(team),
    ["--accent-deep" as string]: accentDeepOf(team),
    ["--soft" as string]: softOf(team),
  } as React.CSSProperties;
}

const nameOf = (state: GameState, id: string | null) =>
  state.players.find((p) => p.id === id)?.name ?? "Someone";

const CONFETTI_COLORS = ["#e23b34", "#2f9e44", "#2b76c9", "#eab308", "#f2e989"];

function Confetti() {
  const bits = useMemo(
    () =>
      Array.from({ length: 46 }).map(() => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.7,
        dur: 2.4 + Math.random() * 1.8,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        w: 7 + Math.random() * 7,
      })),
    [],
  );
  return (
    <div className="confetti" aria-hidden="true">
      {bits.map((b, i) => (
        <span
          key={i}
          className="confetti-bit"
          style={{
            left: `${b.left}%`,
            width: b.w,
            height: b.w * 0.6,
            background: b.color,
            animationDelay: `${b.delay}s`,
            animationDuration: `${b.dur}s`,
          }}
        />
      ))}
    </div>
  );
}

function useCountUp(target: number, ms = 900): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

const RULES: React.ReactNode[] = [
  <>Each team is dealt 5 secret <b>words</b>.</>,
  <>One teammate is the <b>clue-giver</b> — only they see the words.</>,
  <>They describe (Taboo-style); the rest of the team shouts guesses. <b>+1</b> each.</>,
  <>The other team predicts those clues on their board. Full board = <b>bingo, +3</b>.</>,
  <>Everyone guesses once per team. Most points at the end wins.</>,
];

function RulesOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="overlay-card" onClick={(e) => e.stopPropagation()}>
        <div className="eyebrow">How a round works</div>
        <ol className="howto" style={{ marginTop: 12 }}>
          {RULES.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ol>
        <button className="btn btn--primary" style={{ marginTop: 16 }} onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
}

function CircleTimer({ remaining, total, active }: { remaining: number; total: number; active: boolean }) {
  const R = 44;
  const C = 2 * Math.PI * R;
  const frac = active ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const danger = active && remaining <= 10;
  const color = !active ? "var(--dim)" : danger ? "#ba1a1a" : "var(--ink)";
  return (
    <div className={`ctimer${danger ? " ctimer--danger" : ""}`}>
      <svg viewBox="0 0 100 100">
        <circle className="ctimer-track" cx="50" cy="50" r={R} />
        <circle
          className="ctimer-prog"
          cx="50"
          cy="50"
          r={R}
          style={{ stroke: color, strokeDasharray: C, strokeDashoffset: C * (1 - frac) }}
        />
      </svg>
      <span className="ctimer-num" style={{ color }}>
        {active ? remaining : "—"}
      </span>
    </div>
  );
}

function Instruct({ emoji, children }: { emoji: string; children: React.ReactNode }) {
  return (
    <div className="instruct">
      <span className="instruct-emoji">{emoji}</span>
      <div>{children}</div>
    </div>
  );
}

export default function Game({ room, code }: { room: Room; code: string }) {
  const { state, pid, connected, send } = room;
  const [now, setNow] = useState(() => Date.now());
  const [needsName, setNeedsName] = useState(() => typeof window !== "undefined" && !getName().trim());
  const [nameDraft, setNameDraft] = useState("");
  const [showRules, setShowRules] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  if (!state) {
    return (
      <main className="wrap">
        <div className="banner">{connected ? "Joining the lobby…" : "Connecting…"}</div>
      </main>
    );
  }

  // Joined via a shared link/QR without a name yet → ask for it right here.
  if (needsName) {
    const submitName = () => {
      const n = nameDraft.trim();
      if (!n) return;
      storeName(n);
      send({ type: "setName", name: n });
      setNeedsName(false);
    };
    return (
      <main className="wrap">
        <TopBar state={state} />
        <div className="card" style={{ marginTop: 22, textAlign: "center" }}>
          <div className="eyebrow">You&apos;re joining lobby {code}</div>
          <h2 className="display" style={{ fontSize: 28, margin: "8px 0 16px" }}>
            What&apos;s your name?
          </h2>
          <input
            className="input"
            value={nameDraft}
            maxLength={14}
            placeholder="e.g. Gwen"
            autoFocus
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitName()}
          />
          <div className="spacer" />
          <button className="btn btn--primary" disabled={!nameDraft.trim()} onClick={submitName}>
            Join the game →
          </button>
        </div>
      </main>
    );
  }

  const me = state.players.find((p) => p.id === pid) ?? null;
  const isHost = state.hostId === pid;
  // One phone per team plays sound: the first player on each team's roster.
  const amAudioLeader = !!me && state.players.find((p) => p.team === me.team)?.id === me.id;

  return (
    <main className="wrap">
      {showRules && <RulesOverlay onClose={() => setShowRules(false)} />}
      <TopBar state={state} onHelp={() => setShowRules(true)} />
      {state.phase === "lobby" && <Lobby state={state} send={send} me={me} isHost={isHost} code={code} />}
      {state.phase === "fill" && <Fill state={state} send={send} me={me} />}
      {state.phase === "ready" && <Ready state={state} send={send} me={me} isHost={isHost} />}
      {state.phase === "guess" && <Play state={state} send={send} me={me} now={now} isHost={isHost} audio={amAudioLeader} />}
      {state.phase === "done" && <Done state={state} send={send} isHost={isHost} audio={amAudioLeader} />}
      {!me && state.phase !== "lobby" && (
        <div className="banner">You&apos;re watching — this game is already underway.</div>
      )}
    </main>
  );
}

/* ---------------- top bar ---------------- */

function TopBar({ state, onHelp }: { state: GameState; onHelp?: () => void }) {
  const showRound = state.phase !== "lobby" && state.phase !== "done";
  return (
    <div className="topbar">
      <div className="display" style={{ fontSize: 26, color: "#d9ab00" }}>
        Gwen 26
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {showRound && (
          <span className="eyebrow">
            Round {roundOf(state.turnNo)}/{state.maxRounds}
          </span>
        )}
        {onHelp && (
          <button className="helpbtn" onClick={onHelp} aria-label="How to play">
            ?
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------- lobby ---------------- */

function Lobby({
  state,
  send,
  me,
  isHost,
  code,
}: {
  state: GameState;
  send: Room["send"];
  me: Player | null;
  isHost: boolean;
  code: string;
}) {
  const teams: Record<Team, Player[]> = { A: teamOf(state, "A"), B: teamOf(state, "B") };
  const ready = canStart(state);
  const total = state.players.length;

  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const joinUrl = origin ? `${origin}/room/${code}` : "";

  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && !!navigator.share;
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };
  const shareLink = () => {
    navigator.share?.({ title: "Gwen 26", text: "Join my game!", url: joinUrl }).catch(() => {});
  };

  return (
    <div>
      {!me && <div className="banner">Seating you in the lobby…</div>}
      <div style={{ textAlign: "center", margin: "10px 0 18px" }}>
        <div className="eyebrow">Your lobby code</div>
        <div className="display" style={{ fontSize: 52, color: "var(--lemon-deep)", marginTop: 4 }}>
          {code}
        </div>
        {joinUrl && (
          <>
            <div className="qrbox">
              <QRCodeSVG value={joinUrl} size={140} bgColor="#ffffff" fgColor="#1b1c18" level="M" marginSize={2} />
              <div className="eyebrow" style={{ marginTop: 8 }}>📷 Scan to join</div>
            </div>
            <div className="row" style={{ justifyContent: "center", gap: 8, marginTop: 12 }}>
              <button className="btn btn--ghost" style={{ width: "auto", padding: "10px 16px" }} onClick={copyLink}>
                {copied ? "Copied ✓" : "🔗 Copy link"}
              </button>
              {canShare && (
                <button className="btn btn--ghost" style={{ width: "auto", padding: "10px 16px" }} onClick={shareLink}>
                  Share
                </button>
              )}
            </div>
          </>
        )}
        <div className="muted" style={{ fontSize: 14, marginTop: 14 }}>
          {ready ? "Everyone in? Deal the cards." : `Need ${MIN_PER_TEAM}–${MAX_PER_TEAM} players per team.`}
        </div>
      </div>

      <div className="grid2">
        {(["A", "B"] as Team[]).map((t) => (
          <div key={t} className="teamcard" style={teamVars(t)}>
            <div className="teamhead">
              {TEAM_LABEL[t]} <span className="muted tiny">({teams[t].length})</span>
            </div>
            {teams[t].length === 0 && <div className="muted tiny">Empty</div>}
            {teams[t].map((p) => (
              <div
                key={p.id}
                className="playerchip"
                style={{ cursor: isHost && p.id !== me?.id ? "pointer" : "default" }}
                onClick={() => isHost && p.id !== me?.id && send({ type: "switchTeam", playerId: p.id })}
              >
                <span>
                  {p.name}
                  {p.id === state.hostId ? " 👑" : ""}
                  {p.id === me?.id ? " (you)" : ""}
                </span>
                {isHost && p.id !== me?.id && <span className="muted tiny">tap → swap</span>}
              </div>
            ))}
          </div>
        ))}
      </div>

      {isHost ? (
        <>
          {total >= 2 && (
            <button className="btn btn--ghost" style={{ marginTop: 18 }} onClick={() => send({ type: "shuffleTeams" })}>
              🔀 Shuffle teams
            </button>
          )}
          <button
            className="btn btn--primary"
            style={{ marginTop: 10 }}
            disabled={!ready}
            onClick={() => {
              unlockAudio();
              send({ type: "start" });
            }}
          >
            {ready ? "Deal the cards →" : `Need ${MIN_PER_TEAM}+ per team (${total} in)`}
          </button>
        </>
      ) : (
        <div className="banner">The host shuffles teams and starts the game once everyone&apos;s in.</div>
      )}
    </div>
  );
}

/* ---------------- shared bits ---------------- */

function SecretCards({ words, team }: { words: string[]; team: Team }) {
  return (
    <div className="card" style={{ padding: 14, marginBottom: 14 }}>
      <div className="eyebrow">The secret words</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
        {words.map((w, i) => (
          <span
            key={i}
            className="display"
            style={{
              background: softOf(team),
              border: `1px solid ${accentOf(team)}`,
              borderRadius: 10,
              padding: "6px 14px",
              fontSize: 20,
            }}
          >
            {w}
          </span>
        ))}
      </div>
    </div>
  );
}

function Blind({ title, emoji, children }: { title: string; emoji: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ textAlign: "center", padding: "32px 18px" }}>
      <div style={{ fontSize: 50 }}>{emoji}</div>
      <h2 className="display" style={{ fontSize: 26, margin: "6px 0 0" }}>
        {title}
      </h2>
      <p className="muted" style={{ fontSize: 18, margin: "20px 0 0", lineHeight: 1.5 }}>
        {children}
      </p>
    </div>
  );
}

/* ---------------- fill (listening team predicts) ---------------- */

function Fill({ state, send, me }: { state: GameState; send: Room["send"]; me: Player | null }) {
  const G = state.turnTeam!;
  const L = otherTeam(G);
  const clueGiverName = nameOf(state, state.clueGiverId);
  const holderName = nameOf(state, state.boardHolderId);
  const amHolder = me?.id === state.boardHolderId;
  const amOnGuessing = me?.team === G;
  const amClueGiver = me?.id === state.clueGiverId;

  const [draft, setDraft] = useState<string[]>(() => [...state.board.words]);
  useEffect(() => {
    setDraft([...state.board.words]);
    // re-seed when a new turn starts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.turnNo]);

  // Guessing team — blind to the words (only the clue-giver sees them, once the round starts).
  if (amOnGuessing) {
    return (
      <div>
        <div className="eyebrow" style={{ textAlign: "center", marginTop: 6 }}>
          Round {roundOf(state.turnNo)} · {TEAM_LABEL[G]} guesses
        </div>
        <Blind title={amClueGiver ? "You're the clue-giver!" : "Get ready to guess"} emoji={amClueGiver ? "🗣️" : "🙈"}>
          {amClueGiver
            ? `You'll describe the secret words to your team — they appear one at a time once the clock starts. Don't say the word itself!`
            : `${clueGiverName} is your clue-giver. Listen to their clues and shout your guesses — you won't see the words.`}
        </Blind>
        <Instruct emoji="⏳">
          Waiting for <b>{TEAM_LABEL[L]}</b> to fill their board…
        </Instruct>
      </div>
    );
  }

  const dupes = boardDupes(draft);

  // Listening team, but not the board-holder — direct them to the holder.
  if (!amHolder) {
    return (
      <div style={teamVars(L)}>
        <h2 className="display" style={{ fontSize: 24, color: "var(--accent-deep)", margin: "4px 0 14px" }}>
          Predict together
        </h2>
        <Instruct emoji="📋">
          <b>{holderName}</b> has your team&apos;s board. Call out your predictions to them!
        </Instruct>
        <div style={{ marginTop: 14 }}>
          <SecretCards words={state.secret} team={G} />
        </div>
        <Board words={state.board.words} marked={new Array(16).fill(false)} accent={accentOf(L)} soft={softOf(L)} onMark={null} />
      </div>
    );
  }

  // Board-holder fills the prediction board.
  const setCell = (i: number, v: string) =>
    setDraft((d) => {
      const n = [...d];
      n[i] = v;
      return n;
    });
  const allFilled = FILLABLE.every((i) => (draft[i] || "").trim() !== "");
  const canLock = allFilled && dupes.size === 0;

  return (
    <div style={teamVars(L)}>
      <h2 className="display" style={{ fontSize: 24, color: "var(--accent-deep)", margin: "4px 0 14px" }}>
        Fill your board
      </h2>
      <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>
        <b>{clueGiverName}</b> will give {TEAM_LABEL[G]}&apos;s clues for these secret words. Predict
        the words <b>{clueGiverName}</b> will say out loud. A bingo is worth 3 points!
      </p>
      <SecretCards words={state.secret} team={G} />
      <Board
        words={draft}
        marked={new Array(16).fill(false)}
        editable
        invalid={dupes}
        onEdit={setCell}
        accent={accentOf(L)}
        soft={softOf(L)}
      />
      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn btn--ghost" onClick={() => send({ type: "saveBoard", words: draft, lock: false })}>
          Save draft
        </button>
        <button
          className="btn btn--accent"
          style={teamVars(L)}
          disabled={!canLock}
          onClick={() => send({ type: "saveBoard", words: draft, lock: true })}
        >
          Lock it in →
        </button>
      </div>
      <div className="muted tiny" style={{ marginTop: 10 }}>
        {dupes.size > 0 ? "⚠ No duplicate words — fix the highlighted squares." : `${boardFilledCount({ ...state.board, words: draft })}/12 filled`}
      </div>
    </div>
  );
}

/* ---------------- ready gate ---------------- */

function Ready({
  state,
  send,
  me,
  isHost,
}: {
  state: GameState;
  send: Room["send"];
  me: Player | null;
  isHost: boolean;
}) {
  const G = state.turnTeam!;
  const clueGiverName = nameOf(state, state.clueGiverId);
  const iAmReady = !!me && state.ready.includes(me.id);
  const readyCount = state.ready.length;
  const total = state.players.length;

  return (
    <div style={{ textAlign: "center" }}>
      <div className="eyebrow" style={{ marginTop: 6 }}>
        Round {roundOf(state.turnNo)} · {TEAM_LABEL[G]} guesses
      </div>
      <h2 className="display" style={{ fontSize: 28, margin: "6px 0 2px" }}>
        Get ready!
      </h2>
      <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>
        <b>{clueGiverName}</b> gives the clues for {TEAM_LABEL[G]}; the rest of the team guesses. Words
        reveal one at a time once the 60s starts — tap ready when your whole room is set.
      </p>

      {me && (
        <button
          className={iAmReady ? "btn btn--ghost" : "btn btn--primary"}
          style={{ marginTop: 6 }}
          onClick={() => {
            unlockAudio();
            send({ type: "ready" });
          }}
        >
          {iAmReady ? "✓ Ready (tap to undo)" : "I'm ready"}
        </button>
      )}
      <div className="muted tiny" style={{ marginTop: 12 }}>
        {readyCount}/{total} ready
      </div>
      {isHost && readyCount < total && (
        <button
          className="btn btn--ghost"
          style={{ marginTop: 10 }}
          onClick={() => {
            unlockAudio();
            send({ type: "forceStart" });
          }}
        >
          Start the 60s anyway
        </button>
      )}
    </div>
  );
}

/* ---------------- play (the 60s) ---------------- */

function Play({
  state,
  send,
  me,
  now,
  isHost,
  audio,
}: {
  state: GameState;
  send: Room["send"];
  me: Player | null;
  now: number;
  isHost: boolean;
  audio: boolean;
}) {
  const G = state.turnTeam!;
  const L = otherTeam(G);
  const clueGiverName = nameOf(state, state.clueGiverId);
  const holderName = nameOf(state, state.boardHolderId);
  const amClueGiver = me?.id === state.clueGiverId;
  const amGuesser = me?.team === G && !amClueGiver;
  const amHolder = me?.id === state.boardHolderId;
  const amListening = me?.team === L;

  const remaining =
    state.turnActive && state.turnEndsAt ? Math.max(0, Math.ceil((state.turnEndsAt - now) / 1000)) : 0;
  const timeUp = state.turnActive && remaining <= 0;
  const idx = state.revealIdx;
  const curWord = state.secret[idx] || "";

  useEffect(() => {
    buzz(HAPTIC.start); // a "go!" nudge when the round begins
  }, []);
  useEffect(() => {
    if (!state.turnActive) return;
    if (remaining === 10) {
      buzz(HAPTIC.warn);
      if (audio) SOUND.warn();
    } else if (remaining === 0) {
      buzz(HAPTIC.timeUp);
      if (audio) SOUND.timeUp();
    } else if (audio && remaining > 0 && remaining <= 3) {
      SOUND.tick();
    }
  }, [remaining, state.turnActive, audio]);

  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <div className="eyebrow" style={{ color: accentDeepOf(G), marginBottom: 6 }}>
          {TEAM_LABEL[G]} is guessing · {clueGiverName} gives clues
        </div>
        <CircleTimer remaining={remaining} total={60} active={state.turnActive && !timeUp} />
        {timeUp && (
          <div className="display" style={{ fontSize: 22, color: "var(--green-deep)" }}>
            Time!
          </div>
        )}
      </div>

      {amGuesser && (
        <div className="card" style={{ textAlign: "center", padding: "26px 18px" }}>
          <div style={{ fontSize: 46 }}>👂</div>
          <h2 className="display" style={{ fontSize: 24, margin: "6px 0 2px" }}>
            Guess out loud!
          </h2>
          <p className="muted" style={{ fontSize: 14, margin: 0 }}>
            Listen to {clueGiverName}&apos;s clues and shout your guesses.
          </p>
          <div className="display" style={{ fontSize: 40, marginTop: 12, color: "var(--lemon-deep)" }}>
            {idx}/5
          </div>
        </div>
      )}

      {amClueGiver && (
        <div style={teamVars(G)}>
          <div className="eyebrow" style={{ textAlign: "center", color: "var(--accent-deep)" }}>
            Word {Math.min(idx + 1, 5)} of 5 · get your team to say it
          </div>
          <div className="reveal-card" style={teamVars(G)}>
            <div className="display reveal-word">{curWord || "…"}</div>
          </div>
          <button
            className="btn btn--accent"
            style={{ ...teamVars(G), marginTop: 14 }}
            disabled={!state.turnActive || idx >= 5}
            onClick={() => {
              buzz(HAPTIC.tap);
              send({ type: "got" });
            }}
          >
            They got it! Next word →
          </button>
          <p className="muted tiny" style={{ textAlign: "center", marginTop: 10 }}>
            No skipping — they have to get this one first. Don&apos;t say the word!
          </p>
        </div>
      )}

      {amListening && (
        <div style={teamVars(L)}>
          <h2 className="display" style={{ fontSize: 22, color: "var(--accent-deep)", margin: "4px 0 4px" }}>
            Mark what you hear
          </h2>
          {amHolder ? (
            <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
              Tap a square when {TEAM_LABEL[G]} blurts that word. Fill the whole board for a bonus.
            </p>
          ) : (
            <Instruct emoji="📋">
              <b>{holderName}</b> is marking the board — shout out what you hear them say!
            </Instruct>
          )}
          <Board
            words={state.board.words}
            marked={state.board.marked}
            onMark={
              amHolder && state.turnActive
                ? (i) => {
                    buzz(HAPTIC.stamp);
                    send({ type: "mark", idx: i });
                  }
                : null
            }
            accent={accentOf(L)}
            soft={softOf(L)}
            seed={state.turnNo}
          />
          {boardFull(state.board) && (
            <div className="bingo pulse" style={teamVars(L)}>
              FULL BOARD! 🎉
            </div>
          )}
        </div>
      )}

      {!me && <div className="banner">Watching the action…</div>}

      {isHost && (
        <div className="mc">
          <div className="eyebrow">Host</div>
          <button className="btn btn--ghost" style={{ marginTop: 10 }} onClick={() => send({ type: "endTurn" })}>
            End this turn early
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------- done / reveal ---------------- */

function Scorecard({ team, score, winner }: { team: Team; score: number; winner: boolean }) {
  const shown = useCountUp(score);
  return (
    <div className={`scorecard${winner ? " scorecard--win" : ""}`} style={teamVars(team)}>
      {winner && <div className="scorecard-crown">👑</div>}
      <div className="display scorecard-name">{TEAM_LABEL[team]}</div>
      <div className="scorecard-num">{shown}</div>
      <div className="eyebrow">points</div>
    </div>
  );
}

function Done({
  state,
  send,
  isHost,
  audio,
}: {
  state: GameState;
  send: Room["send"];
  isHost: boolean;
  audio: boolean;
}) {
  const { A, B } = state.scores;
  const winner: Team | null = A === B ? null : A > B ? "A" : "B";
  useEffect(() => {
    if (winner) {
      buzz(HAPTIC.win);
      if (audio) SOUND.win();
    }
  }, [winner, audio]);
  return (
    <div style={{ paddingTop: 12 }}>
      {winner && <Confetti />}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 60 }}>{winner ? "🏆" : "🤝"}</div>
        <div className="display" style={{ fontSize: 34, color: winner ? accentDeepOf(winner) : "var(--lemon-deep)" }}>
          {winner ? `${TEAM_LABEL[winner]} wins!` : "It's a tie!"}
        </div>
      </div>

      {/* fun score cards */}
      <div className="grid2" style={{ marginTop: 16 }}>
        {(["A", "B"] as Team[]).map((t) => (
          <Scorecard key={t} team={t} score={state.scores[t]} winner={winner === t} />
        ))}
      </div>

      <div className="eyebrow" style={{ textAlign: "center", margin: "26px 0 4px" }}>
        How the points were won
      </div>
      {state.history.map((log, n) => (
        <TurnReview key={n} log={log} seed={n} />
      ))}

      {isHost && (
        <button className="btn btn--primary" style={{ marginTop: 22 }} onClick={() => send({ type: "reset" })}>
          🔀 Play again — new teams →
        </button>
      )}
    </div>
  );
}

function TurnReview({ log, seed }: { log: TurnLog; seed: number }) {
  return (
    <div className="card" style={{ marginTop: 14, padding: 16 }}>
      <div className="eyebrow" style={{ color: accentDeepOf(log.team) }}>
        Round {log.round} · {TEAM_LABEL[log.team]} guessing · clues by {log.clueGiverName}
      </div>

      {/* words: right vs wrong, each +1 */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "10px 0 6px" }}>
        {log.words.map((w, i) => {
          const right = i < log.gotCount;
          return (
            <span key={i} className={`wordpip${right ? " wordpip--yes" : " wordpip--no"}`}>
              {right ? "✓" : "✗"} {w}
            </span>
          );
        })}
      </div>
      <div className="muted tiny">
        {log.gotCount}/5 guessed → <b style={{ color: accentDeepOf(log.team) }}>+{log.gotCount} to {TEAM_LABEL[log.team]}</b>
      </div>

      {/* the listening team's prediction board */}
      <div className="muted tiny" style={{ margin: "12px 0 6px" }}>
        {TEAM_LABEL[log.boardTeam]}&apos;s board{" "}
        {log.bingo ? (
          <b style={{ color: accentDeepOf(log.boardTeam) }}>— full board! +3 to {TEAM_LABEL[log.boardTeam]} 🎉</b>
        ) : (
          <span>— no bingo (+0)</span>
        )}
      </div>
      <div style={teamVars(log.boardTeam)}>
        <Board
          words={log.board.words}
          marked={log.board.marked}
          onMark={null}
          accent={accentOf(log.boardTeam)}
          soft={softOf(log.boardTeam)}
          seed={seed}
        />
      </div>
    </div>
  );
}
