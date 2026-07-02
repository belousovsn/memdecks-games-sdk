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

// A 2-player game that forfeits when an opponent leaves — exercises onPresenceChange.
const duoModule = {
  manifest: {
    id: "duo-presence",
    title: "Duo Presence",
    minPlayers: 2,
    maxPlayers: 2,
    settingsSchema: [],
    requiresCards: { minUsable: 0, perLanguage: false },
  },
  createMatch() {
    return { left: [] };
  },
  applyAction() {},
  onPresenceChange(state, playerId, present) {
    if (!present) state.left.push(playerId);
  },
  viewFor(state) {
    return state;
  },
  isOver(state) {
    return state.left.length ? { outcome: "opponent_left" } : null;
  },
};

// Capture lifecycle pushes instead of POSTing them, to assert launch/result fire.
const lifecycle = [];

const handle = createMultiplayerServer({
  games: [gameModule, duoModule],
  cardProvider: async () => [{ id: "c1", english: "cat", translations: {} }],
  lifecycleReporter: { report: (e) => lifecycle.push(e) },
  env: {
    port: PORT,
    matchTicketSecret: SECRET,
    clientOrigins: ["*"],
    translatorApiBase: "http://unused",
  },
});

// Sign an HS256 match ticket for one player of a duo match.
const duoTicket = (sub) =>
  new SignJWT({
    matchId: "dm1",
    gameId: "duo-presence",
    seat: sub === "d1" ? 0 : 1,
    players: [
      { userId: "d1", name: "D1", seat: 0 },
      { userId: "d2", name: "D2", seat: 1 },
    ],
    settings: {},
    cardToken: "ct-" + sub,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("memdecks-platform")
    .setAudience("game:duo-presence")
    .setSubject(sub)
    .setExpirationTime("5m")
    .sign(new TextEncoder().encode(SECRET));

const ticket = await new SignJWT({
  matchId: "m1",
  gameId: "smoke",
  seat: 0,
  players: [{ userId: "u1", name: "A", seat: 0 }],
  settings: {},
  cardToken: "ct-u1",
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
let dp1, dp2;
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

  // Lifecycle pushes: launch fired on start, result fired on over — each per player,
  // carrying that player's scoped card token (threaded from the ticket).
  const launch = lifecycle.find((e) => e.type === "launch");
  if (!launch || launch.userId !== "u1" || launch.seat !== 0 || launch.cardToken !== "ct-u1") {
    ok = false; console.error("FAIL: launch lifecycle event", JSON.stringify(launch));
  }
  const result = lifecycle.find((e) => e.type === "result");
  if (!result || !result.result?.ended || result.cardToken !== "ct-u1") {
    ok = false; console.error("FAIL: result lifecycle event", JSON.stringify(result));
  }

  // A player reconnecting after the match ended is re-shown the outcome (mp:over on rejoin).
  socket2 = io(`http://localhost:${PORT}`, { transports: ["websocket"], forceNew: true });
  const reOver = await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("no mp:over on rejoin")), 4000);
    socket2.on("mp:over", (o) => { clearTimeout(t); resolve(o); });
    socket2.on("connect", () => socket2.emit("mp:join", { matchTicket: ticket }));
  });
  if (!reOver?.result?.ended) { ok = false; console.error("FAIL: rejoin over payload", JSON.stringify(reOver)); }

  // Presence / opponent-left: a 2-player match starts; when one player drops, the runtime
  // pushes mp:presence to the other AND the game forfeits via onPresenceChange -> isOver.
  const [t1, t2] = await Promise.all([duoTicket("d1"), duoTicket("d2")]);
  dp1 = io(`http://localhost:${PORT}`, { transports: ["websocket"], forceNew: true });
  dp2 = io(`http://localhost:${PORT}`, { transports: ["websocket"], forceNew: true });
  const firstState = (sock, ticketJwt) =>
    new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("no mp:state for duo")), 4000);
      sock.on("mp:error", (e) => { clearTimeout(t); reject(new Error("mp:error: " + e.message)); });
      sock.on("mp:state", (s) => { clearTimeout(t); resolve(s); });
      sock.on("connect", () => sock.emit("mp:join", { matchTicket: ticketJwt }));
    });
  await Promise.all([firstState(dp1, t1), firstState(dp2, t2)]);

  // Watch dp1 for the opponent leaving (presence) and the resulting forfeit (over).
  const presenceP = new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("no mp:presence")), 4000);
    dp1.on("mp:presence", (p) => {
      const d2 = p.players?.find((x) => x.userId === "d2");
      if (d2 && d2.present === false) { clearTimeout(t); resolve(p); }
    });
  });
  const duoOverP = new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("no mp:over after opponent left")), 4000);
    dp1.on("mp:over", (o) => { clearTimeout(t); resolve(o); });
  });
  dp2.close(); // opponent leaves
  await presenceP;
  const duoOver = await duoOverP;
  if (duoOver?.result?.outcome !== "opponent_left") {
    ok = false; console.error("FAIL: opponent-left forfeit", JSON.stringify(duoOver));
  }

  if (ok) console.log("SMOKE OK — match formed, view broadcast, over + status + resume-over + lifecycle push + presence/opponent-left verified");
} catch (e) {
  ok = false;
  console.error("FAIL:", e.message);
} finally {
  socket.close();
  if (socket2) socket2.close();
  if (dp1) dp1.close();
  if (dp2) dp2.close();
  await handle.close();
  process.exit(ok ? 0 : 1);
}
