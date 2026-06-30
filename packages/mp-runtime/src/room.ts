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
  type GameResult,
  type MatchTicketClaims,
  type MatchedPlayer,
  type MpActionPayload,
  type TranslateFn,
} from "@memdecks/mp-types";
import { noopReporter, type LifecycleEventType, type LifecycleReporter } from "./reporter";

interface Seat {
  player: MatchedPlayer;
  socketId?: string;
  cards?: Card[];
  present: boolean;
  /** This player's scoped card token, retained to authorize lifecycle pushes. */
  cardToken?: string;
}

export class Room<State = unknown, Action = unknown> {
  readonly matchId: string;
  readonly gameId: string;
  private readonly io: Server;
  private readonly module: GameModule<State, Action>;
  private readonly settings: Record<string, unknown>;
  private readonly translate: TranslateFn | undefined;
  private readonly reporter: LifecycleReporter;
  private readonly seats = new Map<string, Seat>();
  private state: State | undefined;
  private started = false;
  private over = false;
  private result: GameResult | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  /** Guards so each lifecycle moment is pushed at most once. */
  private launchReported = false;
  private resultReported = false;
  private abandonReported = false;

  /** True once the match has finished — read by the runtime's match-status endpoint. */
  hasEnded(): boolean {
    return this.over;
  }

  constructor(
    io: Server,
    module: GameModule<State, Action>,
    claims: MatchTicketClaims,
    translate?: TranslateFn,
    reporter: LifecycleReporter = noopReporter,
  ) {
    this.io = io;
    this.module = module;
    this.matchId = claims.matchId;
    this.gameId = claims.gameId;
    this.settings = claims.settings ?? {};
    this.translate = translate;
    this.reporter = reporter;
    for (const player of claims.players) {
      this.seats.set(player.userId, { player, present: false });
    }
  }

  /** Attach a (re)connecting player's socket and cards; start the match when ready. */
  join(socketId: string, userId: string, cards: Card[], cardToken?: string): void {
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
    if (cardToken) seat.cardToken = cardToken;

    if (this.started) {
      // Reconnect: send the current view immediately.
      this.emitTo(seat);
      // If the match already ended while this player was away, re-announce the result so a
      // resuming/reconnecting client shows its game-over screen instead of a stale board.
      if (this.over && this.result) {
        this.io.to(socketId).emit(MP_EVENTS.over, { result: this.result });
      }
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

  /** The match is being torn down because everyone left. If it had started but never
   *  finished, record it as abandoned in the ledger (once). Call before `dispose()`. */
  reportAbandonIfUnfinished(): void {
    if (!this.started || this.over) return;
    this.reportLifecycle("abandon");
  }

  // ── internals ─────────────────────────────────────────────────────────────

  /** Push a per-player lifecycle moment to the platform (best-effort). */
  private reportLifecycle(type: LifecycleEventType, result?: GameResult): void {
    if (type === "launch") {
      if (this.launchReported) return;
      this.launchReported = true;
    } else if (type === "result") {
      if (this.resultReported) return;
      this.resultReported = true;
    } else if (type === "abandon") {
      if (this.abandonReported) return;
      this.abandonReported = true;
    }
    for (const seat of this.seats.values()) {
      this.reporter.report({
        type,
        matchId: this.matchId,
        gameId: this.gameId,
        userId: seat.player.userId,
        seat: seat.player.seat,
        ...(seat.player.role !== undefined ? { role: seat.player.role } : {}),
        ...(seat.player.language !== undefined ? { language: seat.player.language } : {}),
        ...(seat.cardToken !== undefined ? { cardToken: seat.cardToken } : {}),
        ...(result !== undefined ? { result } : {}),
      });
    }
  }

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

    // Guard re-entry before awaiting: a second join while createMatch is in flight
    // must not start the match twice.
    this.started = true;
    Promise.resolve(
      this.module.createMatch({
        matchId: this.matchId,
        players,
        settings: this.settings,
        cards,
        ...(this.translate ? { translate: this.translate } : {}),
      }),
    )
      .then((state) => {
        this.state = state;
        this.reportLifecycle("launch");
        this.afterMutation();
      })
      .catch((err: unknown) => {
        this.started = false;
        this.io.to(this.matchId).emit(MP_EVENTS.error, {
          message: `Match setup failed: ${(err as Error)?.message ?? String(err)}`,
        });
      });
  }

  /** Broadcast + over-check + timer re-arm. Call after start, each action, each tick. */
  private afterMutation(): void {
    if (this.state === undefined) return;
    this.broadcast();

    const result = this.module.isOver(this.state);
    if (result && !this.over) {
      this.over = true;
      this.result = result; // retain so a late reconnect can be re-shown the outcome
      if (this.timer) clearTimeout(this.timer);
      this.timer = undefined;
      this.io.to(this.matchId).emit(MP_EVENTS.over, { result });
      this.reportLifecycle("result", result);
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
