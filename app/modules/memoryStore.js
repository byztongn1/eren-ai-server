/**
 * Eren AI Masaüstü Uygulaması — Akıllı Uzun Süreli Hafıza Motoru
 * 20 Mesajlık Canlı Bağlam Pencereli & Kullanıcı Nitelik Özeti Saklayan Önbellek Mimarisi
 */

const path = require('path');
const fs = require('fs');

class MemoryStore {
  constructor(dbPath) {
    this.dbPath = dbPath || path.join(__dirname, '../../data/chat_memory.json');
    this.data = {
      messages: [],
      userSummaries: {}
    };
    this.init();
  }

  init() {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(this.dbPath)) {
      try {
        const raw = fs.readFileSync(this.dbPath, 'utf8');
        this.data = JSON.parse(raw);
        if (!this.data.messages) this.data.messages = [];
        if (!this.data.userSummaries) this.data.userSummaries = {};
      } catch (err) {
        this.save();
      }
    } else {
      this.save();
    }
  }

  save() {
    try {
      fs.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (e) {
      console.error('Hafıza kaydetme hatası:', e.message);
    }
  }

  /**
   * Yeni Mesaj Kaydet ve Otomatik Kullanıcı Niteliklerini Çıkar
   */
  addMessage(personaId, userId, sender, content, mediaPath = null) {
    const newMsg = {
      id: Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      personaId,
      userId,
      sender,
      content,
      mediaPath,
      createdAt: new Date().toISOString()
    };

    this.data.messages.push(newMsg);

    if (sender === 'user') {
      this.extractUserFacts(personaId, userId, content);
    }

    this.save();
  }

  /**
   * Kullanıcı Cümlelerinden Boy, Yaş, Şehir, İş vb. Bilgileri Otomatik Çıkar ve Hafızaya İşle
   */
  extractUserFacts(personaId, userId, message) {
    if (!message) return;
    const msgLower = message.toLowerCase().trim();

    const key = `${personaId}_${userId}`;
    let currentFacts = this.data.userSummaries[key] || '';
    const factList = currentFacts ? currentFacts.split(', ') : [];

    // 1. Boy tespiti (Örn: 175, 1.75, 175 cm, boyum 180)
    const heightMatch = msgLower.match(/(1[5-9]\d|200)\s*(cm|m|boy|boyum)?/);
    if (heightMatch && (msgLower.includes('boy') || msgLower.includes('cm') || heightMatch[1].length === 3)) {
      const heightVal = heightMatch[1];
      if (!currentFacts.includes('Boy:')) {
        factList.push(`Boy: ${heightVal} cm`);
      }
    }

    // 2. Yaş tespiti (Örn: 25 yaşındayım, yaş 28)
    const ageMatch = msgLower.match(/(\d{2})\s*(yaş|yaşında|yaşındayım)/);
    if (ageMatch && !currentFacts.includes('Yaş:')) {
      factList.push(`Yaş: ${ageMatch[1]}`);
    }

    // 3. Şehir/Semt tespiti
    const cities = ['istanbul', 'ankara', 'izmir', 'bursa', 'antalya', 'adana', 'konya', 'gaziantep', 'kocaeli', 'mersin', 'diyarbakır', 'hatay', 'manisa', 'kayseri', 'samsun', 'balıkesir', 'eskişehir', 'trabzon', 'muğla', 'denizli', 'aydın', 'sakarya'];
    cities.forEach(c => {
      if (msgLower.includes(c) && !currentFacts.includes('Kullanıcı Şehri:')) {
        factList.push(`Kullanıcı Şehri: ${c.charAt(0).toUpperCase() + c.slice(1)}`);
      }
    });

    if (factList.length > 0) {
      this.data.userSummaries[key] = factList.join(', ');
    }
  }

  /**
   * Bir Karakter ve Kullanıcıya Ait Tüm Geçmiş Sohbeti Getir
   */
  getFullHistory(personaId, userId) {
    return this.data.messages
      .filter(m => m.personaId === personaId && m.userId === userId)
      .map(m => ({
        sender: m.sender,
        content: m.content,
        mediaPath: m.mediaPath,
        createdAt: m.createdAt
      }));
  }

  /**
   * Yüksek Hafızalı LLM Bağlamı Getir (Son 20 Mesaj + Kullanıcı Nitelik Özeti)
   */
  getOptimizedContext(personaId, userId) {
    // Son 20 mesajı getir (Hafıza 6'dan 20'ye çıkarıldı)
    const userMsgs = this.data.messages
      .filter(m => m.personaId === personaId && m.userId === userId)
      .slice(-20);

    const key = `${personaId}_${userId}`;
    const summaryFacts = this.data.userSummaries[key];

    const history = [];

    // Özet hafıza varsa LLM'e bilgi notu olarak ekle
    if (summaryFacts) {
      history.push({
        role: 'system',
        content: `KULLANICI HAKKINDA ÖNCEDEN BİLDİĞİN KİŞİSEL BİLGİLER (BUNLARI ASLA UNUTMA VE TEKRAR SORMA): ${summaryFacts}`
      });
    }

    userMsgs.forEach(m => {
      history.push({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.content
      });
    });

    return history;
  }

  updateUserSummary(personaId, userId, facts) {
    const key = `${personaId}_${userId}`;
    this.data.userSummaries[key] = facts;
    this.save();
  }

  cleanupOldMessages() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const initialCount = this.data.messages.length;
    this.data.messages = this.data.messages.filter(m => m.createdAt >= thirtyDaysAgo);
    this.save();
    console.log(`Eski mesaj temizliği yapıldı: ${initialCount - this.data.messages.length} kayıt silindi.`);
  }
}

module.exports = MemoryStore;
