// Smoke test: drive the speed-match module through mp-runtime end to end.
import { createMultiplayerServer } from "@memdecks/mp-runtime";
import { speedMatchModule } from "./dist/module.js";
import { SignJWT } from "jose";
import { io } from "socket.io-client";

const SECRET = "test-secret";
const PORT = 4601;

const cards = [
  { id: "c1", english: "cat", translations: { hy: { word: "կատու" } } },
  { id: "c2", english: "dog", translations: { hy: { word: "շուն" } } },
  { id: "c3", english: "sun", translations: { hy: { word: "արև" } } },
  { id: "c4", english: "moon", translations: { hy: { word: "լուսին" } } },
];
const wordToId = Object.fromEntries(cards.map((c) => [c.translations.hy.word, c.id]));

const handle = createMultiplayerServer({
  game: speedMatchModule,
  cardProvider: async () => cards,
  env: { port: PORT, matchTicketSecret: SECRET, clientOrigins: ["*"], translatorApiBase: "http://unused" },
});

const ticket = await new SignJWT({
  matchId: "sm1",
  gameId: "speed-match",
  seat: 0,
  players: [{ userId: "u1", name: "A", seat: 0 }],
  settings: { rounds: 2, roundMs: 5000, language: "hy" },
})
  .setProtectedHeader({ alg: "HS256" })
  .setIssuer("memdecks-platform")
  .setAudience("game:speed-match")
  .setSubject("u1")
  .setExpirationTime("5m")
  .sign(new TextEncoder().encode(SECRET));

const socket = io(`http://localhost:${PORT}`, { transports: ["websocket"] });

const result = await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error("timeout")), 8000);
  socket.on("connect", () => socket.emit("mp:join", { matchTicket: ticket }));
  socket.on("mp:error", (e) => { clearTimeout(t); reject(new Error("mp:error: " + e.message)); });
  socket.on("mp:state", (view) => {
    if (view.finished || !view.prompt) return;
    socket.emit("mp:action", { action: "answer", payload: { cardId: wordToId[view.prompt.word] } });
  });
  socket.on("mp:over", ({ result }) => { clearTimeout(t); resolve(result); });
});

let ok = result?.scores?.u1 === 2;
if (!ok) console.error("FAIL: expected score 2, got", JSON.stringify(result));
else console.log("SPEED-MATCH OK — played 2 rounds via runtime, result:", JSON.stringify(result));

socket.close();
await handle.close();
process.exit(ok ? 0 : 1);
