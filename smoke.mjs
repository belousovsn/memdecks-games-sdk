// Ad-hoc smoke test for @memdecks/mp-runtime (not part of the package).
// Boots the runtime with an HS256 ticket + a trivial solo GameModule, joins over a
// socket, and asserts a match forms and a per-player view is broadcast.
import http from "node:http";
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
  isOver(state) {
    // Stays live until the first action, then ends — lets the smoke exercise over + status.
    return state.moves >= 1 ? { ended: true } : null;
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
let socket2;
// node:http with agent:false (no keep-alive) so the process exits cleanly afterward.
const status = () =>
  new Promise((resolve, reject) => {
    const req = http.get(`http://localhost:${PORT}/matches/m1/status`, { agent: false }, (res) => {
      let body = "";
      res.on("data", (d) => (body += d));
      res.on("end", () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    });
    req.on("error", reject);
  });
try {
  if (state.cardCount !== 1) { ok = false; console.error("FAIL: expected cardCount 1, got", state.cardCount); }
  if (!state.players || state.players[0] !== "u1") { ok = false; console.error("FAIL: roster wrong", state.players); }

  // Liveness/status: the match exists and is still running.
  const s1 = await status();
  if (!s1.exists || s1.over) { ok = false; console.error("FAIL: status before over", JSON.stringify(s1)); }

  // End the match (one action triggers isOver) and confirm mp:over.
  const overP = new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("no mp:over")), 4000);
    socket.on("mp:over", (o) => { clearTimeout(t); resolve(o); });
  });
  socket.emit("mp:action", { action: "go" });
  await overP;

  // Status now reports over.
  const s2 = await status();
  if (!s2.exists || !s2.over) { ok = false; console.error("FAIL: status after over", JSON.stringify(s2)); }

  // A player reconnecting after the match ended is re-shown the outcome (mp:over on rejoin).
  socket2 = io(`http://localhost:${PORT}`, { transports: ["websocket"], forceNew: true });
  const reOver = await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("no mp:over on rejoin")), 4000);
    socket2.on("mp:over", (o) => { clearTimeout(t); resolve(o); });
    socket2.on("connect", () => socket2.emit("mp:join", { matchTicket: ticket }));
  });
  if (!reOver?.result?.ended) { ok = false; console.error("FAIL: rejoin over payload", JSON.stringify(reOver)); }

  if (ok) console.log("SMOKE OK — match formed, view broadcast, over + status + resume-over verified");
} catch (e) {
  ok = false;
  console.error("FAIL:", e.message);
} finally {
  socket.close();
  if (socket2) socket2.close();
  await handle.close();
  process.exit(ok ? 0 : 1);
}
