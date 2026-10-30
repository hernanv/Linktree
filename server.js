const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const LINKS_FILE = path.join(ROOT, 'links.json');
const CLICKS_FILE = path.join(ROOT, 'clicks.log');
const PORT = Number(process.env.PORT || 3000);
const STATS_USER = process.env.STATS_USER || 'admin';
const STATS_PASSWORD = process.env.STATS_PASSWORD || 'change-me';

function readLinks() { return JSON.parse(fs.readFileSync(LINKS_FILE, 'utf8')); }
function send(res, status, body, type = 'text/html; charset=utf-8') {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(body);
}
function safeEqual(a, b) {
  const aa = Buffer.from(a); const bb = Buffer.from(b);
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
function authorized(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) return false;
  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  const split = decoded.indexOf(':');
  return split > -1 && safeEqual(decoded.slice(0, split), STATS_USER) && safeEqual(decoded.slice(split + 1), STATS_PASSWORD);
}
function logClick(slug, req) {
  const line = JSON.stringify({
    at: new Date().toISOString(),
    slug,
    ip: req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || '',
    referrer: req.headers.referer || ''
  }) + '\n';
  try { fs.appendFileSync(CLICKS_FILE, line); } catch (error) { console.error('click log:', error.message); }
}
function statsPage() {
  const links = readLinks().links;
  const counts = Object.fromEntries(links.map(link => [link.slug, 0]));
  if (fs.existsSync(CLICKS_FILE)) {
    for (const line of fs.readFileSync(CLICKS_FILE, 'utf8').split('\n')) {
      if (!line) continue;
      try { const event = JSON.parse(line); if (event.slug in counts) counts[event.slug]++; } catch {}
    }
  }
  const rows = links.map(link => `<tr><td>${escapeHtml(link.title)}</td><td><code>/go/${escapeHtml(link.slug)}</code></td><td class="count">${counts[link.slug]}</td></tr>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Link stats</title><style>body{font:16px system-ui,sans-serif;max-width:760px;margin:48px auto;padding:0 20px;color:#151515}table{width:100%;border-collapse:collapse;margin-top:28px}th,td{text-align:left;border-bottom:1px solid #ddd;padding:14px 8px}.count{font-weight:700;text-align:right}th:last-child{text-align:right}small{color:#666}</style></head><body><h1>Link stats</h1><small>Counts read from clicks.log · ${new Date().toISOString()}</small><table><thead><tr><th>Link</th><th>Redirect</th><th>Clicks</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
}
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname.startsWith('/go/')) {
    const slug = decodeURIComponent(url.pathname.slice(4));
    const link = readLinks().links.find(item => item.slug === slug);
    if (!link || !/^https?:|^mailto:/.test(link.url)) return send(res, 404, 'Link not found', 'text/plain; charset=utf-8');
    logClick(slug, req);
    res.writeHead(302, { location: link.url, 'cache-control': 'no-store' });
    return res.end();
  }
  if (url.pathname === '/stats') {
    if (!authorized(req)) { res.writeHead(401, { 'www-authenticate': 'Basic realm="Link stats"' }); return res.end('Authentication required'); }
    return send(res, 200, statsPage());
  }
  const requested = url.pathname === '/' ? '/index.html' : url.pathname;
  const file = path.normalize(path.join(PUBLIC, requested));
  if (!file.startsWith(PUBLIC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
  const ext = path.extname(file); const types = { '.html':'text/html; charset=utf-8', '.svg':'image/svg+xml', '.json':'application/json', '.ico':'image/x-icon' };
  send(res, 200, fs.readFileSync(file), types[ext] || 'application/octet-stream');
});
server.listen(PORT, () => console.log(`Link-in-bio running at http://localhost:${PORT}`));
