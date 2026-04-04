const fs = require('fs');
const { createPublicKey } = require('crypto');

const privPath = process.argv[2] || 'chave_privada.pem';
if (!fs.existsSync(privPath)) {
  console.error('Arquivo privado não encontrado:', privPath);
  console.error('Passe o caminho como: node genpub.js c:/caminho/chave_privada.pem');
  process.exit(1);
}

const priv = fs.readFileSync(privPath, 'utf8');
const pub = createPublicKey(priv).export({ type: 'spki', format: 'pem' });
fs.writeFileSync('maikon.pub.pem', pub);
console.log('Chave pública gerada: maikon.pub.pem');
