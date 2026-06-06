/**
 * First-party hub: run several GameModules in ONE mp-runtime process, routed by the
 * `gameId` in each match ticket. This is how memdecks hosts its own (trusted) games so
 * each one doesn't need its own node process. Add your modules to the `games` array.
 *
 * Untrusted, third-party games are NOT hosted here — they self-host their own runtime.
 *
 * Env: PORT, CLIENT_ORIGINS, TRANSLATOR_API_BASE, and MATCH_JWKS_URL (point at the
 * Translator's /.well-known/jwks.json so tickets verify).
 */
import { createMultiplayerServer } from "@memdecks/mp-runtime";
import { speedMatchModule } from "@memdecks/example-speed-match";

createMultiplayerServer({
  games: [
    speedMatchModule,
    // add more first-party modules here, e.g. wordsTetrisModule, lexiSpyModule
  ],
});
