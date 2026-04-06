import jwt from 'jsonwebtoken';
import fs from 'fs';

// --- CONFIGURAÇÕES ---
const ARQUIVO_PEM = 'chave_privada.pem';
const SENHA_DA_CHAVE = '123456'; // A senha que você forneceu

// Dados do Advogado (Extraídos do seu arquivo)
const CPF = '09494128648';
const NOME = 'Maikon da Rocha Caldeira';

try {
    // 1. Prepara a chave com a senha para desbloqueio
    // Se a chave for protegida, o sistema usa a 'passphrase' para a ler
    const chavePrivada = {
        key: fs.readFileSync(ARQUIVO_PEM, 'utf8'),
        passphrase: SENHA_DA_CHAVE
    };

    // 2. Define os dados do Token (Payload padrão CNJ/PDPJ)
    const payload = {
        sub: CPF,
        name: NOME,
        iss: 'meu-assinador-local',
        aud: 'pdpj-tribunal',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600 // 1 hora de validade
    };

    // 3. Gera o Token
    const token = jwt.sign(payload, chavePrivada, {
        algorithm: 'RS256',
        header: { typ: 'JWT', alg: 'RS256' }
    });

    console.log('\n✅ SUCESSO! Token Desbloqueado e Gerado:');
    console.log('---------------------------------------------------');
    console.log(token);
    console.log('---------------------------------------------------\n');

} catch (erro) {
    console.error('❌ Erro:', erro.message);
    if (erro.message.includes('passphrase')) {
        console.error('-> A senha parece estar incorreta ou a chave não precisa de senha.');
    }
}


