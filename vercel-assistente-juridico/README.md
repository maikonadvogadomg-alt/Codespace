# Assistente Juridico - Deploy na Vercel

## Passo a passo

### 1. Banco de dados PostgreSQL (gratis)
1. Va em https://neon.tech e crie uma conta gratuita
2. Crie um novo projeto e copie a DATABASE_URL

### 2. Deploy na Vercel
1. Va em https://vercel.com e faca login com sua conta GitHub
2. Clique em "New Project"
3. Importe o repositorio do GitHub (este projeto)
4. Em "Root Directory", selecione `vercel-assistente-juridico`
5. Configure as variaveis de ambiente:
   - `DATABASE_URL` = a URL do Neon (passo 1)
   - `SESSION_SECRET` = qualquer texto aleatorio (ex: minha-chave-secreta-123)
6. Clique em "Deploy"

### 3. Migrar o banco de dados
Apos o primeiro deploy, abra o terminal do projeto e rode:
```
npx drizzle-kit push
```
Ou configure as tabelas pelo painel do Neon.

## Variaveis de ambiente necessarias
- `DATABASE_URL` - URL do PostgreSQL (obrigatorio)
- `SESSION_SECRET` - Chave para sessoes (obrigatorio)

## Funcionalidades
- Assistente juridico com IA (Gemini/OpenAI)
- Geracao de documentos (peticoes, pareceres)
- Consulta processual (DataJud/PDPJ)
- Auditoria financeira
- Monitoramento de processos
- Robo DJEN (diario eletronico)
- Exportacao Word/PDF
