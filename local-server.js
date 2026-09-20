const http = require('http');
const fs = require('fs');
const path = require('path');

const port = Number(process.env.PORT || 4173);
const root = __dirname;
const backend = new URL(process.env.ROAR_BACKEND_URL || 'http://localhost:4000');
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json', '.webp':'image/webp', '.txt':'text/plain; charset=utf-8' };

function proxy(req, res) {
    const target = new URL(req.url, backend);
    const upstream = http.request(target, {
        method: req.method,
        headers: { ...req.headers, host: backend.host },
    }, response => {
        res.writeHead(response.statusCode, response.headers);
        response.pipe(res);
    });
    upstream.on('error', () => {
        res.writeHead(502, { 'content-type':'application/json' });
        res.end(JSON.stringify({ message:'Backend service unavailable.' }));
    });
    req.pipe(upstream);
}

function serve(req, res) {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname); }
    catch { res.writeHead(400); return res.end('Bad request'); }
    if (pathname.startsWith('/api/roar/')) return proxy(req, res);
    if (pathname === '/') pathname = '/index.html';
    const file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        res.writeHead(404, { 'content-type':'text/plain; charset=utf-8' });
        return res.end('Not found');
    }
    res.writeHead(200, {
        'content-type': types[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'x-content-type-options':'nosniff',
        'x-frame-options':'DENY',
        'referrer-policy':'strict-origin-when-cross-origin',
        'cache-control': pathname.endsWith('.html') ? 'no-cache' : 'public, max-age=300',
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
}

http.createServer(serve).listen(port, '127.0.0.1', () => {
    console.log(`Roar East Africa local server: http://127.0.0.1:${port}`);
    console.log(`API proxy: ${backend.origin}/api/roar`);
});
