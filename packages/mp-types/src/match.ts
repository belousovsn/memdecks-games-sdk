/**
 * Match formation + handoff contracts.
 *
 * The Platform Lobby (Tier 1) forms a match and issues each player a signed
 * `matchTicket`. The client mounts the game iframe, connects to the operator's
 * mp-runtime (Tier 2), and presents the ticket. The runtime verifies it against
 * the platform JWKS — no platform->operator server call is required.
 */

/** A player as placed into a formed match. */
export interface MatchedPlayer {
  /** Translator user id (the stable per-match player id used throughout GameModule). */
  userId: string;
  /** Display name. */
  name: string;
  /** Stable 0-based seat index within the match. */
  seat: number;
  /** Assigned role, for games that declare `manifest.roles`. */
  role?: string;
  /** Study language from the player's account settings (e.g. "gr"), when known. */
  language?: string;
}

/**
 * Delivered to the game client inside `TranslatorInitMessage.match`.
 * Tells the client where and how to join the already-formed match.
 */
export interface MatchHandoff {
  matchId: string;
  gameId: string;
  /** Origin the gameplay socket connects to (operator's mp-runtime). */
  mpServerUrl: string;
  /** Signed JWT authorizing this client to join. Opaque to the client. */
  matchTicket: string;
  /** This client's own placement. */
  self: { seat: number; role?: string };
  /** Full roster, for pre-game UI. */
  players: MatchedPlayer[];
  /** Resolved game settings chosen in the lobby (validated against the manifest schema). */
  settings: Record<string, unknown>;
}

/**
 * Decoded match-ticket claims — verified by mp-runtime against the platform JWKS.
 * Never trust these without verifying the signature first.
 */
export interface MatchTicketClaims {
  /** Issuer, e.g. "memdecks-platform". */
  iss: string;
  /** Audience, "game:<gameId>". */
  aud: string;
  matchId: string;
  gameId: string;
  /** This player's user id (JWT subject). */
  sub: string;
  seat: number;
  role?: string;
  /** Full roster the runtime should expect for this match. */
  players: MatchedPlayer[];
  /** Resolved game settings. */
  settings: Record<string, unknown>;
  /** Scoped card token used to fetch this player's cards from the Translator API. */
  cardToken?: string;
  /** Issued-at (seconds). */
  iat: number;
  /** Expiry (seconds) — keep short. */
  exp: number;
}
