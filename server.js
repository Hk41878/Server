// server.js
// Pure Node HTTP server (no external deps)
// Serves a responsive click-counter page and persists count in touchcount.json

const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const DATA_PATH = path.join(__dirname, 'touchcount.json');

// Ensure data file exists
async function ensureDataFile() {
  try {
    await fsp.access(DATA_PATH);
  } catch {
    await fsp.writeFile(DATA_PATH, JSON.stringify({ count: 0 }, null, 2), 'utf8');
  }
}

async function readCount() {
  try {
    const raw = await fsp.readFile(DATA_PATH, 'utf8');
    const obj = JSON.parse(raw || '{}');
    return typeof obj.count === 'number' ? obj.count : 0;
  } catch {
    return 0;
  }
}

async function writeCount(n) {
  await fsp.writeFile(DATA_PATH, JSON.stringify({ count: n }, null, 2), 'utf8');
}

const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Click Counter</title>
<style>
  :root { --maxw: 540px; }
  *{ box-sizing:border-box; }
  body{
    margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    background: radial-gradient(circle at 20% 20%, #f8f9ff, #eef1ff 40%, #e7ecff);
  }
  .card{
    width: min(92vw, var(--maxw));
    background:#fff; border:1px solid #e6e8f0; border-radius:16px;
    box-shadow: 0 10px 30px rgba(16,24,40,.08);
    padding:24px; text-align:center;
  }
  h1{ margin:0 0 8px; font-size:clamp(20px, 4vw, 28px); }
  p.hint{ margin:0 0 16px; color:#475467; font-size:14px; }
  .count{
    font-size: clamp(40px, 12vw, 72px);
    font-weight: 800; line-height:1; margin: 6px 0 16px; color:#0a2e5c;
  }
  button#tap{
    border:0; padding:14px 22px; border-radius:12px; cursor:pointer;
    font-size: clamp(16px, 4vw, 18px); font-weight:700;
    background:#0b5ed7; color:#fff;
    transition: transform .06s ease, box-shadow .2s ease, filter .2s ease;
    width:min(100%, 320px);
    box-shadow: 0 8px 18px rgba(11,94,215,.25);
    touch-action: manipulation;
  }
  button#tap:active{ transform: scale(.98); filter: brightness(.95); }
  .row{ display:flex; gap:10px; justify-content:center; flex-wrap:wrap; }
  .footer{ margin-top:16px; font-size:12px; color:#667085; }
</style>
</head>
<body>
  <main class="card">
    <h1>Click Counter</h1>
    <p class="hint">Button dabao aur total taps badhte dekho. Data server par <code>touchcount.json</code> me save hota hai.</p>
    <div class="count" id="count">—</div>
    <div class="row">
      <button id="tap" aria-label="Increase count">Tap / Click</button>
    </div>
    <div class="footer" id="status"></div>
  </main>

<script>
  async function fetchCount(){
    const r = await fetch('/api/count');
    const j = await r.json();
    return j.count ?? 0;
  }
  async function inc(){
    const r = await fetch('/api/increment', { method:'POST' });
    const j = await r.json();
    return j.count ?? 0;
  }

  const countEl = document.getElementById('count');
  const statusEl = document.getElementById('status');
  const btn = document.getElementById('tap');

  function setStatus(msg){ statusEl.textContent = msg || ''; }

  async function init(){
    try {
      const n = await fetchCount();
      countEl.textContent = n;
      setStatus('Ready.');
    } catch(e){
      countEl.textContent = '?';
      setStatus('Failed to load count.');
    }
  }

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    setStatus('Saving...');
    try{
      const n = await inc();
      countEl.textContent = n;
      setStatus('Saved.');
    }catch(e){
      setStatus('Save failed.');
    }finally{
      btn.disabled = false;
    }
  });

  // Improve mobile 300ms delay behavior
  btn.addEventListener('touchstart', () => {}, {passive: true});

  init();
</script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  const { pathname } = url.parse(req.url, true);

  // CORS headers (not really needed for same-origin, but harmless)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }

  try {
    if (pathname === '/' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(HTML);
    }

    if (pathname === '/api/count' && req.method === 'GET') {
      const n = await readCount();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ count: n }));
    }

    if (pathname === '/api/increment' && req.method === 'POST') {
      const n = (await readCount()) + 1;
      await writeCount(n);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ count: n }));
    }

    // Not found
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  } catch (err) {
    console.error(err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Server error' }));
  }
});

ensureDataFile().then(() => {
  server.listen(PORT, () => {
    console.log('Server running on http://localhost:' + PORT);
  });
});
