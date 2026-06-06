/** Runtime configuration, read from process.env with optional code overrides. */
export interface RuntimeEnv {
  /** Port the HTTP/Socket.IO server listens on. */
  port: number;
  /** Allowed browser origins for CORS (Express + Socket.IO). */
  clientOrigins: string[];
  /** Base URL of the Translator public API, for card provisioning. */
  translatorApiBase: string;
  /** Issuer the match ticket must declare (defaults to "memdecks-platform"). */
  matchTicketIssuer: string;
  /** Remote JWKS URL for verifying asymmetric (RS/ES) match tickets. */
  matchJwksUrl?: string;
  /** Shared secret for verifying symmetric (HS256) match tickets (dev/simple setups). */
  matchTicketSecret?: string;
}

function csv(value: string | undefined, fallback: string[]): string[] {
  if (!value) return fallback;
  const parts = value.split(",").map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts : fallback;
}

/** Build a RuntimeEnv from process.env, applying any explicit overrides on top. */
export function loadEnv(overrides: Partial<RuntimeEnv> = {}): RuntimeEnv {
  const env: RuntimeEnv = {
    port: Number(process.env["PORT"] ?? 3001),
    clientOrigins: csv(process.env["CLIENT_ORIGINS"], ["http://localhost:5173"]),
    translatorApiBase:
      process.env["TRANSLATOR_API_BASE"] ?? "https://test.memdecks.com",
    matchTicketIssuer:
      process.env["MATCH_TICKET_ISSUER"] ?? "memdecks-platform",
    ...(process.env["MATCH_JWKS_URL"]
      ? { matchJwksUrl: process.env["MATCH_JWKS_URL"] }
      : {}),
    ...(process.env["MATCH_TICKET_SECRET"]
      ? { matchTicketSecret: process.env["MATCH_TICKET_SECRET"] }
      : {}),
    ...overrides,
  };
  return env;
}
