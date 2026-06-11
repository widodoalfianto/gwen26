"use client";

import { useParams } from "next/navigation";
import { useRoom } from "@/lib/useRoom";
import Game from "@/components/Game";

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code || "").toUpperCase();
  const room = useRoom(code);
  return <Game room={room} code={code} />;
}
