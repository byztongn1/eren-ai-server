/**
 * Eren AI — 24/7 Railway Server & Web Panel Server
 * Hem Web Arayüzünü Servis Eder Hem de REST API Endpoints Sunar
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const AIEngine = require('./app/modules/aiEngine');
const PersonaManager = require('./app/modules/personaManager');
const MemoryStore = require('./app/modules/memoryStore');
const ADBStealth = require('./app/modules/adbStealth');

const app = express();
const PORT = process.env.PORT || 3344;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Statik Web Arayüzü Dosyaları
app.use(express.static(path.join(__dirname, 'app/render')));
app.use('/data', express.static(path.join(__dirname, 'data')));

const aiEngine = new AIEngine();
const personaManager = new PersonaManager();
const memoryStore = new MemoryStore();
const adbStealth = new ADBStealth();

// -------------------------------------------------------------
// REST API ENDPOINTS (WEB & 24/7 BULUT DEPLOYMENT İÇİN)
// -------------------------------------------------------------

// 1. Ana Sayfa (Web Dashboard)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'app/render/index.html'));
});

// 2. Karakter Listesi
app.get('/api/personas', (req, res) => {
  res.json(personaManager.getPersonas());
});

// 3. Karakter Ekle
app.post('/api/personas', (req, res) => {
  const newP = personaManager.addPersona(req.body);
  res.json(newP);
});

// 4. Karakter Prompt Güncelle
app.post('/api/personas/prompt', (req, res) => {
  const { id, systemPrompt } = req.body;
  const updated = personaManager.updatePersona(id, { systemPrompt });
  res.json({ success: !!updated });
});

// 5. Karakter Sil
app.delete('/api/personas/:id', (req, res) => {
  personaManager.deletePersona(req.params.id);
  res.json({ success: true });
});

// 6. Sohbet Geçmişi
app.get('/api/chat/history', (req, res) => {
  const { personaId, userId } = req.query;
  const history = memoryStore.getFullHistory(personaId, userId || 'user_demo_1');
  res.json(history);
});

// 7. Mesaj Gönder & AI Yanıtı Al
app.post('/api/chat', async (req, res) => {
  try {
    const { personaId, userId, message, provider } = req.body;
    const persona = personaManager.getPersonaById(personaId);
    if (!persona) return res.status(404).json({ error: 'Karakter bulunamadı' });

    const targetUserId = userId || 'user_demo_1';
    const selectedProvider = provider || persona.provider || 'grok';

    memoryStore.addMessage(personaId, targetUserId, 'user', message);
    const historyContext = memoryStore.getOptimizedContext(personaId, targetUserId);

    let aiReply = await aiEngine.generateResponse(selectedProvider, persona, historyContext, message);

    let attachedPhoto = null;
    const isPhotoRequested = message.toLowerCase().includes('foto') ||
                             message.toLowerCase().includes('resim') ||
                             message.toLowerCase().includes('görsel') ||
                             aiReply.includes('[SEND_PHOTO]');

    if (isPhotoRequested) {
      attachedPhoto = personaManager.getRandomPhoto(personaId);
      aiReply = aiReply.replace('[SEND_PHOTO]', '').trim();
    }

    memoryStore.addMessage(personaId, targetUserId, 'assistant', aiReply, attachedPhoto);

    res.json({
      reply: aiReply,
      attachedPhoto,
      personaName: persona.name,
      provider: selectedProvider
    });
  } catch (err) {
    console.error('API Chat Hatası:', err);
    res.status(500).json({ error: err.message });
  }
});

// 8. Diyalog Örneklerini Listele
app.get('/api/dialogues', (req, res) => {
  const examplesPath = path.join(__dirname, 'data/dialogue_examples.json');
  if (fs.existsSync(examplesPath)) {
    try {
      return res.json(JSON.parse(fs.readFileSync(examplesPath, 'utf8')));
    } catch (e) {}
  }
  res.json([]);
});

// 9. Tekli Diyalog Ekle
app.post('/api/dialogues', (req, res) => {
  const { user, ai } = req.body;
  const examplesPath = path.join(__dirname, 'data/dialogue_examples.json');
  let examples = [];
  if (fs.existsSync(examplesPath)) {
    try {
      examples = JSON.parse(fs.readFileSync(examplesPath, 'utf8'));
    } catch (e) {}
  }
  examples.unshift({ user, ai });
  fs.writeFileSync(examplesPath, JSON.stringify(examples, null, 2), 'utf8');
  aiEngine.loadExamples();
  res.json({ success: true, total: examples.length });
});

// 10. Toplu Diyalog İçe Aktar
app.post('/api/dialogues/bulk', (req, res) => {
  const items = req.body;
  const examplesPath = path.join(__dirname, 'data/dialogue_examples.json');
  let examples = [];
  if (fs.existsSync(examplesPath)) {
    try {
      examples = JSON.parse(fs.readFileSync(examplesPath, 'utf8'));
    } catch (e) {}
  }
  if (Array.isArray(items) && items.length > 0) {
    examples = [...items, ...examples];
    fs.writeFileSync(examplesPath, JSON.stringify(examples, null, 2), 'utf8');
    aiEngine.loadExamples();
    return res.json({ success: true, addedCount: items.length, total: examples.length });
  }
  res.json({ success: false, addedCount: 0 });
});

// 11. Diyalog Sil
app.delete('/api/dialogues/:index', (req, res) => {
  const index = parseInt(req.params.index);
  const examplesPath = path.join(__dirname, 'data/dialogue_examples.json');
  if (fs.existsSync(examplesPath)) {
    try {
      let examples = JSON.parse(fs.readFileSync(examplesPath, 'utf8'));
      if (index >= 0 && index < examples.length) {
        examples.splice(index, 1);
        fs.writeFileSync(examplesPath, JSON.stringify(examples, null, 2), 'utf8');
        aiEngine.loadExamples();
        return res.json({ success: true, total: examples.length });
      }
    } catch (e) {}
  }
  res.json({ success: false });
});

// 12. Tüm Diyalogları Sıfırla
app.delete('/api/dialogues', (req, res) => {
  const examplesPath = path.join(__dirname, 'data/dialogue_examples.json');
  fs.writeFileSync(examplesPath, '[]', 'utf8');
  aiEngine.loadExamples();
  res.json({ success: true });
});

// 13. API Keys Getir / Sakla
app.get('/api/keys', (req, res) => {
  res.json(aiEngine.getApiKeys());
});

app.post('/api/keys', (req, res) => {
  aiEngine.setApiKeys(req.body);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`========================================================`);
  console.log(`🚀 Eren AI 24/7 Server Port ${PORT} Üzerinde Aktif!`);
  console.log(`========================================================`);
});
