import { routePartykitRequest, Server, type Connection } from "partyserver";
import { reduce, initialState, type GameState, type ClientMsg } from "../../lib/game";

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

  private payload() {
    return JSON.stringify({ type: "state", state: this.state });
  }

  onConnect(connection: Connection<ConnState>) {
    connection.send(this.payload());
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

    if (alarm === null) {
      const existing = await this.ctx.storage.getAlarm();
      if (existing !== null) await this.ctx.storage.deleteAlarm();
    } else if (typeof alarm === "number") {
      await this.ctx.storage.setAlarm(alarm);
    }

    await this.persist();
    this.broadcast(this.payload());
  }

  // Server-authoritative turn timer: fires when the 60s window closes.
  async onAlarm() {
    const s = this.state;
    if (s.turnActive && s.turn && s.turnEndsAt && Date.now() >= s.turnEndsAt) {
      this.state = {
        ...s,
        turnActive: false,
        turnsDone: { ...s.turnsDone, [s.turn]: true },
      };
      await this.persist();
      this.broadcast(this.payload());
    }
  }

  // If the host's last connection drops, hand the crown to someone still here.
  async onClose(connection: Connection<ConnState>) {
    const pid = (connection.state as ConnState | null)?.playerId;
    if (!pid || this.state.hostId !== pid) return;

    const present = new Set<string>();
    for (const c of this.getConnections()) {
      if (c.id === connection.id) continue;
      const cs = c.state as ConnState | null;
      if (cs?.playerId) present.add(cs.playerId);
    }
    if (present.has(pid)) return; // host still has another tab open

    const heir = this.state.players.find((p) => present.has(p.id));
    if (heir) {
      this.state = { ...this.state, hostId: heir.id };
      await this.persist();
      this.broadcast(this.payload());
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
