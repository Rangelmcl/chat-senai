/* Servidor do chat – Mundo SENAI 2026
   Modo "efemero":    repassa as mensagens (broadcast) e não grava nada.
   Modo "persistente": repassa e grava no banco (Postgres na nuvem, SQLite local). */
const express = require('express');
const http = require('http');
const cors = require('cors');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
const db = require('./db');

const PORT = process.env.PORT || 3000;
// Procura a página em public/ e, se não existir, na raiz do projeto.
const pagina = nome => {
  const a = path.join(__dirname, 'public', nome);
  return fs.existsSync(a) ? a : path.join(__dirname, nome);
};
// Palavras bloqueadas (em minúsculas). Lista vazia: definir antes do evento, se desejado.
const BLOQUEADAS = [];

const app = express();
app.set('trust proxy', 1); // necessário atrás do proxy HTTPS da hospedagem
const ORIGEM = process.env.PUBLIC_URL || '*'; // ex.: https://meu-chat.onrender.com
app.use(cors({ origin: ORIGEM }));
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: ORIGEM } });

let modo = 'efemero';
const modoValido = m => m === 'efemero' || m === 'persistente';
const trocarModo = m => { if (modoValido(m)) { modo = m; io.emit('modo', modo); console.log('Modo:', modo); } };

app.get('/mensagens', async (req, res) => {
  try { res.json(await db.listar()); }
  catch (e) { console.error(e); res.status(500).json([]); }
});
function ipLocal() {
  for (const lista of Object.values(os.networkInterfaces()))
    for (const i of lista) if (i.family === 'IPv4' && !i.internal) return i.address;
  return 'localhost';
}
app.get('/', (req, res) => res.sendFile(pagina('apresentacao.html')));
app.get('/config', (req, res) => {
  const base = process.env.PUBLIC_URL
    || (process.env.RENDER_EXTERNAL_URL)
    || (process.env.DATABASE_URL ? `${req.protocol}://${req.get('host')}` : `http://${ipLocal()}:${PORT}`);
  res.json({ mobileUrl: `${base}/mobile` });
});
app.get('/mobile', (req, res) => res.sendFile(pagina('mobile.html')));
app.get('/saude', (req, res) => res.send('ok')); // para testar se o servidor está acordado

// Apaga o histórico gravado. Uso: https://SEU-APP.onrender.com/limpar?senha=SUA_SENHA
// A senha é definida na variável de ambiente LIMPAR_SENHA (sem ela, a rota fica desativada).
app.get('/limpar', async (req, res) => {
  const senha = process.env.LIMPAR_SENHA;
  if (!senha) return res.status(403).send('Rota desativada: a variável LIMPAR_SENHA não está definida no servidor.');
  if (req.query.senha !== senha) return res.status(403).send('Acesso negado');
  console.log('/limpar: apagando mensagens...');
  try {
    const n = await db.limpar();
    console.log('/limpar: apagadas', n);
    res.send('Mensagens apagadas: ' + n + '. Atualize o telão (F5).');
  } catch (e) {
    console.error('/limpar: erro:', e.message);
    res.status(500).send('Erro ao apagar: ' + e.message);
  }
});

io.on('connection', socket => {
  // Só o telão (que informa o modo ao conectar) pode trocar o modo; os celulares não.
  const ehTelao = modoValido(socket.handshake.query.modo);
  if (ehTelao) trocarModo(socket.handshake.query.modo);
  socket.emit('modo', modo);
  socket.on('modo', m => { if (ehTelao) trocarModo(m); });

  let ultimo = 0;
  socket.on('mensagem', async dados => {
    const agora = Date.now();
    if (agora - ultimo < 800) return socket.emit('aviso', 'Aguarde um instante para enviar outra mensagem.');
    const autor = String(dados?.autor ?? '').trim().slice(0, 24) || 'Anônimo';
    const texto = String(dados?.texto ?? '').trim().slice(0, 200);
    if (!texto) return;
    const baixo = (autor + ' ' + texto).toLowerCase();
    if (BLOQUEADAS.some(p => baixo.includes(p))) return socket.emit('aviso', 'Mensagem não permitida.');
    ultimo = agora;
    io.emit('mensagem', { autor, texto });
    if (modo === 'persistente') {
      try { await db.inserir(autor, texto); }
      catch (e) { console.error('Erro ao gravar:', e.message); }
    }
  });
});

db.iniciar().then(() => {
  server.listen(PORT, () => {
    console.log(`Servidor ativo na porta ${PORT} (banco: ${db.tipo})`);
    console.log(`APRESENTAÇÃO (abrir no telão): http://localhost:${PORT}`);
    for (const lista of Object.values(os.networkInterfaces()))
      for (const i of lista) if (i.family === 'IPv4' && !i.internal)
        console.log(`Celulares (mesma rede Wi-Fi): http://${i.address}:${PORT}/mobile`);
  });
}).catch(e => { console.error('Falha ao iniciar o banco:', e); process.exit(1); });
