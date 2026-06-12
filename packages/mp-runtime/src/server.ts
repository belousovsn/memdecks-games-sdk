/**
 * createMultiplayerServer — boots an Express + Socket.IO server that runs one
 * GameModule (standalone) or many (hub, routed by gameId). It owns transport,
 * /health, CORS, match-ticket verification, card provisioning, and the room lifecycle.
 */
import http from "http";
import cors from "cors";
import express from "express";
import { Server } from "socket.io";
import {
  MP_EVENTS,
  type GameModule,
  type MpActionPayload,
  type MpJoinPayload,
} from "@memdecks/mp-types";
import { loadEnv, type RuntimeEnv } from "./env";
import { createTicketVerifier } from "./auth";
import { defaultCardProvider, type CardProvider } from "./cards";
import { defaultTranslateProvider, type TranslateProvider } from "./translate";
import { Room } from "./room";

export interface MultiplayerServerOptions {
  /** Standalone mode: a single game. */
  game?: GameModule<any, any>;
  /** Hub mode: many games, routed by `manifest.id`. */
  games?: Array<GameModule<any, any>>;
  /** Env overrides; anything omitted is read from process.env. */
  env?: Partial<RuntimeEnv>;
  /** Custom card provider; defaults to GET {apiBase}/api/cards with the scoped token. */
  cardProvider?: CardProvider;
  /** Custom `ctx.translate` provider; defaults to POST {apiBase}/api/cards/translate. */
  translateProvider?: TranslateProvider;
}

export interface MultiplayerServerHandle {
  io: Server;
  httpServer: http.Server;
  env: RuntimeEnv;
  close(): Promise<void>;
}

export function createMultiplayerServer(
  opts: MultiplayerServerOptions,
): MultiplayerServerHandle {
  const env = loadEnv(opts.env);

  const modules = new Map<string, GameModule<any, any>>();
  const list = opts.games ?? (opts.game ? [opts.game] : []);
  if (list.length === 0) {
    throw new Error("createMultiplayerServer: provide `game` or `games`.");
  }
  for (const m of list) {
    if (modules.has(m.manifest.id)) {
      throw new Error(`Duplicate game id: ${m.manifest.id}`);
    }
    modules.set(m.manifest.id, m);
  }

  const verify = createTicketVerifier(env);
  const cardProvider = opts.cardProvider ?? defaultCardProvider;
  const translateProvider = opts.translateProvider ?? defaultTranslateProvider;

  const app = express();
  app.use(cors({ origin: env.clientOrigins }));
  app.use(express.json());
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", games: [...modules.keys()] });
  });
  // Manifests for the platform lobby to import (settingsSchema, player counts, roles).
  app.get("/manifest", (_req, res) => {
    res.json([...modules.values()].map((m) => m.manifest));
  });

  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: env.clientOrigins, methods: ["GET", "POST"] },
  });

  const rooms = new Map<string, Room>();

  io.on("connection", (socket) => {
    socket.on(MP_EVENTS.join, async (payload: MpJoinPayload) => {
      try {
        if (!payload?.matchTicket) throw new Error("missing matchTicket");
        const claims = await verify(payload.matchTicket);

        const module = modules.get(claims.gameId);
        if (!module) {
          socket.emit(MP_EVENTS.error, { message: `Unknown game: ${claims.gameId}` });
          return;
        }

        const cards = await cardProvider({
          userId: claims.sub,
          cardToken: claims.cardToken,
          apiBase: env.translatorApiBase,
        });

        let room = rooms.get(claims.matchId);
        if (!room) {
          // Any rostered player's scoped token can authorize the match's translate calls.
          const translate = translateProvider({
            cardToken: claims.cardToken,
            apiBase: env.translatorApiBase,
          });
          room = new Room(io, module, claims, translate);
          rooms.set(claims.matchId, room);
        }

        socket.data.matchId = claims.matchId;
        socket.data.userId = claims.sub;
        socket.join(claims.matchId);
        room.join(socket.id, claims.sub, cards);
      } catch (err) {
        socket.emit(MP_EVENTS.error, { message: (err as Error).message });
      }
    });

    socket.on(MP_EVENTS.action, (payload: MpActionPayload) => {
      const matchId = socket.data.matchId as string | undefined;
      const userId = socket.data.userId as string | undefined;
      if (!matchId || !userId) return;
      if (!payload || typeof payload.action !== "string") return;
      rooms.get(matchId)?.handleAction(userId, payload);
    });

    socket.on("disconnect", () => {
      const matchId = socket.data.matchId as string | undefined;
      const userId = socket.data.userId as string | undefined;
      if (!matchId || !userId) return;
      const room = rooms.get(matchId);
      if (!room) return;
      room.disconnect(userId);
      if (room.isEmpty()) {
        room.dispose();
        rooms.delete(matchId);
      }
    });
  });

  httpServer.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(
      `[mp-runtime] listening on :${env.port} — games: ${[...modules.keys()].join(", ")}`,
    );
  });

  return {
    io,
    httpServer,
    env,
    async close() {
      for (const room of rooms.values()) room.dispose();
      rooms.clear();
      await new Promise<void>((resolve) => io.close(() => resolve()));
    },
  };
}
