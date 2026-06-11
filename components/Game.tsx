"use client";

import React, { useEffect, useRef, useState } from "react";
import type { Room } from "@/lib/useRoom";
import {
  type GameState,
  type Player,
  type Team,
  TEAM_LABEL,
  FILLABLE,
  boardFull,
  boardFilledCount,
  otherTeam,
} from "@/lib/game";
import { Board } from "@/components/Board";

/* team -> css custom properties */
function teamVars(team: Team): React.CSSProperties {
  const map = {
    A: { accent: "var(--green)", deep: "var(--green-deep)", soft: "var(--green-soft)" },
    B: { accent: "var(--blue)", deep: "var(--blue-deep)", soft: "var(--blue-soft)" },
  } as const;
  const v = map[team];
  return {
    ["--accent" as string]: v.accent,
    ["--accent-deep" as string]: v.deep,
    ["--soft" as string]: v.soft,
  } as React.CSSProperties;
}
const accentOf = (t: Team) => (t === "A" ? "var(--green)" : "var(--blue)");
const softOf = (t: Team) => (t === "A" ? "var(--green-soft)" : "var(--blue-soft)");

export default function Game({ room, code }: { room: Room; code: string }) {
  const { state, send, pid, connected } = room;
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  if (!state) {
    return (
      <main className="wrap" style={{ textAlign: "center", paddingTop: 80 }}>
        <div className="display" style={{ fontSize: 28 }}>
          {connected ? "Joining the lobby…" : "Connecting…"}
        </div>
        <div className="muted tiny" style={{ marginTop: 8 }}>
          Code {code}
        </div>
      </main>
    );
  }

  const me = state.players.find((p) => p.id === pid) || null;
  const isHost = state.hostId === pid;
  const myTeam = me?.team ?? null;
  const common = { state, send, me, isHost, myTeam, now };

  return (
    <main className="wrap">
      <TopBar state={state} code={code} />
      {state.phase === "lobby" && <Lobby {...common} code={code} />}
      {state.phase === "setup" && <Setup {...common} />}
      {state.phase === "play" && <Play {...common} />}
      {state.phase === "roundEnd" && <RoundEnd {...common} />}
      {state.phase === "done" && <Done state={state} />}
    </main>
  );
}

/* ---------------- shared bits ---------------- */

function ScorePill({ team, v }: { team: Team; v: number }) {
  return (
    <span className="scorepill" style={{ ["--accent" as string]: accentOf(team), ["--soft" as string]: softOf(team) } as React.CSSProperties}>
      <span className="scoredot" />
      <span style={{ fontFamily: "var(--display)", fontStyle: "italic" }}>{v}</span>
    </span>
  );
}

function TopBar({ state, code }: { state: GameState; code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="topbar">
      <div>
        <div className="display" style={{ fontSize: 21 }}>
          <span style={{ color: "var(--green-deep)" }}>Gwen</span>{" "}
          <span style={{ color: "var(--blue-deep)" }}>26</span>
        </div>
        {state.phase !== "lobby" && state.phase !== "done" && (
          <div className="muted tiny" style={{ marginTop: 2 }}>
            Round {state.round} of 3
          </div>
        )}
      </div>
      <div className="row" style={{ alignItems: "center" }}>
        <ScorePill team="A" v={state.scores.A} />
        <ScorePill team="B" v={state.scores.B} />
        <button className="codetag" onClick={copy} title="Copy code">
          <span className="muted tiny">CODE </span>
          <b>{code}</b>
          {copied ? " ✓" : ""}
        </button>
      </div>
    </div>
  );
}

interface ScreenProps {
  state: GameState;
  send: Room["send"];
  me: Player | null;
  isHost: boolean;
  myTeam: Team | null;
  now: number;
}

/* ---------------- lobby ---------------- */

function Lobby({ state, send, me, isHost, code }: ScreenProps & { code: string }) {
  const teams: Record<Team, Player[]> = {
    A: state.players.filter((p) => p.team === "A"),
    B: state.players.filter((p) => p.team === "B"),
  };
  const ready = state.players.length >= 2;

  return (
    <div>
      {!me && <div className="banner">Seating you in the lobby…</div>}
      <div style={{ textAlign: "center", margin: "10px 0 22px" }}>
        <div className="eyebrow">Share this code</div>
        <div className="display" style={{ fontSize: 58, letterSpacing: "0.14em", color: "var(--lemon-deep)" }}>
          {code}
        </div>
      </div>

      <div className="grid2">
        {(["A", "B"] as Team[]).map((t) => (
          <div key={t} className="teamcard" style={teamVars(t)}>
            <div className="teamhead">{TEAM_LABEL[t]}</div>
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
        <button
          className="btn btn--primary"
          style={{ marginTop: 18 }}
          disabled={!ready}
          onClick={() => send({ type: "start" })}
        >
          {ready ? "Deal the cards →" : "Need at least 2 players"}
        </button>
      ) : (
        <div className="banner">The host starts the game once everyone is in.</div>
      )}
    </div>
  );
}

/* ---------------- setup ---------------- */

function Setup({ state, send, me, isHost, myTeam }: ScreenProps) {
  const board = myTeam ? state.boards[myTeam] : null;
  const [draft, setDraft] = useState<string[]>([]);
  const seededRound = useRef<number>(-1);

  useEffect(() => {
    if (board && seededRound.current !== state.round) {
      setDraft([...board.words]);
      seededRound.current = state.round;
    }
  }, [board, state.round]);

  const bothLocked = state.boards.A.locked && state.boards.B.locked;

  const HostPanel = isHost ? (
    <div className="mc">
      <div className="eyebrow">Host controls</div>
      <div className="muted tiny" style={{ margin: "8px 0 12px" }}>
        {bothLocked
          ? "Both boards locked. Swap cards out loud, then start a turn."
          : "Waiting for both boards to lock — you can still start early."}
      </div>
      <div className="row">
        {(["A", "B"] as Team[]).map((t) => (
          <button
            key={t}
            className="btn btn--accent"
            style={teamVars(t)}
            disabled={state.turnsDone[t]}
            onClick={() => send({ type: "startTurn", team: t })}
          >
            {state.turnsDone[t] ? `${TEAM_LABEL[t]} done ✓` : `${TEAM_LABEL[t]} guesses (60s)`}
          </button>
        ))}
      </div>
    </div>
  ) : null;

  if (!myTeam || !board) {
    return (
      <div>
        <div className="banner">You&apos;re not seated yet — the host can place you from the lobby.</div>
        {HostPanel}
      </div>
    );
  }

  const locked = board.locked;
  const setCell = (i: number, v: string) =>
    setDraft((d) => {
      const n = [...d];
      n[i] = v;
      return n;
    });
  const canLock = FILLABLE.every((i) => (draft[i] || "").trim() !== "");

  return (
    <div style={teamVars(myTeam)}>
      <h2 className="display" style={{ fontSize: 24, color: "var(--accent-deep)", margin: "4px 0 6px" }}>
        Fill your board
      </h2>
      <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>
        These are your 5 secret cards — the other team will guess them next. Predict the words your
        opponents will <i>say out loud</i> while guessing, and write those in your squares.
      </p>

      <div className="card" style={{ padding: 14, marginBottom: 14 }}>
        <div className="eyebrow">Your secret cards</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {state.deck[myTeam].map((w, i) => (
            <span
              key={i}
              style={{
                background: "var(--soft)",
                border: "1px solid var(--accent)",
                borderRadius: 10,
                padding: "8px 12px",
                fontWeight: 600,
              }}
            >
              {w}
            </span>
          ))}
        </div>
      </div>

      <Board
        words={locked ? board.words : draft}
        marked={new Array(16).fill(false)}
        editable={!locked}
        onEdit={setCell}
        accent={accentOf(myTeam)}
        soft={softOf(myTeam)}
      />

      {!locked ? (
        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn btn--ghost" onClick={() => send({ type: "saveBoard", team: myTeam, words: draft, lock: false })}>
            Save draft
          </button>
          <button
            className="btn btn--accent"
            style={teamVars(myTeam)}
            disabled={!canLock}
            onClick={() => send({ type: "saveBoard", team: myTeam, words: draft, lock: true })}
          >
            Lock in board
          </button>
        </div>
      ) : (
        <div className="banner">Board locked. Waiting for the other team…</div>
      )}

      <div className="muted tiny" style={{ marginTop: 10 }}>
        {TEAM_LABEL.A}: {boardFilledCount(state.boards.A)}/12 {state.boards.A.locked ? "🔒" : ""} · {TEAM_LABEL.B}:{" "}
        {boardFilledCount(state.boards.B)}/12 {state.boards.B.locked ? "🔒" : ""}
      </div>

      {HostPanel}
    </div>
  );
}

/* ---------------- play ---------------- */

function Play({ state, send, isHost, myTeam, now }: ScreenProps) {
  const guessing = state.turn!;
  const listening = otherTeam(guessing);
  const remaining =
    state.turnActive && state.turnEndsAt ? Math.max(0, Math.ceil((state.turnEndsAt - now) / 1000)) : 0;
  const timeUp = state.turnActive && remaining <= 0;
  const amGuessing = myTeam === guessing;
  const amListening = myTeam === listening;

  const timerColor = !state.turnActive
    ? "var(--dim)"
    : timeUp
      ? "var(--green-deep)"
      : remaining <= 10
        ? "var(--lemon-deep)"
        : "var(--ink)";

  const got = state.got[guessing];
  const gotCount = got.filter(Boolean).length;

  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <div className="display" style={{ fontSize: 18, color: accentOf(guessing) }}>
          {TEAM_LABEL[guessing]} is guessing
        </div>
        <div
          className={state.turnActive && !timeUp && remaining <= 10 ? "timer pulse" : "timer"}
          style={{ color: timerColor }}
        >
          {state.turnActive ? (timeUp ? "TIME!" : remaining) : "—"}
        </div>
      </div>

      {amGuessing && (
        <div style={teamVars(guessing)}>
          <h2 className="display" style={{ fontSize: 22, color: "var(--accent-deep)", margin: "4px 0 4px" }}>
            Get your team to say these — {gotCount}/5
          </h2>
          <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
            One person describes, the rest guess. Tap a card when they get it (+1). Heads up: the other
            team is listening.
          </p>
          <div style={{ display: "grid", gap: 10 }}>
            {state.deck[listening].map((w, i) => (
              <button
                key={i}
                className={`thing${got[i] ? " thing--on" : ""}`}
                style={teamVars(guessing)}
                disabled={!state.turnActive}
                onClick={() => send({ type: "got", team: guessing, idx: i })}
              >
                <span className="label">{w}</span>
                <span style={{ color: got[i] ? "var(--accent-deep)" : "var(--dim)", fontSize: 22 }}>
                  {got[i] ? "✓" : "+1"}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {amListening && (
        <div style={teamVars(listening)}>
          <h2 className="display" style={{ fontSize: 22, color: "var(--accent-deep)", margin: "4px 0 4px" }}>
            Mark what you hear
          </h2>
          <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
            Tap a square whenever the other team blurts out that word. Fill them all for bingo.
          </p>
          <Board
            words={state.boards[listening].words}
            marked={state.boards[listening].marked}
            onMark={state.turnActive ? (i) => send({ type: "mark", team: listening, idx: i }) : null}
            accent={accentOf(listening)}
            soft={softOf(listening)}
          />
          {boardFull(state.boards[listening]) && (
            <div className="bingo pulse" style={teamVars(listening)}>
              BINGO! +3
            </div>
          )}
        </div>
      )}

      {!amGuessing && !amListening && <div className="banner">Watch the action — your turn comes around.</div>}

      {isHost && (
        <div className="mc">
          <div className="eyebrow">Host controls</div>
          <div style={{ marginTop: 10 }}>
            {state.turnActive ? (
              <button className="btn btn--primary" onClick={() => send({ type: "endTurn" })}>
                End {TEAM_LABEL[guessing]}&apos;s turn
              </button>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                <div className="row">
                  {(["A", "B"] as Team[]).map((t) => (
                    <button
                      key={t}
                      className="btn btn--accent"
                      style={teamVars(t)}
                      disabled={state.turnsDone[t]}
                      onClick={() => send({ type: "startTurn", team: t })}
                    >
                      {state.turnsDone[t] ? `${TEAM_LABEL[t]} done ✓` : `Start ${TEAM_LABEL[t]} (60s)`}
                    </button>
                  ))}
                </div>
                {state.turnsDone.A && state.turnsDone.B && (
                  <button className="btn btn--primary" onClick={() => send({ type: "tally" })}>
                    Tally round {state.round} →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- round end ---------------- */

function RoundEnd({ state, send, isHost }: ScreenProps) {
  const b = state.roundBreakdown ?? {
    A: { guess: 0, bingo: false },
    B: { guess: 0, bingo: false },
  };
  return (
    <div>
      <h2 className="display" style={{ fontSize: 24 }}>
        Round {state.round} results
      </h2>
      <div className="grid2">
        {(["A", "B"] as Team[]).map((t) => (
          <div key={t} className="teamcard" style={teamVars(t)}>
            <div className="teamhead">{TEAM_LABEL[t]}</div>
            <Line label="Cards guessed" value={`+${b[t].guess}`} />
            <Line label="Bingo" value={b[t].bingo ? "+3 🎉" : "—"} highlight={b[t].bingo} />
            <div style={{ height: 1, background: "var(--line)", margin: "8px 0" }} />
            <Line label="Total" value={state.scores[t]} big />
          </div>
        ))}
      </div>
      {isHost ? (
        <button className="btn btn--primary" style={{ marginTop: 18 }} onClick={() => send({ type: "nextRound" })}>
          {state.round >= 3 ? "See final results →" : `Start round ${state.round + 1} →`}
        </button>
      ) : (
        <div className="banner">Waiting for the host to continue…</div>
      )}
    </div>
  );
}

function Line({
  label,
  value,
  big,
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  big?: boolean;
  highlight?: boolean;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "3px 0" }}>
      <span className="muted" style={{ fontSize: big ? 14 : 13 }}>
        {label}
      </span>
      <b
        style={{
          fontFamily: "var(--display)",
          fontStyle: "italic",
          fontSize: big ? 26 : 15,
          color: highlight ? "var(--lemon-deep)" : big ? "var(--accent-deep)" : "var(--ink)",
        }}
      >
        {value}
      </b>
    </div>
  );
}

/* ---------------- done ---------------- */

function Done({ state }: { state: GameState }) {
  const { A, B } = state.scores;
  const winner: Team | null = A === B ? null : A > B ? "A" : "B";
  return (
    <div style={{ textAlign: "center", paddingTop: 18 }}>
      <div style={{ fontSize: 64 }}>{winner ? "🏆" : "🤝"}</div>
      <div
        className="display"
        style={{ fontSize: 36, color: winner ? accentOf(winner) : "var(--lemon-deep)" }}
      >
        {winner ? `${TEAM_LABEL[winner]} wins!` : "It's a tie!"}
      </div>
      <div className="row" style={{ justifyContent: "center", gap: 16, marginTop: 18 }}>
        <ScorePill team="A" v={A} />
        <ScorePill team="B" v={B} />
      </div>
      <p className="muted" style={{ marginTop: 22, fontSize: 14 }}>
        That&apos;s the Bingo round. Next up in the full game: Name a Number and Sam Says.
      </p>
    </div>
  );
}
