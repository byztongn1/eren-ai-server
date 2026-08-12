/**
 * Eren AI Masaüstü Uygulaması — Electron Ana Süreç
 */

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');

const AIEngine = require('./modules/aiEngine');
const PersonaManager = require('./modules/personaManager');
const MemoryStore = require('./modules/memoryStore');
const ADBStealth = require('./modules/adbStealth');

let mainWindow;
const aiEngine = new AIEngine();
const personaManager = new PersonaManager();
const memoryStore = new MemoryStore();
const adbStealth = new ADBStealth();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 850,
    minWidth: 1000,
    minHeight: 650,
    title: 'Eren AI — Masaüstü Otonom Sohbet & Persona Yönetim Paneli',
    backgroundColor: '#0f172a',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'render/index.html'));
  mainWindow.setMenuBarVisibility(false);
}

// -------------------------------------------------------------
// IPC Dinleyicileri (Masaüstü Arayüz Entegrasyonu)
// -------------------------------------------------------------

// 1. Karakter Listesi Getir
ipcMain.handle('get-personas', () => {
  return personaManager.getPersonas();
});

// 2. Yeni Karakter Ekle
ipcMain.handle('add-persona', (event, personaData) => {
  return personaManager.addPersona(personaData);
});

// 3. Karakter Sil
ipcMain.handle('delete-persona', (event, id) => {
  personaManager.deletePersona(id);
  return { success: true };
});

// 3.2. Prompt Güncelle
ipcMain.handle('update-persona-prompt', (event, { id, systemPrompt }) => {
  const updated = personaManager.updatePersona(id, { systemPrompt });
  return { success: !!updated };
});

// 3.3. Yeni Örnek Diyalog Çifti Ekle (Tekli)
ipcMain.handle('add-dialogue-example', (event, { user, ai }) => {
  const examplesPath = path.join(__dirname, '../data/dialogue_examples.json');
  try {
    let examples = [];
    if (fs.existsSync(examplesPath)) {
      examples = JSON.parse(fs.readFileSync(examplesPath, 'utf8'));
    }
    examples.unshift({ user, ai });
    fs.writeFileSync(examplesPath, JSON.stringify(examples, null, 2), 'utf8');
    aiEngine.loadExamples(); // Canlı yeniden yükle
    return { success: true, total: examples.length };
  } catch (err) {
    console.error('Diyalog ekleme hatası:', err);
    return { success: false, error: err.message };
  }
});

// 3.3.5. Toplu Diyalog Çiftleri İçe Aktar (Bulk Import)
ipcMain.handle('bulk-add-dialogue-examples', (event, items) => {
  const examplesPath = path.join(__dirname, '../data/dialogue_examples.json');
  try {
    let examples = [];
    if (fs.existsSync(examplesPath)) {
      examples = JSON.parse(fs.readFileSync(examplesPath, 'utf8'));
    }
    if (Array.isArray(items) && items.length > 0) {
      examples = [...items, ...examples];
      fs.writeFileSync(examplesPath, JSON.stringify(examples, null, 2), 'utf8');
      aiEngine.loadExamples();
      return { success: true, addedCount: items.length, total: examples.length };
    }
  } catch (err) {
    console.error('Toplu diyalog ekleme hatası:', err);
    return { success: false, error: err.message };
  }
  return { success: false, addedCount: 0 };
});

// 3.4. Tüm Diyalog Örneklerini Getir
ipcMain.handle('get-dialogue-examples', () => {
  const examplesPath = path.join(__dirname, '../data/dialogue_examples.json');
  try {
    if (fs.existsSync(examplesPath)) {
      return JSON.parse(fs.readFileSync(examplesPath, 'utf8'));
    }
  } catch (e) {}
  return [];
});

// 3.5. Diyalog Örneği Sil (Index ile)
ipcMain.handle('delete-dialogue-example-by-index', (event, index) => {
  const examplesPath = path.join(__dirname, '../data/dialogue_examples.json');
  try {
    if (fs.existsSync(examplesPath)) {
      let examples = JSON.parse(fs.readFileSync(examplesPath, 'utf8'));
      if (index >= 0 && index < examples.length) {
        examples.splice(index, 1);
        fs.writeFileSync(examplesPath, JSON.stringify(examples, null, 2), 'utf8');
        aiEngine.loadExamples();
        return { success: true, total: examples.length };
      }
    }
  } catch (e) {}
  return { success: false };
});

// 3.6. Tüm Diyalog Örneklerini Temizle / Sıfırla
ipcMain.handle('clear-all-dialogue-examples', () => {
  const examplesPath = path.join(__dirname, '../data/dialogue_examples.json');
  try {
    fs.writeFileSync(examplesPath, '[]', 'utf8');
    aiEngine.loadExamples();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 3.5. Geçmiş Sohbeti Getir
ipcMain.handle('get-chat-history', (event, { personaId, userId }) => {
  return memoryStore.getFullHistory(personaId, userId);
});

// 4. Klasör Seçim Diyalogu (Fotoğraf Klasörü Bağlama)
ipcMain.handle('select-media-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// 5. Ana Sohbet Mesaj Gönder / Yanıt Al
ipcMain.handle('send-chat-message', async (event, { personaId, userId, message, provider }) => {
  const persona = personaManager.getPersonaById(personaId);
  if (!persona) throw new Error('Karakter bulunamadı');

  const selectedProvider = provider || persona.provider || 'grok';

  // 1. Kullanıcı mesajını yerel SQLite'a yaz
  memoryStore.addMessage(personaId, userId, 'user', message);

  // 2. Token tasarruflu bağlamı getir
  const historyContext = memoryStore.getOptimizedContext(personaId, userId);

  // 3. AI Yanıtı Üret
  let aiReply = await aiEngine.generateResponse(selectedProvider, persona, historyContext, message);

  let attachedPhoto = null;

  // 4. Eğer yanıt [SEND_PHOTO] etiketi içeriyorsa veya mesajda resim istendiyse klasörden rastgele fotoğraf çek
  const isPhotoRequested = message.toLowerCase().includes('foto') ||
                           message.toLowerCase().includes('resim') ||
                           message.toLowerCase().includes('görsel') ||
                           aiReply.includes('[SEND_PHOTO]');

  if (isPhotoRequested) {
    attachedPhoto = personaManager.getRandomPhoto(personaId);
    aiReply = aiReply.replace('[SEND_PHOTO]', '').trim();
  }

  // 5. Asistan yanıtını SQLite'a yaz
  memoryStore.addMessage(personaId, userId, 'assistant', aiReply, attachedPhoto);

  return {
    reply: aiReply,
    attachedPhoto: attachedPhoto,
    personaName: persona.name,
    provider: selectedProvider
  };
});

// 6. ADB Cihazları Listele
ipcMain.handle('get-adb-devices', async () => {
  return await adbStealth.getDevices();
});

// 7. API Anahtarları Güncelle & Kalıcı Kaydet
ipcMain.handle('save-api-keys', (event, keys) => {
  aiEngine.setApiKeys(keys);
  return { success: true };
});

// 7.5. Kayıtlı API Anahtarlarını Getir
ipcMain.handle('get-api-keys', () => {
  return aiEngine.getApiKeys();
});

// -------------------------------------------------------------
// Express Local Webhook & API Server (Port: 3344)
// Dışarıdan veya bot sistemlerinden tetikleme için
// -------------------------------------------------------------
const serverApp = express();
serverApp.use(cors());
serverApp.use(express.json());

serverApp.post('/api/chat', async (req, res) => {
  const { personaId, userId, message, provider } = req.body;
  try {
    const persona = personaManager.getPersonaById(personaId || 'p_1');
    memoryStore.addMessage(persona.id, userId || 'user_1', 'user', message);
    const history = memoryStore.getOptimizedContext(persona.id, userId || 'user_1');
    let reply = await aiEngine.generateResponse(provider || persona.provider, persona, history, message);
    
    let photo = null;
    if (message.toLowerCase().includes('foto') || reply.includes('[SEND_PHOTO]')) {
      photo = personaManager.getRandomPhoto(persona.id);
      reply = reply.replace('[SEND_PHOTO]', '').trim();
    }
    
    memoryStore.addMessage(persona.id, userId || 'user_1', 'assistant', reply, photo);

    res.json({ success: true, reply, photo, persona: persona.name });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const expressServer = serverApp.listen(3344, () => {
  console.log('Eren AI Local Server 3344 portunda dinleniyor...');
});

expressServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log('Express sunucusu zaten 3344 portunda çalışıyor, yeni dinleyici atlandı.');
  } else {
    console.error('Express sunucu hatası:', err.message);
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
