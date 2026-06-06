/**
 * Your game's rules live here. The runtime owns transport, lobby, auth, cards, and
 * broadcasting — you only implement this GameModule. Replace the TODOs.
 *
 * `playerId` is the player's stable userId (survives reconnects), not a socket id.
 */
import type { Card, GameModule, GameResult, MatchContext } from "@memdecks/mp-types";

// 1) Your authoritative server-side state. Keep everything the game needs here.
export interface State {
  players: string[]; // userIds, in seat order
  deck: Card[];
  // TODO: turn/round, scores, board, whose-turn, etc.
  over: boolean;
}

// 2) The actions clients can send (over the standardized `mp:action` channel).
export type Action = { action: "example"; payload?: { value?: unknown } };

export const gameModule: GameModule<State, Action> = {
  manifest: {
    id: "my-game", // TODO: must match the GAME_APPS / games.json key
    title: "My Game",
    minPlayers: 1, // 1 enables solo
    maxPlayers: 2,
    // roles: ["attacker", "defender"], // uncomment for asymmetric games
    settingsSchema: [
      // TODO: settings the platform lobby will render, e.g.
      // { key: "rounds", label: "Rounds", type: "number", default: 5, min: 1, max: 20 },
    ],
    requiresCards: { minUsable: 0, perLanguage: false },
  },

  // Build initial state when the match (incl. solo) forms.
  createMatch(ctx: MatchContext): State {
    const deck = Object.values(ctx.cards).flat();
    return { players: ctx.players.map((p) => p.userId), deck, over: false };
  },

  // Handle one player action. Mutate `state` in place.
  applyAction(state, playerId, action) {
    if (state.over) return;
    if (action.action === "example") {
      // TODO: validate it's this player's move, apply it, maybe set state.over
    }
  },

  // Optional real-time loop (delete both if your game is turn-based):
  // tick(state) { /* advance time-based state when the timer fires */ },
  // nextDelayMs(state) { return state.over ? null : 1000 },

  // What each player sees. Hide other players' secrets here.
  viewFor(state, playerId) {
    return {
      you: playerId,
      players: state.players,
      over: state.over,
      // TODO: the player-visible game state
    };
  },

  // Optional extra per-player channels (e.g. a private hand):
  // channelsFor(state, playerId) { return { hand: /* ... */ [] } },

  // Return a result when the match ends, otherwise null.
  isOver(state): GameResult | null {
    return state.over ? { outcome: "complete" } : null;
  },

  // Optional: feed the platform rating system later.
  // onResult(result) { return [] },
};
