/**
 * Match-ticket verification. The platform lobby signs tickets; the runtime verifies
 * them — no platform->operator call needed. Supports two modes:
 *   - Remote JWKS (RS/ES) via MATCH_JWKS_URL  (production)
 *   - Shared HS256 secret via MATCH_TICKET_SECRET (dev / simple single-operator)
 */
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import type { MatchTicketClaims } from "@memdecks/mp-types";
import type { RuntimeEnv } from "./env";

export type TicketVerifier = (token: string) => Promise<MatchTicketClaims>;

export function createTicketVerifier(env: RuntimeEnv): TicketVerifier {
  let jwks: JWTVerifyGetKey | undefined;
  if (env.matchJwksUrl) {
    jwks = createRemoteJWKSet(new URL(env.matchJwksUrl));
  }
  const secret = env.matchTicketSecret
    ? new TextEncoder().encode(env.matchTicketSecret)
    : undefined;

  if (!jwks && !secret) {
    throw new Error(
      "mp-runtime: no match-ticket verification key configured. Set MATCH_JWKS_URL or MATCH_TICKET_SECRET.",
    );
  }

  return async function verify(token: string): Promise<MatchTicketClaims> {
    const { payload } = jwks
      ? await jwtVerify(token, jwks, { issuer: env.matchTicketIssuer })
      : await jwtVerify(token, secret!, { issuer: env.matchTicketIssuer });

    const claims = payload as unknown as MatchTicketClaims;
    if (!claims.matchId || !claims.gameId || !claims.sub) {
      throw new Error("match ticket missing required claims (matchId/gameId/sub)");
    }
    if (claims.aud !== `game:${claims.gameId}`) {
      throw new Error("match ticket audience mismatch");
    }
    return claims;
  };
}
