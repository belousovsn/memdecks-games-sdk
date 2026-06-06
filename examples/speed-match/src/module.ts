/**
 * Speed Match — a reference multiplayer GameModule for the memdecks SDK.
 *
 * Each round shows a foreign word; players race to tap the matching English card.
 * First correct answer (or everyone answering, or the round timer) advances the round.
 * Demonstrates: settings schema, card use, real-time loop (tick + nextDelayMs),
 * scoring, solo (minPlayers 1) and multiplayer (up to 4). Symmetric — no roles.
 *
 * This is the file a game author writes; the runtime does everything else.
 */
import type { Card, GameModule, GameResult, MatchContext } from "@memdecks/mp-types";

export interface SpeedMatchSettings {
  rounds: number;
  roundMs: number;
  language: string;
}

interface RoundDef {
  promptCardId: string;
  choiceIds: string[];
}

export interface SpeedMatchState {
  settings: SpeedMatchSettings;
  byId: Record<string, Card>;
  rounds: RoundDef[];
  roundIndex: number;
  roundDeadline: number;
  scores: Record<string, number>;
  answered: Record<string, true>;
  finished: boolean;
}

export type SpeedMatchAction = { action: string; payload?: { cardId?: string } };

const DEFAULTS: SpeedMatchSettings = { rounds: 5, roundMs: 10000, language: "hy" };

function readSettings(s: Record<string, unknown>): SpeedMatchSettings {
  return {
    rounds: typeof s.rounds === "number" ? s.rounds : DEFAULTS.rounds,
    roundMs: typeof s.roundMs === "number" ? s.roundMs : DEFAULTS.roundMs,
    language: typeof s.language === "string" ? s.language : DEFAULTS.language,
  };
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildRounds(pool: Card[], settings: SpeedMatchSettings): RoundDef[] {
  return shuffle(pool)
    .slice(0, settings.rounds)
    .map((prompt) => {
      const distractors = shuffle(pool.filter((c) => c.id !== prompt.id)).slice(0, 3);
      return {
        promptCardId: prompt.id,
        choiceIds: shuffle([prompt, ...distractors].map((c) => c.id)),
      };
    });
}

function advance(state: SpeedMatchState): void {
  state.roundIndex += 1;
  state.answered = {};
  if (state.roundIndex >= state.rounds.length) {
    state.finished = true;
    return;
  }
  state.roundDeadline = Date.now() + state.settings.roundMs;
}

export const speedMatchModule: GameModule<SpeedMatchState, SpeedMatchAction> = {
  manifest: {
    id: "speed-match",
    title: "Speed Match",
    minPlayers: 1,
    maxPlayers: 4,
    settingsSchema: [
      { key: "rounds", label: "Rounds", type: "number", default: 5, min: 1, max: 20 },
      { key: "roundMs", label: "Ms per round", type: "number", default: 10000, min: 3000, max: 30000 },
      {
        key: "language",
        label: "Study language",
        type: "select",
        default: "hy",
        options: [
          { value: "hy", label: "Armenian" },
          { value: "gr", label: "Greek" },
          { value: "ru", label: "Russian" },
        ],
      },
    ],
    requiresCards: { minUsable: 4, perLanguage: true },
  },

  createMatch(ctx: MatchContext): SpeedMatchState {
    const settings = readSettings(ctx.settings);
    // Union of every player's cards that have a usable translation in the chosen language.
    const byId: Record<string, Card> = {};
    for (const list of Object.values(ctx.cards)) {
      for (const card of list) {
        if (card.english && card.translations[settings.language]?.word) byId[card.id] = card;
      }
    }
    const pool = Object.values(byId);
    const scores: Record<string, number> = {};
    for (const p of ctx.players) scores[p.userId] = 0;
    return {
      settings,
      byId,
      rounds: buildRounds(pool, settings),
      roundIndex: 0,
      roundDeadline: Date.now() + settings.roundMs,
      scores,
      answered: {},
      finished: pool.length < 2,
    };
  },

  applyAction(state, playerId, action) {
    if (state.finished || action.action !== "answer" || state.answered[playerId]) return;
    const round = state.rounds[state.roundIndex];
    if (!round) return;
    state.answered[playerId] = true;
    if (action.payload?.cardId === round.promptCardId) {
      state.scores[playerId] = (state.scores[playerId] ?? 0) + 1;
      advance(state);
    } else if (Object.keys(state.answered).length >= Object.keys(state.scores).length) {
      advance(state); // everyone answered (all wrong) -> next round
    }
  },

  tick(state) {
    if (!state.finished) advance(state); // round timer expired
  },

  nextDelayMs(state) {
    return state.finished ? null : Math.max(0, state.roundDeadline - Date.now());
  },

  viewFor(state, playerId) {
    const round = state.rounds[state.roundIndex];
    const prompt = round ? state.byId[round.promptCardId] : undefined;
    const t = prompt?.translations[state.settings.language];
    return {
      round: state.roundIndex + 1,
      totalRounds: state.rounds.length,
      prompt: t ? { word: t.word, transliteration: t.transliteration } : null,
      choices: round
        ? round.choiceIds.map((id) => ({
            cardId: id,
            english: state.byId[id]?.english ?? "",
            imageUrl: state.byId[id]?.imageUrl,
          }))
        : [],
      scores: state.scores,
      youAnswered: Boolean(state.answered[playerId]),
      finished: state.finished,
    };
  },

  isOver(state): GameResult | null {
    return state.finished ? { outcome: "complete", scores: state.scores } : null;
  },
};
