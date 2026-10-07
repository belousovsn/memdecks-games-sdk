/**
 * @memdecks/mp-runtime — the Tier-2 game session engine.
 *
 * Typical standalone usage:
 *
 *   import { createMultiplayerServer } from "@memdecks/mp-runtime";
 *   import { tetrisModule } from "./game";
 *   createMultiplayerServer({ game: tetrisModule });
 *
 * Hub usage: pass `games: [moduleA, moduleB]` instead.
 */
export { createMultiplayerServer } from "./server";
export type {
  MultiplayerServerOptions,
  MultiplayerServerHandle,
} from "./server";
export { loadEnv } from "./env";
export type { RuntimeEnv } from "./env";
export { createTicketVerifier } from "./auth";
export type { TicketVerifier } from "./auth";
export { defaultCardProvider, normalizeCardRow } from "./cards";
export type { CardProvider, CardProviderArgs } from "./cards";
export { defaultTranslateProvider, defaultTranslateSensesProvider, senseRequestFor } from "./translate";
export type { TranslateProvider, TranslateProviderArgs, TranslateSensesProvider } from "./translate";
export { createHttpReporter, noopReporter } from "./reporter";
export type {
  LifecycleReporter,
  LifecycleEvent,
  LifecycleEventType,
  HttpReporterOptions,
} from "./reporter";
export { Room } from "./room";

// Re-export the contracts so consumers can import everything from the runtime.
export * from "@memdecks/mp-types";
