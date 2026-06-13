import { routePartykitRequest, Server, type Connection } from "partyserver";
import {
  reduce,
  onTimeout,
  reassignRoles,
  initialState,
  LEAVE_GRACE_MS,
  type GameState,
  type ClientMsg,
} from "../../lib/game";

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
      pendingLeave: {}, // server-internal grace bookkeeping
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

  // Player ids with at least one live connection (optionally excluding one).
  private presentIds(excludeConnId?: string): Set<string> {
    const ids = new Set<string>();
    for (const c of this.getConnections<ConnState>()) {
      if (excludeConnId && c.id === excludeConnId) continue;
      const cs = c.state as ConnState | null;
      if (cs?.playerId) ids.add(cs.playerId);
    }
    return ids;
  }

  // Set the lobby prune alarm to the soonest pending-leave deadline.
  private async scheduleLeaveAlarm() {
    const times = Object.values(this.state.pendingLeave ?? {});
    if (times.length) await this.ctx.storage.setAlarm(Math.min(...times));
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

    // Starting or replaying prunes anyone who's no longer connected, so ghosts
    // don't get dealt into the game / carry into the next one.
    if (msg.type === "reset" || msg.type === "start") {
      const present = this.presentIds();
      this.state = { ...this.state, players: this.state.players.filter((p) => present.has(p.id)) };
    }

    const { state, alarm } = reduce(this.state, msg, sid);
    this.state = state;

    await this.applyAlarm(alarm);
    await this.persist();
    this.broadcastState();
  }

  // Alarm fires for either the lobby grace-period prune or the 60s turn timer.
  async onAlarm() {
    if (this.state.phase === "lobby" && Object.keys(this.state.pendingLeave).length) {
      const present = this.presentIds();
      const now = Date.now();
      const pending = { ...this.state.pendingLeave };
      let players = this.state.players;
      let hostId = this.state.hostId;
      let nextDue = Infinity;
      let changed = false;
      for (const [id, due] of Object.entries(this.state.pendingLeave)) {
        if (present.has(id)) {
          delete pending[id]; // came back
          changed = true;
        } else if (due <= now) {
          players = players.filter((p) => p.id !== id);
          delete pending[id];
          if (hostId === id) hostId = players.find((p) => present.has(p.id))?.id ?? players[0]?.id ?? null;
          changed = true;
        } else {
          nextDue = Math.min(nextDue, due);
        }
      }
      if (changed) {
        this.state = { ...this.state, players, hostId, pendingLeave: pending };
        await this.persist();
        this.broadcastState();
      }
      if (nextDue !== Infinity) await this.ctx.storage.setAlarm(nextDue);
      else {
        const existing = await this.ctx.storage.getAlarm();
        if (existing !== null) await this.ctx.storage.deleteAlarm();
      }
      return;
    }

    // Server-authoritative turn timer: fires when the 60s window closes.
    const { state, alarm } = onTimeout(this.state);
    if (state === this.state) return; // nothing to do
    this.state = state;
    await this.applyAlarm(alarm);
    await this.persist();
    this.broadcastState();
  }

  // On disconnect:
  //  • in the lobby → mark them for removal after a grace period, so a quick
  //    app-switch (e.g. the host texting the code) doesn't drop anyone.
  //  • mid-game → keep them (so a locked phone / refresh can reconnect), but
  //    migrate the host and rescue the clue-giver / board-holder if needed.
  async onClose(connection: Connection<ConnState>) {
    const pid = (connection.state as ConnState | null)?.playerId;
    if (!pid) return;

    const present = this.presentIds(connection.id);
    if (present.has(pid)) return; // still connected on another tab

    let next = this.state;
    let scheduleLeave = false;
    if (next.phase === "lobby") {
      if (next.players.some((p) => p.id === pid) && !next.pendingLeave[pid]) {
        next = { ...next, pendingLeave: { ...next.pendingLeave, [pid]: Date.now() + LEAVE_GRACE_MS } };
        scheduleLeave = true;
      }
    } else {
      if (next.hostId === pid) {
        const heir = next.players.find((p) => present.has(p.id));
        if (heir) next = { ...next, hostId: heir.id };
      }
      next = reassignRoles(next, [...present]);
    }

    if (next !== this.state) {
      this.state = next;
      await this.persist();
      this.broadcastState();
    }
    if (scheduleLeave) await this.scheduleLeaveAlarm();
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
