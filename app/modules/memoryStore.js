/**
 * Eren AI Masaüstü Uygulaması — Token Tasarruflu Saf JS Hafıza Motoru
 * 30 Günlük Geçmişi Yerel JSON Dosyasında Saklayan Önbellek Mimarisi (C++ Derlemesi Gerektirmez)
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
      } catch (err) {
        this.save();
      }
    } else {
      this.save();
    }
  }

  save() {
    fs.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2), 'utf8');
  }

  /**
   * Yeni Mesaj Kaydet
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
    this.save();
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
   * Token Tasarruflu LLM Bağlamı Getir (Son 6 Mesaj + Özet Hafıza)
   */
  getOptimizedContext(personaId, userId) {
    // 1. İlgili kullanıcının son 6 mesajını getir
    const userMsgs = this.data.messages
      .filter(m => m.personaId === personaId && m.userId === userId)
      .slice(-6);

    // 2. Varsa önceden çıkarılmış özet hafızayı getir
    const key = `${personaId}_${userId}`;
    const summaryFacts = this.data.userSummaries[key];

    const history = [];

    // Özet hafıza varsa LLM'e not olarak ekle
    if (summaryFacts) {
      history.push({
        role: 'user',
        content: `(Geçmiş Bilgi Notu: Müşteri hakkında bildiklerin: ${summaryFacts})`
      });
      history.push({
        role: 'assistant',
        content: 'tamamdir hatirladim akilda tutuyorum'
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

  /**
   * Kullanıcı Nitelik Özetini Güncelle (Token Tasarrufu İçin)
   */
  updateUserSummary(personaId, userId, facts) {
    const key = `${personaId}_${userId}`;
    this.data.userSummaries[key] = facts;
    this.save();
  }

  /**
   * 30 Günden Eski Mesajları Otomatik Temizle (Veritabanı Şişmesini Önle)
   */
  cleanupOldMessages() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const initialCount = this.data.messages.length;
    this.data.messages = this.data.messages.filter(m => m.createdAt >= thirtyDaysAgo);
    this.save();
    console.log(`Eski mesaj temizliği yapıldı: ${initialCount - this.data.messages.length} kayıt silindi.`);
  }
}

module.exports = MemoryStore;
