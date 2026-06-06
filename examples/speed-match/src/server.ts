/**
 * Standalone entrypoint: run Speed Match as its own mp-runtime server.
 *
 * Env: PORT, CLIENT_ORIGINS, TRANSLATOR_API_BASE, and one of MATCH_JWKS_URL /
 * MATCH_TICKET_SECRET (see @memdecks/mp-runtime).
 */
import { createMultiplayerServer } from "@memdecks/mp-runtime";
import { speedMatchModule } from "./module";

createMultiplayerServer({ game: speedMatchModule });
