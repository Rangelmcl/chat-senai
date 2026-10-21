/* Servidor do chat – Mundo SENAI 2026
   Modo "efemero":    repassa as mensagens (broadcast) e não grava nada.
   Modo "persistente": repassa e grava no banco (Postgres na nuvem, SQLite local). */
const express = require('express');
const http = require('http');
const cors = require('cors');
const os = require('os');
const path = require('path');
const { Server } = require('socket.io');
const db = require('./db');

const PORT = process.env.PORT || 3000;
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
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'apresentacao.html')));
app.get('/config', (req, res) => {
  const base = process.env.PUBLIC_URL
    || (process.env.RENDER_EXTERNAL_URL)
    || (process.env.DATABASE_URL ? `${req.protocol}://${req.get('host')}` : `http://${ipLocal()}:${PORT}`);
  res.json({ mobileUrl: `${base}/mobile` });
});
app.get('/mobile', (req, res) => res.sendFile(path.join(__dirname, 'public', 'mobile.html')));
app.get('/saude', (req, res) => res.send('ok')); // para testar se o servidor está acordado

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
