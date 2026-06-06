/**
 * @memdecks/mp-client — browser-side helper for memdecks games.
 *
 * Single-player:
 *   const { session } = await initGame();
 *   const cards = await fetchUserCards(session!);
 *
 * Multiplayer:
 *   const { session } = await initGame();
 *   const conn = joinMatch(session!.match!, { onState: render, onOver: showResult });
 *   conn.sendAction("guess", { fieldId, seq });
 */
export { initGame } from "./bridge";
export type { GameSession, InitOptions, TranslatorBridge } from "./bridge";
export { joinMatch } from "./match";
export type { MatchHandlers, MatchConnection } from "./match";
export { fetchUserCards } from "./cards";

// Re-export the contracts for convenience.
export * from "@memdecks/mp-types";
