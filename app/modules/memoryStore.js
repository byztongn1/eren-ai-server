/**
 * Eren AI Masaüstü Uygulaması — Soyo & Emülatör Entegreli 30 Günlük Kalıcı Hafıza Motoru
 * Her Soyo Kullanıcısı İçin Profil Niteliklerini Kalıcı Depolayan & 30 Günlük Geçmişi Saklayan Önbellek Mimarisi
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
    this.importSoyoDesktopMemory();
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
   * Masaüstündeki SoyoUyg (bot_state.json & shared_reply_memory.json) Geçmişini Otomatik İçe Aktar
   */
  importSoyoDesktopMemory() {
    const desktopSoyoPath = 'C:\\Users\\birxb\\Desktop\\soyouyg123_stabil_foto_fix\\bot_state.json';
    if (!fs.existsSync(desktopSoyoPath)) return;

    try {
      const raw = fs.readFileSync(desktopSoyoPath, 'utf8');
      const stateObj = JSON.parse(raw);
      if (!stateObj.users || !Array.isArray(stateObj.users)) return;

      let importedCount = 0;

      stateObj.users.forEach(u => {
        const userKey = (u.Key || '').trim();
        const val = u.Value;
        if (!userKey || !val) return;

        const pId = 'default_persona';
        const uId = userKey;

        // 1. Profil Niteliklerini Çıkar ve Kaydet
        const facts = [];
        if (val.userStatedCity) facts.push(`Şehir: ${val.userStatedCity}`);
        if (val.userStatedDistricts && val.userStatedDistricts.length > 0) facts.push(`Semt: ${val.userStatedDistricts.join(', ')}`);
        if (val.userAge && val.userAge > 0) facts.push(`Yaş: ${val.userAge}`);
        if (val.userJob) facts.push(`Meslek: ${val.userJob}`);
        if (val.importantFacts && val.importantFacts.length > 0) facts.push(`Notlar: ${val.importantFacts.join('; ')}`);

        if (facts.length > 0) {
          const key = `${pId}_${uId}`;
          const existing = this.data.userSummaries[key] || '';
          const combined = Array.from(new Set([...existing.split(', ').filter(Boolean), ...facts])).join(', ');
          this.data.userSummaries[key] = combined;
        }

        // 2. Geçmiş Sohbet Mesajlarını Aktar
        if (val.history && Array.isArray(val.history)) {
          val.history.forEach(h => {
            const sender = h.side === 'in' ? 'user' : 'assistant';
            const content = (h.text || '').trim();
            if (!content) return;

            const exists = this.data.messages.some(m => m.personaId === pId && m.userId === uId && m.content === content);
            if (!exists) {
              this.data.messages.push({
                id: 'soyo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                personaId: pId,
                userId: uId,
                sender: sender,
                content: content,
                mediaPath: null,
                createdAt: h.ts || new Date().toISOString()
              });
              importedCount++;
            }
          });
        }
      });

      if (importedCount > 0) {
        this.save();
        console.log(`SoyoUyg Masaüstü klasöründen ${importedCount} adet geçmiş diyalog ve kullanıcı hafıza kartları entegre edildi.`);
      }
    } catch (err) {
      console.error('Soyo masaüstü hafıza aktarım hatası:', err.message);
    }
  }

  /**
   * Yeni Mesaj Kaydet ve Otomatik Soyo Kullanıcısı Niteliklerini Çıkar
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
   * Soyo Kullanıcı Cümlelerinden Boy, Yaş, Şehir, Meslek, İlgi Alanı vb. Nitelikleri Çıkar ve Kalıcı Depola
   */
  extractUserFacts(personaId, userId, message) {
    if (!message) return;
    const msgLower = message.toLowerCase().trim();

    const key = `${personaId}_${userId}`;
    let currentFacts = this.data.userSummaries[key] || '';
    const factList = currentFacts ? currentFacts.split(', ') : [];

    // 1. Boy Tespiti
    const heightMatch = msgLower.match(/(1[5-9]\d|200)\s*(cm|m|boy|boyum)?/);
    if (heightMatch && (msgLower.includes('boy') || msgLower.includes('cm') || heightMatch[1].length === 3)) {
      const heightVal = heightMatch[1];
      if (!currentFacts.includes('Boy:')) {
        factList.push(`Boy: ${heightVal} cm`);
      }
    }

    // 2. Yaş Tespiti
    const ageMatch = msgLower.match(/(\d{2})\s*(yaş|yaşında|yaşındayım)/);
    if (ageMatch && !currentFacts.includes('Yaş:')) {
      factList.push(`Yaş: ${ageMatch[1]}`);
    }

    // 3. Şehir/Semt Tespiti
    const cities = ['istanbul', 'ankara', 'izmir', 'bursa', 'antalya', 'adana', 'konya', 'gaziantep', 'kocaeli', 'mersin', 'diyarbakır', 'hatay', 'manisa', 'kayseri', 'samsun', 'balıkesir', 'eskişehir', 'trabzon', 'muğla', 'denizli', 'aydın', 'sakarya', 'tekirdağ', 'beşiktaş', 'kadıköy', 'şişli', 'üsküdar', 'beylikdüzü', 'çankaya'];
    cities.forEach(c => {
      if (msgLower.includes(c) && !currentFacts.includes('Kullanıcı Şehri/Semti:')) {
        factList.push(`Kullanıcı Şehri/Semti: ${c.charAt(0).toUpperCase() + c.slice(1)}`);
      }
    });

    // 4. Meslek Tespiti
    const jobs = ['mühendis', 'yazılımcı', 'doktor', 'öğretmen', 'avukat', 'mimar', 'tamirci', 'esnaf', 'öğrenci', 'asker', 'polis', 'berber', 'kuaför', 'garson', 'aşçı', 'hemşire', 'memur', 'şoför', 'pazarlamacı'];
    jobs.forEach(j => {
      if (msgLower.includes(j) && !currentFacts.includes('Meslek:')) {
        factList.push(`Meslek: ${j.charAt(0).toUpperCase() + j.slice(1)}`);
      }
    });

    // 5. İlgi Alanı / Evcil Hayvan / Medeni Hal Tespiti
    if (msgLower.includes('kedi') && !currentFacts.includes('Kedisi var')) factList.push('Kedisi var');
    if (msgLower.includes('köpek') && !currentFacts.includes('Köpeği var')) factList.push('Köpeği var');
    if (msgLower.includes('araba') || msgLower.includes('arabam')) {
      if (!currentFacts.includes('Arabası var')) factList.push('Arabası var');
    }
    if (msgLower.includes('bekarım') || msgLower.includes('yalnız yaşıyorum')) {
      if (!currentFacts.includes('Medeni Hal: Bekar')) factList.push('Medeni Hal: Bekar');
    }

    if (factList.length > 0) {
      this.data.userSummaries[key] = factList.join(', ');
    }
  }

  /**
   * Bir Soyo Kullanıcısına Ait Tüm Geçmiş Sohbeti Getir
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
   * 30 Günlük Uzun Süreli LLM Bağlamı Getir (Son 30 Mesaj + Soyo Kullanıcı Profil Özeti)
   */
  getOptimizedContext(personaId, userId) {
    const userMsgs = this.data.messages
      .filter(m => (m.personaId === personaId || m.personaId === 'default_persona') && m.userId === userId)
      .slice(-30);

    const key = `${personaId}_${userId}`;
    const defaultKey = `default_persona_${userId}`;
    const summaryFacts = this.data.userSummaries[key] || this.data.userSummaries[defaultKey];

    const history = [];

    if (summaryFacts) {
      history.push({
        role: 'system',
        content: `SOYO KULLANICISI HAKKINDA BİLDİĞİN KALICI BİLGİLER (BUNLARI ASLA UNUTMA VE TEKRAR SORMA): ${summaryFacts}`
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

  /**
   * 30 Günden Eski Ham Mesajları Otomatik Temizle (Kalıcı Profil Özeti Korunur)
   */
  cleanupOldMessages() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const initialCount = this.data.messages.length;
    this.data.messages = this.data.messages.filter(m => m.createdAt >= thirtyDaysAgo);
    this.save();
    console.log(`30 Günlük Hafıza Temizliği: ${initialCount - this.data.messages.length} eski kayıt temizlendi. Profil özetleri korundu.`);
  }
}

module.exports = MemoryStore;
