/**
 * Gameplay socket protocol — the standardized Socket.IO event vocabulary between a
 * game client and the operator's mp-runtime (Tier 2). This replaces the ad-hoc,
 * per-game event names (`guess`, `request_action`, ...) with one shared channel.
 */
import type { GameResult } from "./game-module";

/**
 * Major version of the wire contract (bridge messages + MP_EVENTS + payload shapes).
 * It rides along in the handshakes (`translator:init`, `game:ready`, `mp:join`) so the
 * three independently-deployed parties — host, runtime, game — can detect a mismatch
 * instead of breaking silently. Bump ONLY on a breaking change (see AGENTS.md "Evolving
 * the contract"); receivers tolerate an absent version (old peers) but reject a different
 * major. Governance: Translator-app#187.
 */
export const PROTOCOL_VERSION = 1;

export const MP_EVENTS = {
  /** client -> server: join the match using the signed match ticket. */
  join: "mp:join",
  /** client -> server: a discrete gameplay action. */
  action: "mp:action",
  /** server -> client: per-player view (from GameModule.viewFor). */
  state: "mp:state",
  /** server -> client: an extra per-player channel update (from GameModule.channelsFor). */
  channel: "mp:channel",
  /** server -> client: the match finished. */
  over: "mp:over",
  /** server -> client: an error (bad ticket, not in match, etc.). */
  error: "mp:error",
} as const;

export type MpEvent = (typeof MP_EVENTS)[keyof typeof MP_EVENTS];

export interface MpJoinPayload {
  matchTicket: string;
  /** The game client's PROTOCOL_VERSION. Optional for back-compat; the runtime rejects a
   *  different major and tolerates its absence (older clients). */
  protocolVersion?: number;
}

export interface MpActionPayload {
  /** Action name within the game's Action union. */
  action: string;
  payload?: Record<string, unknown>;
}

export interface MpChannelPayload {
  channel: string;
  data: unknown;
}

export interface MpOverPayload {
  result: GameResult;
}

export interface MpErrorPayload {
  message: string;
}
