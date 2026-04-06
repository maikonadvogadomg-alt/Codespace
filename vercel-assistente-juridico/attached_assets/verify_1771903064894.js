const fs = require('fs');
const jwt = require('jsonwebtoken');

const pubPath = process.argv[2] || 'maikon.pub.pem';
const token = process.argv[3];

if (!fs.existsSync(pubPath)) {
  console.error('Arquivo de chave pública não encontrado:', pubPath);
  console.error('Gere com: node genpub.js c:/caminho/chave_privada.pem');
  process.exit(1);
}

if (!token) {
  console.error('Passe o token a verificar como 2º argumento: node verify.js maikon.pub.pem <TOKEN>');
  process.exit(1);
}

const pub = fs.readFileSync(pubPath, 'utf8');

jwt.verify(token, pub, { algorithms: ['RS256'] }, (err, decoded) => {
  if (err) {
    console.error('Token inválido:', err.message || err);
    process.exit(1);
  }
  console.log('Decodificado:', decoded);
});
