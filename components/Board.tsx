"use client";

import React from "react";
import { FREE_SET, FREE_SPACES } from "@/lib/game";

const freeMap = new Map(FREE_SPACES.map((f) => [f.idx, f]));

export function Board({
  words,
  marked,
  editable,
  onEdit,
  onMark,
  accent,
  soft,
}: {
  words: string[];
  marked: boolean[];
  editable?: boolean;
  onEdit?: (idx: number, value: string) => void;
  onMark?: ((idx: number) => void) | null;
  accent: string;
  soft: string;
}) {
  return (
    <div className="board">
      {Array.from({ length: 16 }).map((_, i) => {
        if (FREE_SET.has(i)) {
          const f = freeMap.get(i)!;
          return (
            <div key={i} className="cell cell--free" title={f.label}>
              <span className="emoji" role="img" aria-label={f.label}>
                {f.emoji}
              </span>
              <span className="freelabel">{f.label}</span>
            </div>
          );
        }

        if (editable) {
          return (
            <div key={i} className="cell cell--editable">
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
            {on && <span className="stamp">✕</span>}
          </button>
        );
      })}
    </div>
  );
}
