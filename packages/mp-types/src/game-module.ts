/**
 * GameModule — the contract a game author implements. The runtime owns transport,
 * lobby, auth, card provisioning, and broadcasting; it calls into this contract.
 *
 * `playerId` throughout is the stable per-match player id (the player's userId),
 * not a socket id — so it survives reconnects.
 */
import type { Card, CardTranslation } from "./cards";
import type { MatchedPlayer } from "./match";

/** A dropdown setting the platform lobby renders generically. */
export interface SelectSettingsField {
  key: string;
  label: string;
  type: "select";
  default: string | number;
  options: Array<{ value: string | number; label: string }>;
}

/** A numeric setting. */
export interface NumberSettingsField {
  key: string;
  label: string;
  type: "number";
  default: number;
  min?: number;
  max?: number;
  step?: number;
}

/** A toggle setting. */
export interface BooleanSettingsField {
  key: string;
  label: string;
  type: "boolean";
  default: boolean;
}

export type SettingsField =
  | SelectSettingsField
  | NumberSettingsField
  | BooleanSettingsField;

/** Static metadata the platform lobby reads to render settings and drive matchmaking. */
export interface GameManifest {
  /** Unique game id; must match the GAME_APPS / games.json key. */
  id: string;
  title: string;
  /** `1` enables solo. The lobby uses min/max to choose solo / 1v1 / N-player. */
  minPlayers: number;
  maxPlayers: number;
  /** Declared role names for asymmetric games (e.g. ["bandit","inspector"]); omit if symmetric. */
  roles?: string[];
  /** Settings the platform lobby renders generically before forming a match. */
  settingsSchema: SettingsField[];
  /** Card requirements the lobby pre-checks per player before forming a match. */
  requiresCards: {
    /** Minimum number of usable cards required to play. */
    minUsable: number;
    /** Whether `minUsable` must be met within the chosen study language. */
    perLanguage: boolean;
  };
}

/** Outcome of a finished match. */
export interface GameResult {
  /** "won" | "lost" | "draw" or a game-specific outcome string. */
  outcome: string;
  /** Optional per-player scores, keyed by userId. */
  scores?: Record<string, number>;
}

/** A rating change produced from a result (future platform ratings). */
export interface RatingDelta {
  userId: string;
  delta: number;
}

/**
 * Translate English words into target study languages (platform-backed, lookup-only).
 * Returns, per word, the translation in each requested language — or `null` where the
 * platform has no stored translation. Games call this from `createMatch` to localize
 * just the cards they actually picked (e.g. showing one player's card to a co-player
 * who studies a different language).
 */
export type TranslateFn = (
  words: string[],
  languages: string[],
) => Promise<Record<string, Partial<Record<string, CardTranslation | null>>>>;

/** Inputs handed to `createMatch` when a match (incl. solo) is formed. */
export interface MatchContext {
  matchId: string;
  /** Roster, ordered by seat. Length is 1 for solo. */
  players: MatchedPlayer[];
  /** Resolved settings, validated against `manifest.settingsSchema`. */
  settings: Record<string, unknown>;
  /** Each player's resolved cards, keyed by userId. */
  cards: Record<string, Card[]>;
  /** Platform-backed word translation; absent when the runtime has no provider. */
  translate?: TranslateFn;
}

/**
 * The only substantial code a game author writes.
 *
 * @typeParam State  - the authoritative server-side match state (opaque to the runtime).
 * @typeParam Action - the discrete action payload sent over the standardized action channel.
 */
export interface GameModule<State = unknown, Action = unknown> {
  manifest: GameManifest;

  /**
   * Build authoritative initial state for a formed match (solo = 1 player).
   * May be async — e.g. to call `ctx.translate` for the cards it picked. The runtime
   * holds the match in a waiting state until the promise settles.
   */
  createMatch(ctx: MatchContext): State | Promise<State>;

  /** Apply a discrete player action (the standardized `mp:action` channel). */
  applyAction(state: State, playerId: string, action: Action): void;

  /**
   * Optional real-time loop — `tick` advances time-based state when the runtime's
   * timer fires (e.g. a tetris word reaching the bottom). Pair with `nextDelayMs`.
   */
  tick?(state: State): void;

  /**
   * Pure query: milliseconds until the next `tick` should fire, or `null` for
   * "no timer right now". The runtime re-arms the timer after the match starts and
   * after every action and tick, so timing stays correct when actions change it.
   */
  nextDelayMs?(state: State): number | null;

  /** Per-player view broadcast as `mp:state`. Hide other players' secrets here. */
  viewFor(state: State, playerId: string): unknown;

  /**
   * Optional extra per-player channels (e.g. `secret_update`, `inspector_hand`),
   * each broadcast as an `mp:channel` message. Keyed by channel name.
   */
  channelsFor?(state: State, playerId: string): Record<string, unknown>;

  /** Return a result when the match is over, otherwise `null`. */
  isOver(state: State): GameResult | null;

  /** Optional: produce rating changes from a result (consumed by the platform later). */
  onResult?(result: GameResult): RatingDelta[];
}
