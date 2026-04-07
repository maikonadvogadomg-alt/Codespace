# Assistente Jurídico — Como Rodar no Seu Computador

> Guia passo a passo para rodar o Assistente Jurídico localmente (no VS Code, por exemplo).

---

## Índice

1. [O que você precisa instalar](#o-que-voce-precisa-instalar)
2. [Baixando o projeto](#baixando-o-projeto)
3. [Instalando as dependências](#instalando-as-dependencias)
4. [Configurando o banco de dados](#configurando-o-banco-de-dados)
5. [Criando o arquivo .env](#criando-o-arquivo-env)
6. [Rodando o projeto](#rodando-o-projeto)
7. [Abrindo no navegador](#abrindo-no-navegador)
8. [Instalando no celular (PWA)](#instalando-no-celular)
9. [Glossário (termos técnicos)](#glossario)

---

<a id="o-que-voce-precisa-instalar"></a>
## 1. O que você precisa instalar

### Node.js (obrigatório)
- **O que é:** O "motor" que roda o sistema
- **Onde baixar:** https://nodejs.org
- **Qual versão:** Baixe a versão **LTS** (botão verde grande)
- **Como verificar:** Abra o terminal e digite `node --version`

### PostgreSQL (obrigatório)
- **O que é:** O banco de dados onde o sistema guarda suas informações
- **Onde baixar:** https://www.postgresql.org/download/
- **Alternativa gratuita online:** https://neon.tech (não precisa instalar nada)

### Git (recomendado)
- **O que é:** Programa para baixar código do GitHub
- **Onde baixar:** https://git-scm.com/downloads

---

<a id="baixando-o-projeto"></a>
## 2. Baixando o projeto

### Opção A: Com Git
```
git clone https://github.com/maikonadvogadomg-alt/assistente-juridico.git
cd assistente-juridico
```

### Opção B: Download manual
1. Vá em https://github.com/maikonadvogadomg-alt/assistente-juridico
2. Clique no botão verde "Code" > "Download ZIP"
3. Extraia o ZIP e abra o terminal nessa pasta

---

<a id="instalando-as-dependencias"></a>
## 3. Instalando as dependências

No terminal, dentro da pasta do projeto:
```
npm install
```

Espere terminar (2-5 minutos).

---

<a id="configurando-o-banco-de-dados"></a>
## 4. Configurando o banco de dados

### Opção A: Usando Neon (mais fácil)
1. Vá em https://neon.tech e crie uma conta gratuita
2. Crie um novo projeto
3. Copie a URL de conexão (começa com `postgres://...`)

### Opção B: PostgreSQL local
1. Instale o PostgreSQL
2. Crie um banco:
   ```
   createdb assistente_juridico
   ```
3. A URL será: `postgres://postgres:sua_senha@localhost:5432/assistente_juridico`

---

<a id="criando-o-arquivo-env"></a>
## 5. Criando o arquivo .env

Crie um arquivo chamado `.env` na pasta principal do projeto:

```env
# URL do banco de dados (OBRIGATÓRIO)
DATABASE_URL=postgres://seu_usuario:sua_senha@localhost:5432/assistente_juridico

# Chave secreta para sessões (OBRIGATÓRIO) - pode ser qualquer texto
SESSION_SECRET=minha-chave-secreta-qualquer-123

# Porta do servidor (opcional, padrão é 5000)
PORT=5000
```

### Exemplo com Neon:
```env
DATABASE_URL=postgres://meuuser:minhasenha@ep-cool-lake-123456.us-east-2.aws.neon.tech/assistente?sslmode=require
SESSION_SECRET=chave-super-secreta-do-meu-sistema-2024
PORT=5000
```

**Importante:**
- O `SESSION_SECRET` pode ser qualquer texto. Ele é usado para manter sua sessão de login segura
- Não compartilhe o arquivo `.env` com ninguém

---

<a id="rodando-o-projeto"></a>
## 6. Rodando o projeto

No terminal:
```
npm run dev
```

Vai aparecer:
```
serving on port 5000
```

**Mantenha o terminal aberto** enquanto estiver usando.

---

<a id="abrindo-no-navegador"></a>
## 7. Abrindo no navegador

Abra o navegador e acesse:

```
http://localhost:5000
```

- `localhost` = seu computador
- `5000` = a porta onde o sistema está rodando

Se a porta 5000 estiver ocupada, mude o `PORT` no `.env` e acesse o novo número.

---

<a id="instalando-no-celular"></a>
## 8. Instalando no celular (PWA)

O Assistente Jurídico pode ser instalado como app no celular:

### No Android (Chrome):
1. Abra o site no Chrome
2. Toque nos 3 pontinhos no canto superior direito
3. Toque em "Adicionar à tela inicial"
4. Confirme

### No iPhone (Safari):
1. Abra o site no Safari
2. Toque no botão de compartilhar (o quadrado com seta para cima)
3. Toque em "Adicionar à Tela de Início"
4. Confirme

**Observação:** Para funcionar no celular, o sistema precisa estar rodando em algum lugar (no seu computador ou na Vercel/Neon).

---

<a id="glossario"></a>
## 9. Glossário (termos técnicos)

| Termo | O que significa |
|-------|----------------|
| **Terminal** | Janela onde digita comandos (Prompt de Comando no Windows) |
| **Dependências** | Bibliotecas de código necessárias para funcionar |
| **Porta** | Número que identifica o programa rodando (como número de apartamento) |
| **localhost** | Endereço do seu próprio computador |
| **PostgreSQL** | Banco de dados onde ficam guardadas as informações |
| **API** | Comunicação entre a tela e o servidor |
| **JWT / Token** | Uma "senha temporária" para acessar sistemas do governo |
| **PWA** | Progressive Web App — permite instalar o site como app no celular |
| **.env** | Arquivo com senhas e configurações secretas |
| **Serverless** | Modo de rodar na Vercel — o servidor liga e desliga automaticamente |
| **DataJud** | Base de dados oficial do Poder Judiciário brasileiro |
| **PDPJ** | Plataforma Digital do Poder Judiciário |
| **DJEN** | Diário da Justiça Eletrônico Nacional |
