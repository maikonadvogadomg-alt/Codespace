import jwt from 'jsonwebtoken';
import fs from 'fs';

// CONFIGURAÇÃO
const CAMINHO_CHAVE = 'chave_privada.pem'; // O nome exato do seu ficheiro
const MEU_CPF = '09494128648'; // O seu CPF (retirado dos metadados do ficheiro)

try {
    // 1. Ler a chave privada
    const privateKey = fs.readFileSync(CAMINHO_CHAVE, 'utf8');

    // 2. Definir os dados do Token (Payload)
    // Nota: Para a API do Domicílio Eletrónico/PJe, o 'sub' é geralmente o CPF.
    const payload = {
        sub: MEU_CPF,
        name: 'Maikon da Rocha Caldeira',
        iss: 'meu-script-local',  // Emissor
        aud: 'pje-domicilio-eletronico' // Audiência (ajuste se a doc pedir algo específico)
    };

    // 3. Gerar o Token Assinado (Algoritmo RS256)
    const token = jwt.sign(payload, privateKey, {
        algorithm: 'RS256', // Obrigatório para chaves .pem
        expiresIn: '1h'     // O token expira em 1 hora
    });

    console.log('\n✅ SUCESSO! Copie o seu Token abaixo:\n');
    console.log(token);
    console.log('\n---------------------------------------\n');

} catch (erro) {
    console.error('❌ Erro:', erro.message);
    console.error('Verifique se o ficheiro "chave_privada.pem" está na mesma pasta.');
}

