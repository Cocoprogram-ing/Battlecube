const http = require('http'), fs = require('fs'), path = require('path');
const { WebSocketServer } = require('ws');

const server = http.createServer((req, res) => {
  if (req.url === '/healthz') return res.end('ok');
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(fs.readFileSync(path.join(__dirname, 'public', 'index.html')));
});
const wss = new WebSocketServer({ server });

const worlds = new Map();
let nextId = 1;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const key = (x, y, z) => x + ',' + y + ',' + z;
const send = (ws, o) => ws.readyState === 1 && ws.send(JSON.stringify(o));
const bcast = (w, o, except) => w.players.forEach(p => p !== except && send(p, o));
const pub = p => ({ id: p.id, name: p.name, p: p.p, r: p.r });
const clean = n => String(n || '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 16);
const int = (v, a, b) => Number.isInteger(v) && v >= a && v <= b;

function newWorld() {
  let code;
  do code = Array.from({ length: 5 }, () => ALPHABET[Math.random() * 32 | 0]).join('');
  while (worlds.has(code));
  const w = { code, open: false, host: null, blocks: new Map(), players: new Map() };
  for (let x = 0; x < 20; x++) for (let z = 0; z < 20; z++) w.blocks.set(key(x, 0, z), 3); // 20x20 platform
  worlds.set(code, w);
  return w;
}

wss.on('connection', ws => {
  ws.alive = true;
  ws.on('pong', () => (ws.alive = true));
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    const w = ws.world;

    if (m.t === 'create' || m.t === 'join') {
      if (w) return;
      let world;
      if (m.t === 'create') world = newWorld();
      else {
        world = worlds.get(String(m.code || '').toUpperCase().trim());
        if (!world || !world.open) return send(ws, { t: 'error', msg: 'No open world with that code.' });
        if (world.players.size >= 10) return send(ws, { t: 'error', msg: 'This world is full (10 players).' });
      }
      ws.world = world; ws.id = nextId++;
      ws.name = clean(m.name) || 'Player' + ws.id;
      ws.p = [10 + Math.random() * 4 - 2, 1.01, 10 + Math.random() * 4 - 2]; ws.r = [0, 0];
      if (m.t === 'create') world.host = ws.id;
      send(ws, {
        t: 'joined', id: ws.id, host: world.host === ws.id, code: world.open ? world.code : null, spawn: ws.p,
        blocks: [...world.blocks].map(([k, c]) => k.split(',').map(Number).concat(c)),
        players: [...world.players.values()].map(pub),
      });
      world.players.set(ws.id, ws);
      bcast(world, { t: 'pjoin', p: pub(ws) }, ws);
      bcast(world, { t: 'chat', sys: true, text: ws.name + ' joined' });
      return;
    }
    if (!w) return;

    if (m.t === 'open' && w.host === ws.id) { w.open = true; bcast(w, { t: 'opened', code: w.code }); }
    else if (m.t === 'move' && Array.isArray(m.p) && Array.isArray(m.r) && [...m.p, ...m.r].every(Number.isFinite)) {
      ws.p = m.p.slice(0, 3); ws.r = m.r.slice(0, 2);
    } else if (m.t === 'block' && int(m.x, -40, 60) && int(m.y, 0, 40) && int(m.z, -40, 60) && int(m.c, -1, 9)) {
      const k = key(m.x, m.y, m.z);
      if (m.c < 0) w.blocks.delete(k); else w.blocks.set(k, m.c);
      bcast(w, { t: 'block', x: m.x, y: m.y, z: m.z, c: m.c });
    } else if (m.t === 'chat') {
      const text = String(m.text || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 200);
      if (text) bcast(w, { t: 'chat', name: ws.name, text });
    }
  });
  ws.on('close', () => {
    const w = ws.world; if (!w) return;
    w.players.delete(ws.id);
    if (!w.players.size) return worlds.delete(w.code);
    bcast(w, { t: 'pleave', id: ws.id });
    bcast(w, { t: 'chat', sys: true, text: ws.name + ' left' });
  });
});

setInterval(() => worlds.forEach(w => w.players.size > 1 &&
  bcast(w, { t: 'moves', l: [...w.players.values()].map(p => [p.id, p.p, p.r]) })), 66);
setInterval(() => wss.clients.forEach(c => { if (!c.alive) return c.terminate(); c.alive = false; c.ping(); }), 30000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('BlockWorld running on port ' + PORT));
