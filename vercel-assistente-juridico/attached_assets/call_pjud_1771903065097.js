const fs = require('fs');

// Usage: node call_pjud.js --url <API_URL> [--tokenfile pjud_token.txt]
// Requires Node 18+ (global fetch). Reads token from file and calls the URL with Authorization header.

const argv = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) {
    const k = a.slice(2);
    const v = process.argv[i + 1];
    argv[k] = v;
    i++;
  }
}

const url = argv.url || argv.u;
const tokenFile = argv.tokenfile || argv.t || 'pjud_token.txt';
const method = (argv.method || 'GET').toUpperCase();
if (!url) {
  console.error('Use: node call_pjud.js --url <API_URL> [--tokenfile pjud_token.txt]');
  process.exit(1);
}

if (!fs.existsSync(tokenFile)) {
  console.error('Token file not found:', tokenFile);
  process.exit(1);
}

const token = fs.readFileSync(tokenFile, 'utf8').trim();

(async () => {
  try {
    const res = await fetch(url, { method, headers: { Authorization: `Bearer ${token}` } });
    const text = await res.text();
    console.log('Status:', res.status);
    console.log(text);
  } catch (err) {
    console.error('Request failed:', err);
  }
})();
