# MANUAL DE BACKUP - Seus Apps na Vercel

Voce tem 3 repositorios no GitHub com copias dos seus apps:

---

## 1. Codespace (projeto principal - Replit)
Link: https://github.com/maikonadvogadomg-alt/Codespace
- Este e o projeto que roda aqui no Replit
- Contem tudo junto (CodeLens + Assistente Juridico)

## 2. CodeLens (backup independente)
Link: https://github.com/maikonadvogadomg-alt/codelens
- Copia do editor de codigo, pronta para a Vercel
- Funciona sozinha, sem depender do Replit

## 3. Assistente Juridico (backup independente)
Link: https://github.com/maikonadvogadomg-alt/assistente-juridico
- Copia do assistente juridico, pronta para a Vercel
- Funciona sozinha, sem depender do Replit

---

# COMO FAZER O DEPLOY NA VERCEL (passo a passo)

## Passo 1: Criar conta no Neon (banco de dados gratis)
1. Abra o navegador e va em: https://neon.tech
2. Clique em "Sign Up" (criar conta)
3. Pode usar sua conta do Google para entrar
4. Depois de entrar, clique em "Create Project" (criar projeto)
5. De um nome qualquer (ex: "meu-banco")
6. Clique em "Create"
7. Vai aparecer uma URL que comeca com "postgres://..." - COPIE ESSA URL
8. Guarde essa URL, voce vai precisar dela

## Passo 2: Criar conta na Vercel
1. Va em: https://vercel.com
2. Clique em "Sign Up" (criar conta)
3. Escolha "Continue with GitHub" (entrar com GitHub)
4. Autorize o acesso

## Passo 3: Fazer o deploy do app
1. Ja logado na Vercel, clique em "Add New..." > "Project"
2. Vai aparecer a lista dos seus repositorios do GitHub
3. Encontre o repositorio que quer publicar:
   - "codelens" para o editor de codigo
   - "assistente-juridico" para o assistente juridico
4. Clique em "Import"
5. NAO MUDE NADA nas configuracoes, so va para "Environment Variables"
6. Adicione as variaveis:

### Para o CodeLens:
   - Nome: DATABASE_URL | Valor: (a URL do Neon que voce copiou)

### Para o Assistente Juridico:
   - Nome: DATABASE_URL | Valor: (a URL do Neon que voce copiou)
   - Nome: SESSION_SECRET | Valor: qualquer texto (ex: minha-chave-123)

7. Clique em "Deploy"
8. Espere uns 2-3 minutos
9. Pronto! A Vercel vai te dar um link tipo: seuapp.vercel.app

---

# DICAS IMPORTANTES

- Cada app precisa do seu PROPRIO projeto no Neon (banco de dados separado)
- Se quiser usar os dois apps, crie 2 projetos no Neon
- A Vercel e gratis para uso pessoal
- O Neon e gratis ate 500MB de dados
- Seus apps vao funcionar 24h por dia, sem depender do Replit
- Se algo mudar aqui no Replit, seus backups continuam funcionando na Vercel

---

# SE PRECISAR DE AJUDA

- Vercel: https://vercel.com/docs
- Neon: https://neon.tech/docs
- GitHub: https://github.com/maikonadvogadomg-alt
