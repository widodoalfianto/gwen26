"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { makeCode } from "@/lib/game";
import { getName, setName as storeName } from "@/lib/id";

export default function Home() {
  const router = useRouter();
  const [name, setNameState] = useState<string>(() =>
    typeof window !== "undefined" ? getName() : "",
  );
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");

  const go = (c: string) => {
    storeName(name.trim());
    router.push(`/room/${c}`);
  };
  const create = () => {
    if (!name.trim()) return setErr("Add your name first.");
    go(makeCode());
  };
  const join = () => {
    if (!name.trim()) return setErr("Add your name first.");
    const c = code.trim().toUpperCase();
    if (c.length < 4) return setErr("Enter the 5-letter code.");
    go(c);
  };

  return (
    <main className="wrap">
      <header style={{ textAlign: "center", margin: "26px 0 30px" }}>
        <h1 className="display" style={{ fontSize: 46, margin: 0 }}>
          <span style={{ color: "var(--green-deep)" }}>Gwen</span>{" "}
          <span style={{ color: "var(--blue-deep)" }}>26</span>
        </h1>
        <div className="eyebrow" style={{ marginTop: 12 }}>
          ☀️ The Bingo Round
        </div>
      </header>

      <div className="card">
        <label className="eyebrow" htmlFor="name">
          Your name
        </label>
        <input
          id="name"
          className="input"
          style={{ marginTop: 6 }}
          value={name}
          maxLength={14}
          placeholder="e.g. Gwen"
          onChange={(e) => setNameState(e.target.value)}
        />

        <div className="spacer" />
        <button className="btn btn--primary" onClick={create}>
          Start a new lobby
        </button>

        <div className="divider">OR JOIN ONE</div>

        <div className="row">
          <input
            className="input codebox"
            style={{ flex: 1 }}
            value={code}
            maxLength={5}
            placeholder="CODE"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && join()}
          />
          <button
            className="btn btn--accent"
            style={{ width: 120, ["--accent" as string]: "var(--blue)" } as React.CSSProperties}
            onClick={join}
          >
            Join
          </button>
        </div>

        {err && (
          <div style={{ color: "var(--green-deep)", marginTop: 14, fontSize: 14 }}>{err}</div>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="eyebrow">How a round works</div>
        <ol className="muted" style={{ fontSize: 14, lineHeight: 1.65, paddingLeft: 18, margin: "8px 0 0" }}>
          <li>Each team is dealt 5 secret <b style={{ color: "var(--ink)" }}>Things</b> cards.</li>
          <li>
            Before swapping, each team fills its board with words it thinks the <i>other</i> team will
            blurt out while guessing.
          </li>
          <li>
            On a team&apos;s turn it has 60s to get teammates to guess the swapped cards —{" "}
            <b style={{ color: "var(--ink)" }}>+1 each</b>.
          </li>
          <li>
            The listening team marks any predicted word it hears. Full board ={" "}
            <b style={{ color: "var(--lemon-deep)" }}>bingo, +3</b>.
          </li>
          <li>Three rounds, new cards each time. Most points wins.</li>
        </ol>
      </div>
    </main>
  );
}
