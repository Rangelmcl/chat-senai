// Apaga todas as mensagens gravadas (use entre uma apresentação e outra).
// Na nuvem: defina DATABASE_URL (a "External Database URL" do Render) e rode `npm run limpar`.
const db = require('./db');
(async () => {
  await db.iniciar();
  console.log('Mensagens apagadas:', await db.limpar());
  await db.fechar();
})().catch(e => { console.error(e); process.exit(1); });
