# CodeLens — Como Rodar no Seu Computador

> Guia passo a passo para rodar o CodeLens localmente (no VS Code, por exemplo).

---

## Índice

1. [O que você precisa instalar](#o-que-voce-precisa-instalar)
2. [Baixando o projeto](#baixando-o-projeto)
3. [Instalando as dependências](#instalando-as-dependencias)
4. [Configurando o banco de dados](#configurando-o-banco-de-dados)
5. [Criando o arquivo .env](#criando-o-arquivo-env)
6. [Rodando o projeto](#rodando-o-projeto)
7. [Abrindo no navegador](#abrindo-no-navegador)
8. [Glossário (termos técnicos)](#glossario)

---

<a id="o-que-voce-precisa-instalar"></a>
## 1. O que você precisa instalar

Antes de tudo, instale estes programas no seu computador:

### Node.js (obrigatório)
- **O que é:** O "motor" que roda JavaScript fora do navegador
- **Onde baixar:** https://nodejs.org
- **Qual versão:** Baixe a versão **LTS** (a que tem o botão verde grande)
- **Como verificar se já tem:** Abra o terminal/prompt de comando e digite:
  ```
  node --version
  ```
  Se aparecer algo como `v20.10.0`, já está instalado.

### pnpm (obrigatório)
- **O que é:** Um gerenciador de pacotes (instala bibliotecas que o projeto precisa)
- **Como instalar:** Depois de instalar o Node.js, abra o terminal e digite:
  ```
  npm install -g pnpm
  ```
- **Como verificar:** Digite `pnpm --version` no terminal

### PostgreSQL (obrigatório)
- **O que é:** O banco de dados onde o sistema guarda seus projetos e configurações
- **Onde baixar:** https://www.postgresql.org/download/
- **Alternativa online gratuita:** Use o https://neon.tech (não precisa instalar nada)

### Git (recomendado)
- **O que é:** Programa para baixar e controlar versões de código
- **Onde baixar:** https://git-scm.com/downloads
- **Como verificar:** Digite `git --version` no terminal

### VS Code (recomendado)
- **O que é:** Editor de código para o seu computador
- **Onde baixar:** https://code.visualstudio.com

---

<a id="baixando-o-projeto"></a>
## 2. Baixando o projeto

### Opção A: Com Git (recomendado)
Abra o terminal e digite:
```
git clone https://github.com/maikonadvogadomg-alt/codelens.git
cd codelens
```

### Opção B: Sem Git (download manual)
1. Vá em https://github.com/maikonadvogadomg-alt/codelens
2. Clique no botão verde "Code"
3. Clique em "Download ZIP"
4. Extraia o ZIP para uma pasta no seu computador
5. Abra o terminal nessa pasta

---

<a id="instalando-as-dependencias"></a>
## 3. Instalando as dependências

"Dependências" são bibliotecas (código de outras pessoas) que o projeto usa. Sem elas, nada funciona.

No terminal, dentro da pasta do projeto, digite:
```
npm install
```

Espere terminar (pode demorar uns 2-3 minutos). Vai aparecer muita coisa na tela — é normal.

---

<a id="configurando-o-banco-de-dados"></a>
## 4. Configurando o banco de dados

### Opção A: Usando Neon (online, mais fácil)
1. Vá em https://neon.tech e crie uma conta
2. Crie um novo projeto
3. Copie a URL de conexão (começa com `postgres://...`)
4. Use essa URL no passo seguinte

### Opção B: PostgreSQL local (no seu computador)
1. Instale o PostgreSQL
2. Crie um banco de dados chamado `codelens`:
   ```
   createdb codelens
   ```
3. A URL de conexão será algo como:
   ```
   postgres://seu_usuario:sua_senha@localhost:5432/codelens
   ```
   - "seu_usuario" = geralmente é `postgres`
   - "sua_senha" = a senha que você definiu na instalação
   - "5432" = a porta padrão do PostgreSQL
   - "codelens" = o nome do banco que você criou

---

<a id="criando-o-arquivo-env"></a>
## 5. Criando o arquivo .env

O arquivo `.env` guarda informações secretas (senhas, chaves). **Nunca compartilhe este arquivo com ninguém.**

Crie um arquivo chamado `.env` na raiz do projeto (na pasta principal) com o seguinte conteúdo:

```env
# URL do banco de dados PostgreSQL (OBRIGATÓRIO)
# Substitua pela sua URL real do Neon ou do PostgreSQL local
DATABASE_URL=postgres://seu_usuario:sua_senha@localhost:5432/codelens

# Porta onde o servidor vai rodar (opcional, padrão é 3000)
PORT=3000
```

### Exemplo com Neon:
```env
DATABASE_URL=postgres://meuusuario:minhasenha123@ep-cool-lake-123456.us-east-2.aws.neon.tech/codelens?sslmode=require
PORT=3000
```

**Importante:**
- O arquivo se chama `.env` (com o ponto na frente)
- Não coloque espaços antes ou depois do `=`
- Não coloque aspas nos valores

---

<a id="rodando-o-projeto"></a>
## 6. Rodando o projeto

No terminal, digite:
```
npm run dev
```

Vai aparecer algo assim:
```
Server running on port 3000
```

**Mantenha o terminal aberto** — se fechar, o sistema para de funcionar.

---

<a id="abrindo-no-navegador"></a>
## 7. Abrindo no navegador

Abra o seu navegador (Chrome, Firefox, Edge) e acesse:

```
http://localhost:3000
```

**O que é "localhost:3000"?**
- `localhost` = significa "este computador" (você está acessando o servidor que está rodando na sua própria máquina)
- `3000` = é a "porta" (como o número de um apartamento em um prédio). O servidor "mora" na porta 3000

Se a porta 3000 estiver ocupada, mude o `PORT` no arquivo `.env` para outro número (ex: 4000) e acesse `http://localhost:4000`.

---

<a id="glossario"></a>
## 8. Glossário (termos técnicos)

| Termo | O que significa |
|-------|----------------|
| **Terminal** | A janela preta onde você digita comandos (Prompt de Comando no Windows, Terminal no Mac/Linux) |
| **Dependências** | Bibliotecas de código que o projeto precisa para funcionar (como peças de um quebra-cabeça) |
| **Porta** | Um número que identifica qual programa está "ouvindo" no seu computador. É como o número de um apartamento |
| **localhost** | Endereço que significa "este computador". Só funciona na sua máquina |
| **npm / pnpm** | Programas que instalam e gerenciam bibliotecas de JavaScript |
| **Git** | Programa para controlar versões de código e baixar projetos do GitHub |
| **PostgreSQL** | Banco de dados — é onde o sistema guarda seus projetos e configurações de forma permanente |
| **API** | "Interface" de comunicação entre o frontend (tela) e o backend (servidor). Como um telefone entre dois escritórios |
| **Frontend** | A parte visual do sistema — o que você vê e clica no navegador |
| **Backend** | O "motor" do sistema — processa pedidos, salva dados, conversa com a IA |
| **.env** | Arquivo de configuração com senhas e dados secretos. Nunca compartilhe |
| **Build** | Processo de preparar o código para produção (compactar, otimizar) |
| **Deploy** | Colocar o sistema "no ar" para que outras pessoas possam usar pela internet |
