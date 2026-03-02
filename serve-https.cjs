const https = require('https');
const fs = require('fs');
const path = require('path');

const cert = fs.readFileSync('/tmp/dob-cert.pem');
const key  = fs.readFileSync('/tmp/dob-key.pem');
const dist = path.join(__dirname, 'dist');
const PORT = 5175;

const TYPES = {
  '.html': 'text/html', '.js': 'application/javascript',
  '.css': 'text/css',   '.json': 'application/json',
  '.wasm': 'application/wasm', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.png': 'image/png',
};

https.createServer({ cert, key }, (req, res) => {
  let filePath = path.join(dist, req.url === '/' ? 'index.html' : req.url);
  // SPA fallback
  if (!fs.existsSync(filePath)) filePath = path.join(dist, 'index.html');
  const ext = path.extname(filePath);
  res.setHeader('Content-Type', TYPES[ext] || 'application/octet-stream');
  res.setHeader('Access-Control-Allow-Origin', '*');
  fs.createReadStream(filePath).pipe(res);
}).listen(PORT, '0.0.0.0', () => {
  console.log(`HTTPS DOB Minter → https://192.168.68.80:${PORT}`);
});
