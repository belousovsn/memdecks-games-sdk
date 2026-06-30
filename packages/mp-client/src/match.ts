/**
 * Join a formed match over Socket.IO using the signed handoff from `translator:init`.
 * Connects to the operator's mp-runtime, presents the ticket, and wires the
 * standardized gameplay channel.
 */
import { io, type Socket } from "socket.io-client";
import {
  MP_EVENTS,
  PROTOCOL_VERSION,
  type MatchHandoff,
  type MpActionPayload,
  type MpChannelPayload,
  type MpErrorPayload,
  type MpJoinPayload,
  type MpOverPayload,
  type MpPresencePayload,
} from "@memdecks/mp-types";

export interface MatchHandlers<View = unknown> {
  /** Per-player view from the server (GameModule.viewFor). */
  onState?: (view: View) => void;
  /** An extra per-player channel update (GameModule.channelsFor). */
  onChannel?: (msg: MpChannelPayload) => void;
  /** The match finished. */
  onOver?: (msg: MpOverPayload) => void;
  /** A rostered player left or returned mid-match (show "opponent left" / "reconnecting"). */
  onPresence?: (msg: MpPresencePayload) => void;
  /** Server-side error (bad ticket, not in match, etc.). */
  onError?: (msg: MpErrorPayload) => void;
  /** Transport-level connection failure. */
  onConnectError?: (err: Error) => void;
}

export interface MatchConnection {
  socket: Socket;
  /** Send a discrete gameplay action over the standardized `mp:action` channel. */
  sendAction(action: string, payload?: Record<string, unknown>): void;
  disconnect(): void;
}

export function joinMatch<View = unknown>(
  handoff: MatchHandoff,
  handlers: MatchHandlers<View> = {},
): MatchConnection {
  const socket: Socket = io(handoff.mpServerUrl, {
    transports: ["websocket"],
    autoConnect: true,
  });

  socket.on("connect", () => {
    const join: MpJoinPayload = { matchTicket: handoff.matchTicket, protocolVersion: PROTOCOL_VERSION };
    socket.emit(MP_EVENTS.join, join);
  });
  if (handlers.onState) socket.on(MP_EVENTS.state, handlers.onState);
  if (handlers.onChannel) socket.on(MP_EVENTS.channel, handlers.onChannel);
  if (handlers.onOver) socket.on(MP_EVENTS.over, handlers.onOver);
  if (handlers.onPresence) socket.on(MP_EVENTS.presence, handlers.onPresence);
  if (handlers.onError) socket.on(MP_EVENTS.error, handlers.onError);
  if (handlers.onConnectError) socket.on("connect_error", handlers.onConnectError);

  return {
    socket,
    sendAction(action: string, payload?: Record<string, unknown>) {
      const msg: MpActionPayload = payload === undefined ? { action } : { action, payload };
      socket.emit(MP_EVENTS.action, msg);
    },
    disconnect() {
      socket.disconnect();
    },
  };
}
