const fs = require('fs');
const jwt = require('jsonwebtoken');

// Simple CLI parsing (no extra deps)
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

const keyPath = argv.key || argv.k || 'C:/Users/Caldeira/chave_privada.pem';
const outFile = argv.out || 'pjud_token.txt';
const iss = argv.iss || 'https://seu-issuer.example';
const aud = argv.aud || 'pjud';
const sub = argv.sub || '09494128648';
const expiresIn = argv.exp || argv.expires || '5m'; // accepts '5m' or seconds

if (!fs.existsSync(keyPath)) {
  console.error('Chave privada não encontrada:', keyPath);
  process.exit(1);
}

const key = fs.readFileSync(keyPath, 'utf8');

const payload = {
  sub: sub,
  name: 'Maikon da Rocha Caldeira',
  iss: iss,
  aud: aud,
  iat: Math.floor(Date.now() / 1000)
};

const token = jwt.sign(payload, key, { algorithm: 'RS256', expiresIn: expiresIn, jwtid: 'pjud-' + Date.now() });
fs.writeFileSync(outFile, token);
console.log(`Token criado e salvo em ${outFile}`);
console.log(token);
