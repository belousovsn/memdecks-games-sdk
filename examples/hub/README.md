# Example: first-party hub

Runs several `GameModule`s in **one** `mp-runtime` process, routed by the `gameId` in
each match ticket. Use this for games **you** operate so you don't run a node process per
game. Third-party games self-host their own runtime instead (you can't run untrusted code
in your hub).

```ts
createMultiplayerServer({ games: [speedMatchModule, /* ... */] });
```

## Run
```bash
npm run build -w @memdecks/example-hub
MATCH_JWKS_URL=https://test.memdecks.com/.well-known/jwks.json \
TRANSLATOR_API_BASE=https://test.memdecks.com \
CLIENT_ORIGINS=https://play.memdecks.com \
PORT=4700 npm start -w @memdecks/example-hub
```

## Deploy (pm2 + nginx)

One process serves all hub games; nginx terminates TLS and proxies the websocket.

```bash
# on the VPS
cd /var/www/memdecks-hub && npm ci && npm run build -w @memdecks/example-hub
pm2 start "npm run start -w @memdecks/example-hub" --name memdecks-hub --cwd /var/www/memdecks-hub
pm2 save
```

nginx (reuse the `$connection_upgrade` map you already have):
```nginx
server {
    listen 443 ssl;
    server_name play-hub.memdecks.com;     # one origin for all hub games
    # ssl_certificate ... (certbot)

    location /socket.io/ {
        proxy_pass http://127.0.0.1:4700;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
    }
    location /health { proxy_pass http://127.0.0.1:4700; }
}
```

The platform lobby points each hub game's `mpServerUrl` at `https://play-hub.memdecks.com`;
the `gameId` in the ticket selects the module. `GET /health` lists the mounted game ids.

## How it differs from standalone
Same engine — `createMultiplayerServer` takes `games: [...]` instead of `game`. Each
match ticket's `aud` (`game:<id>`) routes to the matching module; rooms are keyed by
`matchId` across all games.
