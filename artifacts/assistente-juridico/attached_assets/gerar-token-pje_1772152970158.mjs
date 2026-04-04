import jwt from 'jsonwebtoken';
import fs from 'fs';

// Função para gerar o token JWT
function generatePJeToken(privateKeyPath, timeoutSeconds) {
  // Obter o timestamp atual em segundos
  const ms = Date.now();
  const currentSeconds = Math.floor(ms / 1000);

  // Payload do token - ajuste conforme os requisitos do tribunal ou sistema
  const payload = {
    iss: 'seu_identificador_ou_emissor', // Issuer: Identificador do emissor (ajuste conforme documentação do tribunal)
    sub: '09494128648', // Subject: CPF extraído do friendlyName da chave fornecida
    iat: currentSeconds, // Issued At: Timestamp de emissão
    exp: currentSeconds + timeoutSeconds, // Expiration: Timestamp de expiração (ex.: 1 hora = 3600 segundos)
    name: 'Maikon da Rocha Caldeira', // Nome do usuário, extraído do friendlyName da chave
    roles: ['advogado'], // Papéis ou permissões (ajuste conforme necessário)
  };

  // Ler a chave privada do arquivo PEM
  const privateKey = fs.readFileSync(privateKeyPath, 'utf8');

  // Assinar o token com o algoritmo RS256
  const token = jwt.sign(payload, privateKey, {
    algorithm: 'RS256', // Algoritmo de assinatura RSA com SHA-256, comum no PJe
    header: {
      alg: 'RS256',
      typ: 'JWT',
    },
  });

  return token;
}

// Configurações
const privateKeyPath = 'chave_privada (2).pem'; // Ajuste para o caminho correto da sua chave privada
const timeoutSeconds = 3600; // Token válido por 1 hora (ajuste conforme necessário)

// Gerar o token
try {
  const token = generatePJeToken(privateKeyPath, timeoutSeconds);
  console.log('Token JWT gerado para PJe/PDPJ:');
  console.log(token);

  // Opcional: Decodificar o token para verificar o conteúdo (sem verificar assinatura)
  const decoded = jwt.decode(token, { complete: true });
  console.log('\nCabeçalho do Token:');
  console.log(JSON.stringify(decoded.header, null, 2));
  console.log('\nPayload do Token:');
  console.log(JSON.stringify(decoded.payload, null, 2));
} catch (error) {
  console.error('Erro ao gerar o token:', error.message);
}
