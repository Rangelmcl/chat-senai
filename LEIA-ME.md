# Chat – Mundo SENAI 2026

## Rodar no seu computador (rede local)
1. Instalar o Node.js 18+ (https://nodejs.org)
2. `npm install`
3. `npm start` e abrir `http://localhost:3000` no telão.
   Sem `DATABASE_URL`, o chat usa SQLite local (chat.db).

## Rodar na nuvem (Render, plano gratuito)
Veja o passo a passo no chat. Resumo:
- Web Service (Node) com Build `npm install` e Start `npm start`
- Banco Render Postgres gratuito, ligado pela variável `DATABASE_URL`
- Variável opcional `PUBLIC_URL` = endereço público (https://seu-app.onrender.com)

## Variáveis de ambiente
- `DATABASE_URL`: liga o modo Postgres (nuvem)
- `PUBLIC_URL`: endereço público (usado no QR Code e no CORS)
- `DB_PATH`: caminho do SQLite (só no modo local)

## Limpar o histórico entre apresentações
`npm run limpar` (na nuvem, defina `DATABASE_URL` com a "External Database URL" antes de rodar).

## Contrato com a apresentação
- Evento `mensagem`: `{ autor, texto }` (enviado pelo celular, repassado a todos).
- Evento `modo`: `"efemero"` ou `"persistente"` (só o telão pode trocar).
- `GET /mensagens`: últimas 50 mensagens gravadas.
- `GET /saude`: responde "ok" (teste de servidor acordado).
- Limites: nome até 24 caracteres, mensagem até 200, intervalo mínimo de 0,8 s por celular.
- Filtro de palavras: lista `BLOQUEADAS` no início do `server.js`.
