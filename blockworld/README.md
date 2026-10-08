# BlockWorld

Multiplayer 3D block game: Three.js client, Node.js + WebSocket (`ws`) server.

**Play:** create a world → press `Esc` → **Open world** → share the 5-letter code. Friends enter their name + code and click **Join world**.

Controls: WASD, Space (jump), left click break, right click place, `1`–`0` / wheel hotbar, `T` chat, `Esc` menu.

## Run locally
    npm install
    npm start        # http://localhost:3000

## Publish to GitHub
    git init && git add . && git commit -m "BlockWorld"
    git branch -M main
    git remote add origin https://github.com/<you>/blockworld.git
    git push -u origin main

## Deploy on Render
1. render.com → **New + → Web Service** → connect the GitHub repo.
2. Runtime **Node**, Build `npm install`, Start `npm start` (or use **New + → Blueprint**, which reads `render.yaml`).
3. Deploy. Share your `https://<name>.onrender.com` URL. WebSockets work out of the box; the free plan sleeps when idle, so the first load may take ~30 s.
