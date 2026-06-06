/**
 * A Room is one match. It waits for all rostered players to connect, calls the
 * GameModule to build authoritative state, then drives broadcasting + the optional
 * real-time timer. Player identity is the stable userId (survives reconnects).
 */
import type { Server } from "socket.io";
import {
  MP_EVENTS,
  type Card,
  type GameModule,
  type MatchTicketClaims,
  type MatchedPlayer,
  type MpActionPayload,
} from "@memdecks/mp-types";

interface Seat {
  player: MatchedPlayer;
  socketId?: string;
  cards?: Card[];
  present: boolean;
}

export class Room<State = unknown, Action = unknown> {
  readonly matchId: string;
  readonly gameId: string;
  private readonly io: Server;
  private readonly module: GameModule<State, Action>;
  private readonly settings: Record<string, unknown>;
  private readonly seats = new Map<string, Seat>();
  private state: State | undefined;
  private started = false;
  private over = false;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(io: Server, module: GameModule<State, Action>, claims: MatchTicketClaims) {
    this.io = io;
    this.module = module;
    this.matchId = claims.matchId;
    this.gameId = claims.gameId;
    this.settings = claims.settings ?? {};
    for (const player of claims.players) {
      this.seats.set(player.userId, { player, present: false });
    }
  }

  /** Attach a (re)connecting player's socket and cards; start the match when ready. */
  join(socketId: string, userId: string, cards: Card[]): void {
    const seat = this.seats.get(userId);
    if (!seat) {
      this.io.to(socketId).emit(MP_EVENTS.error, {
        message: "You are not part of this match.",
      });
      return;
    }
    seat.socketId = socketId;
    seat.cards = cards;
    seat.present = true;

    if (this.started) {
      // Reconnect: send the current view immediately.
      this.emitTo(seat);
      return;
    }
    if (this.allReady()) this.start();
  }

  /** Handle a discrete gameplay action from a player. */
  handleAction(userId: string, payload: MpActionPayload): void {
    if (!this.started || this.over || this.state === undefined) return;
    if (!this.seats.has(userId)) return;
    this.module.applyAction(this.state, userId, payload as unknown as Action);
    this.afterMutation();
  }

  /** Mark a player disconnected; state is retained for reconnection. */
  disconnect(userId: string): void {
    const seat = this.seats.get(userId);
    if (!seat) return;
    seat.present = false;
    seat.socketId = undefined;
  }

  /** True when no players remain connected — the server may dispose the room. */
  isEmpty(): boolean {
    for (const seat of this.seats.values()) if (seat.present) return false;
    return true;
  }

  dispose(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private allReady(): boolean {
    for (const seat of this.seats.values()) {
      if (!seat.present || !seat.cards) return false;
    }
    return true;
  }

  private start(): void {
    const players = [...this.seats.values()]
      .map((s) => s.player)
      .sort((a, b) => a.seat - b.seat);
    const cards: Record<string, Card[]> = {};
    for (const [userId, seat] of this.seats) cards[userId] = seat.cards ?? [];

    this.state = this.module.createMatch({
      matchId: this.matchId,
      players,
      settings: this.settings,
      cards,
    });
    this.started = true;
    this.afterMutation();
  }

  /** Broadcast + over-check + timer re-arm. Call after start, each action, each tick. */
  private afterMutation(): void {
    if (this.state === undefined) return;
    this.broadcast();

    const result = this.module.isOver(this.state);
    if (result && !this.over) {
      this.over = true;
      if (this.timer) clearTimeout(this.timer);
      this.timer = undefined;
      this.io.to(this.matchId).emit(MP_EVENTS.over, { result });
      this.module.onResult?.(result);
      return;
    }
    this.reschedule();
  }

  private reschedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    if (this.over || this.state === undefined || !this.module.tick) return;
    const delay = this.module.nextDelayMs?.(this.state);
    if (delay == null) return;
    this.timer = setTimeout(() => {
      if (this.over || this.state === undefined) return;
      this.module.tick?.(this.state);
      this.afterMutation();
    }, Math.max(0, delay));
  }

  private broadcast(): void {
    if (this.state === undefined) return;
    for (const [userId, seat] of this.seats) {
      if (seat.present && seat.socketId) this.emitTo(seat, userId);
    }
  }

  private emitTo(seat: Seat, userId = seat.player.userId): void {
    if (this.state === undefined || !seat.socketId) return;
    this.io.to(seat.socketId).emit(MP_EVENTS.state, this.module.viewFor(this.state, userId));
    const channels = this.module.channelsFor?.(this.state, userId);
    if (channels) {
      for (const [channel, data] of Object.entries(channels)) {
        this.io.to(seat.socketId).emit(MP_EVENTS.channel, { channel, data });
      }
    }
  }
}
