"use client";

import { useRef, useState } from "react";
import usePartySocket from "partysocket/react";
import { getPlayerId, getName } from "@/lib/id";
import type { ClientMsg, GameState, ServerMsg } from "@/lib/game";

const HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST || "127.0.0.1:8787";

export interface Room {
  state: GameState | null;
  pid: string;
  connected: boolean;
  send: (msg: ClientMsg) => void;
}

export function useRoom(code: string): Room {
  const pidRef = useRef<string>("");
  if (!pidRef.current && typeof window !== "undefined") pidRef.current = getPlayerId();
  const pid = pidRef.current;

  const [state, setState] = useState<GameState | null>(null);
  const [connected, setConnected] = useState(false);

  const socket = usePartySocket({
    host: HOST,
    party: "lobby",
    room: code,
    id: pid || undefined,
    onOpen() {
      setConnected(true);
      socket.send(JSON.stringify({ type: "hello", id: pid, name: getName() || "Player" } satisfies ClientMsg));
    },
    onClose() {
      setConnected(false);
    },
    onMessage(event: MessageEvent) {
      try {
        const msg = JSON.parse(event.data) as ServerMsg;
        if (msg.type === "state") setState(msg.state);
      } catch {
        /* ignore malformed frames */
      }
    },
  });

  const send = (msg: ClientMsg) => socket.send(JSON.stringify(msg));

  return { state, pid, connected, send };
}
