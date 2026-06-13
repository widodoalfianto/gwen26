import { routePartykitRequest, Server, type Connection } from "partyserver";
import { reduce, onTimeout, reassignRoles, initialState, type GameState, type ClientMsg } from "../../lib/game";

export interface Env {
  Lobby: DurableObjectNamespace;
}

type ConnState = { playerId?: string };

export class Lobby extends Server<Env> {
  static options = { hibernate: true };

  state!: GameState;

  async onStart() {
    const saved = await this.ctx.storage.get<GameState>("state");
    this.state = saved ?? initialState(this.name);
    if (!saved) await this.persist();
  }

  private async persist() {
    await this.ctx.storage.put("state", this.state);
  }

  // Per-connection view. Scores stay hidden until the final reveal. Only the
  // CLUE-GIVER ever sees the words, and only during the round — one at a time.
  // Everyone else on the guessing team is blind; the listening team (who
  // predicts) sees them all so they can guess what the clue-giver will say.
  private view(playerId?: string): GameState {
    const s = this.state;
    const me = playerId ? s.players.find((p) => p.id === playerId) : undefined;
    let secret = s.secret;
    if (me && s.turnTeam && me.team === s.turnTeam) {
      secret =
        me.id === s.clueGiverId && s.phase === "guess"
          ? s.secret.map((w, i) => (i <= s.revealIdx ? w : "")) // revealed so far
          : []; // every other guesser is blind (and the clue-giver before the round)
    }
    const hideScores = s.phase !== "done";
    return {
      ...s,
      scores: hideScores ? { A: 0, B: 0 } : s.scores,
      history: hideScores ? [] : s.history,
      usedWords: [], // never exposed — it contains the live secret words
      secret,
    };
  }

  private sendTo(connection: Connection<ConnState>) {
    const pid = (connection.state as ConnState | null)?.playerId;
    connection.send(JSON.stringify({ type: "state", state: this.view(pid) }));
  }

  private broadcastState() {
    for (const c of this.getConnections<ConnState>()) this.sendTo(c);
  }

  private async applyAlarm(alarm: number | null | undefined) {
    if (alarm === null) {
      const existing = await this.ctx.storage.getAlarm();
      if (existing !== null) await this.ctx.storage.deleteAlarm();
    } else if (typeof alarm === "number") {
      await this.ctx.storage.setAlarm(alarm);
    }
  }

  onConnect(connection: Connection<ConnState>) {
    this.sendTo(connection);
  }

  async onMessage(connection: Connection<ConnState>, raw: string) {
    let msg: ClientMsg;
    try {
      msg = JSON.parse(raw) as ClientMsg;
    } catch {
      return;
    }

    if (msg.type === "hello") connection.setState({ playerId: msg.id });
    const stored = connection.state as ConnState | null;
    const sid = msg.type === "hello" ? msg.id : stored?.playerId ?? connection.id;

    const { state, alarm } = reduce(this.state, msg, sid);
    this.state = state;

    await this.applyAlarm(alarm);
    await this.persist();
    this.broadcastState();
  }

  // Server-authoritative turn timer: fires when the 60s window closes.
  async onAlarm() {
    const { state, alarm } = onTimeout(this.state);
    if (state === this.state) return; // nothing to do
    this.state = state;
    await this.applyAlarm(alarm);
    await this.persist();
    this.broadcastState();
  }

  // On disconnect: migrate the host if needed, and make sure the active
  // guesser / board-holder are still present so a dropped phone can't stall.
  async onClose(connection: Connection<ConnState>) {
    const pid = (connection.state as ConnState | null)?.playerId;
    if (!pid) return;

    const present = new Set<string>();
    for (const c of this.getConnections<ConnState>()) {
      if (c.id === connection.id) continue;
      const cs = c.state as ConnState | null;
      if (cs?.playerId) present.add(cs.playerId);
    }
    if (present.has(pid)) return; // this player still has another tab open

    let next = this.state;
    if (next.hostId === pid) {
      const heir = next.players.find((p) => present.has(p.id));
      if (heir) next = { ...next, hostId: heir.id };
    }
    next = reassignRoles(next, [...present]);

    if (next !== this.state) {
      this.state = next;
      await this.persist();
      this.broadcastState();
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (
      (await routePartykitRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
