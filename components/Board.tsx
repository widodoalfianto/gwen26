"use client";

import React, { useState } from "react";
import { FREE_SET, FREE_SPACES } from "@/lib/game";

const freeMap = new Map(FREE_SPACES.map((f) => [f.idx, f]));

// Marker ink colours: red, green, blue, yellow.
const MARK_COLORS = ["#e23b34", "#2f9e44", "#2b76c9", "#eab308"];

// Deterministic pseudo-random in [0,1) so every client renders the same
// angle/colour for a given square.
function rand(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function FreeCell({ img, emoji, label }: { img: string; emoji: string; label: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="cell cell--free" title={label}>
      {failed ? (
        <span className="emoji" role="img" aria-label={label}>
          {emoji}
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="emoji-img" src={img} alt={label} onError={() => setFailed(true)} />
      )}
    </div>
  );
}

export function Board({
  words,
  marked,
  editable,
  invalid,
  onEdit,
  onMark,
  accent,
  soft,
  seed = 0,
}: {
  words: string[];
  marked: boolean[];
  editable?: boolean;
  invalid?: Set<number>;
  onEdit?: (idx: number, value: string) => void;
  onMark?: ((idx: number) => void) | null;
  accent: string;
  soft: string;
  seed?: number;
}) {
  return (
    <div className="boardwrap">
      <div className="board">
        {Array.from({ length: 16 }).map((_, i) => {
          if (FREE_SET.has(i)) {
            const f = freeMap.get(i)!;
            return <FreeCell key={i} img={f.img} emoji={f.emoji} label={f.label} />;
          }

          if (editable) {
            return (
              <div key={i} className={`cell cell--editable${invalid?.has(i) ? " cell--dupe" : ""}`}>
                <input
                  value={words[i] || ""}
                  placeholder="word"
                  maxLength={24}
                  onChange={(e) => onEdit?.(i, e.target.value)}
                  aria-label={`Bingo square ${i + 1}`}
                />
              </div>
            );
          }

          const on = !!marked[i];
          const clickable = !!onMark;
          const style = { ["--accent" as string]: accent, ["--soft" as string]: soft } as React.CSSProperties;
          return (
            <button
              key={i}
              type="button"
              className={`cell cell--mark${on ? " cell--on" : ""}`}
              style={style}
              disabled={!clickable}
              onClick={() => onMark?.(i)}
            >
              <span className="word">{words[i] || ""}</span>
            </button>
          );
        })}
      </div>

      {/* Stamps live in a layer above ALL the cards, so they can spill over
          neighbours without ever being clipped or covered. */}
      <div className="board board--stamps" aria-hidden="true">
        {Array.from({ length: 16 }).map((_, i) => {
          const show = !editable && !FREE_SET.has(i) && !!marked[i];
          if (!show) return <div key={i} className="stampslot" />;
          const color = MARK_COLORS[Math.floor(rand(i * 7 + seed * 13 + 1) * MARK_COLORS.length)];
          const ang = (rand(i * 3 + seed * 5 + 2) * 46 - 23).toFixed(1);
          return (
            <div key={i} className="stampslot">
              <span className="stamp" style={{ background: color, ["--ang" as string]: `${ang}deg` }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
