/**
 * Entry point. Runs your GameModule as a standalone mp-runtime server.
 * Env: PORT, CLIENT_ORIGINS, TRANSLATOR_API_BASE, and one of MATCH_JWKS_URL /
 * MATCH_TICKET_SECRET (see @memdecks/mp-runtime).
 */
import { createMultiplayerServer } from "@memdecks/mp-runtime";
import { gameModule } from "./module";

createMultiplayerServer({ game: gameModule });
