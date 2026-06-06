// Ad-hoc smoke test for @memdecks/mp-runtime (not part of the package).
// Boots the runtime with an HS256 ticket + a trivial solo GameModule, joins over a
// socket, and asserts a match forms and a per-player view is broadcast.
import { createMultiplayerServer } from "./packages/mp-runtime/dist/index.js";
import { SignJWT } from "jose";
import { io } from "socket.io-client";

const SECRET = "test-secret";
const PORT = 4599;

const gameModule = {
  manifest: {
    id: "smoke",
    title: "Smoke",
    minPlayers: 1,
    maxPlayers: 1,
    settingsSchema: [],
    requiresCards: { minUsable: 0, perLanguage: false },
  },
  createMatch(ctx) {
    return {
      players: ctx.players.map((p) => p.userId),
      cardCount: (ctx.cards[ctx.players[0].userId] || []).length,
      moves: 0,
    };
  },
  applyAction(state) {
    state.moves++;
  },
  viewFor(state) {
    return state;
  },
  isOver() {
    return null;
  },
};

const handle = createMultiplayerServer({
  game: gameModule,
  cardProvider: async () => [{ id: "c1", english: "cat", translations: {} }],
  env: {
    port: PORT,
    matchTicketSecret: SECRET,
    clientOrigins: ["*"],
    translatorApiBase: "http://unused",
  },
});

const ticket = await new SignJWT({
  matchId: "m1",
  gameId: "smoke",
  seat: 0,
  players: [{ userId: "u1", name: "A", seat: 0 }],
  settings: {},
})
  .setProtectedHeader({ alg: "HS256" })
  .setIssuer("memdecks-platform")
  .setAudience("game:smoke")
  .setSubject("u1")
  .setExpirationTime("5m")
  .sign(new TextEncoder().encode(SECRET));

const socket = io(`http://localhost:${PORT}`, { transports: ["websocket"] });

const state = await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error("timeout waiting for mp:state")), 4000);
  socket.on("connect", () => socket.emit("mp:join", { matchTicket: ticket }));
  socket.on("mp:error", (e) => {
    clearTimeout(t);
    reject(new Error("mp:error: " + e.message));
  });
  socket.on("mp:state", (s) => {
    clearTimeout(t);
    resolve(s);
  });
});

let ok = true;
try {
  if (state.cardCount !== 1) { ok = false; console.error("FAIL: expected cardCount 1, got", state.cardCount); }
  if (!state.players || state.players[0] !== "u1") { ok = false; console.error("FAIL: roster wrong", state.players); }
  if (ok) console.log("SMOKE OK — match formed, view broadcast:", JSON.stringify(state));
} finally {
  socket.close();
  await handle.close();
  process.exit(ok ? 0 : 1);
}
