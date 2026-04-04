const fs = require('fs');
const jwt = require('jsonwebtoken');

const privateKeyPath = process.argv[2] || 'chave_privada.pem';
if (!fs.existsSync(privateKeyPath)) {
  console.error('Arquivo de chave privada não encontrado:', privateKeyPath);
  console.error('Coloque a chave privada (`chave_privada.pem`) na pasta jwt-tools ou passe o caminho: node sign.js c:/caminho/chave_privada.pem');
  process.exit(1);
}

const privateKey = fs.readFileSync(privateKeyPath, 'utf8');

const payload = {
  sub: '09494128648',
  name: 'Maikon da Rocha Caldeira',
  iat: Math.floor(Date.now() / 1000)
};

const token = jwt.sign(payload, privateKey, { algorithm: 'RS256', expiresIn: '1h' });
console.log(token);
