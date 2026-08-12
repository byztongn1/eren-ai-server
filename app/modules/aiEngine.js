/**
 * Eren AI Masaüstü Uygulaması — AI Sohbet Motoru
 * Grok (xAI), DeepSeek V3 ve OpenAI API Entegratörü
 * Status 400 Hata Korumalı & Model Güncelli Mimarisi
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

class AIEngine {
  constructor(configPath, examplesPath) {
    this.configPath = configPath || path.join(__dirname, '../../data/config.json');
    this.examplesPath = examplesPath || path.join(__dirname, '../../data/dialogue_examples.json');
    
    this.apiKeys = {
      grok: process.env.GROK_API_KEY || '',
      deepseek: process.env.DEEPSEEK_API_KEY || '',
      openai: process.env.OPENAI_API_KEY || ''
    };

    this.examples = [];
    this.loadConfig();
    this.loadExamples();
  }

  loadConfig() {
    const dir = path.dirname(this.configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(this.configPath)) {
      try {
        const raw = fs.readFileSync(this.configPath, 'utf8');
        const savedKeys = JSON.parse(raw);
        this.apiKeys = { ...this.apiKeys, ...savedKeys };
      } catch (err) {
        console.error('Config oku hatası:', err.message);
      }
    }
  }

  loadExamples() {
    if (fs.existsSync(this.examplesPath)) {
      try {
        const raw = fs.readFileSync(this.examplesPath, 'utf8');
        this.examples = JSON.parse(raw);
      } catch (err) {
        console.error('Diyalog örnekleri okuma hatası:', err.message);
      }
    }
  }

  saveConfig() {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.apiKeys, null, 2), 'utf8');
    } catch (err) {
      console.error('Config yaz hatası:', err.message);
    }
  }

  setApiKeys(keys) {
    if (keys.grok !== undefined) this.apiKeys.grok = keys.grok;
    if (keys.deepseek !== undefined) this.apiKeys.deepseek = keys.deepseek;
    if (keys.openai !== undefined) this.apiKeys.openai = keys.openai;
    this.saveConfig();
  }

  getApiKeys() {
    return this.apiKeys;
  }

  // ÖNCELİKLİ MODEL YÖNLENDİRİCİ: GROK BİRİNCİ SIRADA (GROK -> DEEPSEEK -> OPENAI)
  selectBestProvider(userMessage) {
    const hasGrok = !!(this.apiKeys.grok || process.env.GROK_API_KEY);
    const hasDeepSeek = !!(this.apiKeys.deepseek || process.env.DEEPSEEK_API_KEY);
    const hasOpenAI = !!(this.apiKeys.openai || process.env.OPENAI_API_KEY);

    if (hasGrok) return 'grok';
    if (hasDeepSeek) return 'deepseek';
    if (hasOpenAI) return 'openai';

    return 'grok';
  }

  getRelevantExamples(userMessage) {
    if (!this.examples || this.examples.length === 0) return [];

    const msgLower = (userMessage || '').toLowerCase();
    const words = msgLower.split(/\s+/).filter(w => w.length > 2);

    const scored = this.examples.map(ex => {
      let score = 0;
      const exUserLower = (ex.user || '').toLowerCase();
      
      if (msgLower.includes(exUserLower) || exUserLower.includes(msgLower)) {
        score += 10;
      }
      
      words.forEach(w => {
        if (exUserLower.includes(w)) score += 3;
      });

      return { example: ex, score };
    });

    scored.sort((a, b) => b.score - a.score);

    const matched = scored.filter(s => s.score > 0).map(s => s.example);
    if (matched.length > 0) {
      return matched.slice(0, 8);
    }
    
    return this.examples.slice(0, 8);
  }

  getSystemPrompt(persona, userMessage) {
    const userCustomPrompt = persona.systemPrompt || 'Samimi, hızlı ve neşeli konuşan arkadaş';
    const dialogueExamples = this.getRelevantExamples(userMessage);

    let fewShotText = '';
    if (dialogueExamples.length > 0) {
      fewShotText = '\n\nKULLANICININ YÜKLEDİĞİ ÖRNEK DİYALOGLAR (BU TARZA VE ÜSLUBA %100 UYACAKSIN):\n';
      dialogueExamples.forEach(ex => {
        fewShotText += `- Kullanıcı: "${ex.user}" -> Sen: "${ex.ai}"\n`;
      });
    }

    return `Sen ${persona.name} adında ${persona.age || 22} yaşında gerçek bir genç kadınsın. Asla bot veya yapay zeka olduğunu kabul etme.

=== KULLANICININ SEÇTİĞİ ÖZEL KARAKTER PROMPTU & TALİMATLARI ===
${userCustomPrompt}

=== GENEL MESAJLAŞMA METODOLOJİSİ ===
1. KULLANICININ YAZDIĞI KARAKTER PROMPTU VE ÖRNEK DİYALOGLAR HER ŞEYDEN ÖNCELİKLİDİR.
2. TEKRARLAYAN MERAK SORULARI KESİNLİKLE YASAKTIR: "sen neden soruyorsun bunu merak mı ediyorsun", "merak mı ediyorsun", "sen de mi merak ediyorsun" gibi kalıpları KESİNLİKLE VE HİÇBİR ZAMAN KULLANMA! Bu cümleler tam anlamıyla YASAKTIR.
3. DOĞAL VE ÇEŞİTLİ SORULAR SOR: Cevap verdikten sonra sohbeti sürdürmek için konusuna uygun doğal sorular sor (Örn: "sen hiç yaptın mı", "sen nasıl seversin", "sen naptın bugün", "sen kaç yaşındasın").
4. MEKAN VE SEMT MANTIĞI: Kullanıcı bir şehir veya semt adı söylediğinde (Örn: 'küçükçekmece', 'kadıköy', 'izmir'), kullanıcının orada yaşadığını idrak et! Asla 'oradaki yerlere sık gidiyor musun' gibi saçma sorular sorma.
5. TEKRARLAYAN 'PEKİ' KELİMESİ YASAKTIR: Cümlelerinin sonuna veya başına yapmacık ve robotik şekilde 'peki' ekleme.
6. ARD ARDA GELEN ÇOKLU MESAJLARI ANLAMA: Eğer kullanıcı ard arda birden fazla soru veya cümle yazdıysa, tüm bu soruları tek seferde anla ve hepsine TEK BİR BÜTÜNSEL MESAJDA yanıt ver!
7. MESAJ UZUNLUĞU: Gerçek mesajlaşma gibi 45 ila 100 karakter arasında insansı yanıtlar ver.
8. KESİNLİKLE HİÇBİR EMOJİ VEYA BÜYÜK HARF KULLANMA! TÜM YAZI TAMAMEN KÜÇÜK HARFLERDEN OLUŞACAK!
9. KESİNLİKLE HİÇBİR NOKTALAMA İŞARETİ KULLANMA! (Nokta, virgül, ünlem vb. kesinlikle yasaktır).
10. İLK SELAMLAŞMA VARIYASYONLARI: Kullanıcı 'selam', 'selam tatlım', 'merhaba', 'sa', 'mrb' gibi bir selamlama yazdığında doğal ve samimi selamlama yap (Örn: 'selam canım nasılsın', 'selam tatlım nerelisin', 'selam napıyorsun nerelisin', 'selam canım naber naptın').
11. Fotoğraf istendiğinde yanıtının sonuna "[SEND_PHOTO]" etiketini ekle.${fewShotText}`;
  }

  async generateResponse(requestedProvider, persona, chatHistory, userMessage) {
    this.loadExamples();

    // Doğal Selamlama Varyasyonları
    const msgClean = (userMessage || '').toLowerCase().replace(/[.,\/#!?$%'\^&\*;:{}=\-_`~()"'’]/g, "").trim();
    const basicGreetings = ['selam', 'merhaba', 'selamlar', 'selam tatlim', 'selam tatlım', 'selam canim', 'selam canım', 'sa', 'mrb', 'hey', 'selammm', 'selamm'];
    
    if (basicGreetings.includes(msgClean)) {
      const naturalGreetingResponses = [
        'selam canım nasılsın',
        'selam tatlım nerelisin',
        'selam napıyorsun nerelisin',
        'selam canım naber naptın'
      ];
      const randomIndex = Math.floor(Math.random() * naturalGreetingResponses.length);
      return naturalGreetingResponses[randomIndex];
    }

    const activeProvider = this.selectBestProvider(userMessage);
    const systemPrompt = this.getSystemPrompt(persona, userMessage);
    const messages = [
      { role: 'system', content: systemPrompt },
      ...chatHistory,
      { role: 'user', content: userMessage }
    ];

    try {
      if (activeProvider === 'grok') {
        return await this.callGrok(messages);
      } else if (activeProvider === 'deepseek') {
        return await this.callDeepSeek(messages);
      } else {
        return await this.callOpenAI(messages);
      }
    } catch (error) {
      const detail = error.response?.data ? JSON.stringify(error.response.data) : error.message;
      console.error(`AI Engine (${activeProvider}) Hatası [${detail}], yedek motora geçiliyor...`);

      try {
        if (activeProvider !== 'grok' && (this.apiKeys.grok || process.env.GROK_API_KEY)) return await this.callGrok(messages);
        if (activeProvider !== 'deepseek' && (this.apiKeys.deepseek || process.env.DEEPSEEK_API_KEY)) return await this.callDeepSeek(messages);
        if (activeProvider !== 'openai' && (this.apiKeys.openai || process.env.OPENAI_API_KEY)) return await this.callOpenAI(messages);
      } catch (e2) {}
      
      return this.cleanHumanOutput("seninle mi uğraşacağım şimdi rahat bırak");
    }
  }

  async callGrok(messages) {
    const apiKey = this.apiKeys.grok || process.env.GROK_API_KEY;
    if (!apiKey) throw new Error('Grok API Key eksik');

    // xAI Güncel Aktif Grok Modelleri
    const models = ['grok-latest', 'grok-4.3', 'grok-4.20-non-reasoning', 'grok-4.20', 'grok-4.5'];
    let lastError = null;

    for (const modelName of models) {
      try {
        const res = await axios.post('https://api.x.ai/v1/chat/completions', {
          model: modelName,
          messages: messages,
          temperature: 0.8,
          max_tokens: 180
        }, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        });

        if (res.data && res.data.choices && res.data.choices[0]) {
          return this.cleanHumanOutput(res.data.choices[0].message.content);
        }
      } catch (err) {
        lastError = err;
        if (err.response && err.response.status === 400) {
          console.log(`Grok (${modelName}) Status 400 aldı, bir sonraki güncel model deneniyor...`);
        } else {
          break;
        }
      }
    }

    throw lastError || new Error('Grok API bağlantısı başarısız oldu');
  }

  async callDeepSeek(messages) {
    const apiKey = this.apiKeys.deepseek || process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error('DeepSeek API Key eksik');

    const res = await axios.post('https://api.deepseek.com/v1/chat/completions', {
      model: 'deepseek-chat',
      messages: messages,
      temperature: 0.8,
      max_tokens: 180
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    return this.cleanHumanOutput(res.data.choices[0].message.content);
  }

  async callOpenAI(messages) {
    const apiKey = this.apiKeys.openai || process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OpenAI API Key eksik');

    const res = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o',
      messages: messages,
      temperature: 0.8,
      max_tokens: 180
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    return this.cleanHumanOutput(res.data.choices[0].message.content);
  }

  cleanHumanOutput(text) {
    if (!text) return '';
    let cleaned = text.trim();
    cleaned = cleaned.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E6}-\u{1F1FF}]/gu, '');
    cleaned = cleaned.replace(/[.,\/#!?$%'\^&\*;:{}=\-_`~()"'’]/g, " ").replace(/\s+/g, " ").trim();
    
    // ZORUNLU %100 KÜÇÜK HARF
    cleaned = cleaned.toLowerCase();

    // Cümle sonundaki yapay peki ve tekrarlayan merak kalıplarını temizle
    cleaned = cleaned.replace(/\s+peki$/gi, '').trim();
    cleaned = cleaned.replace(/sen neden soruyorsun bunu merak mi ediyorsun/gi, '').trim();
    cleaned = cleaned.replace(/sen neden soruyorsun bunu merak mi ediyosun/gi, '').trim();
    cleaned = cleaned.replace(/sen neden soruyorsun bunu/gi, '').trim();
    cleaned = cleaned.replace(/merak mi ediyorsun bunu/gi, '').trim();
    cleaned = cleaned.replace(/merak mi ediyosun bunu/gi, '').trim();
    cleaned = cleaned.replace(/merak mi ediyorsun/gi, '').trim();
    cleaned = cleaned.replace(/merak mi ediyosun/gi, '').trim();
    cleaned = cleaned.replace(/sen de mi merak ediyorsun bunu/gi, '').trim();
    cleaned = cleaned.replace(/sen de mi merak ediyorsun/gi, '').trim();
    cleaned = cleaned.replace(/\s+/g, " ").trim();

    const hasPhotoTag = text.includes('[SEND_PHOTO]');
    if (hasPhotoTag) {
      cleaned = cleaned.replace(/\[send_photo\]/gi, '').trim();
    }

    if (cleaned.length > 100) {
      cleaned = cleaned.substring(0, 100);
      const lastSpace = cleaned.lastIndexOf(' ');
      if (lastSpace > 70) {
        cleaned = cleaned.substring(0, lastSpace);
      }
    }

    // SON KONTROL: GARANTİLİ KÜÇÜK HARF
    cleaned = cleaned.toLowerCase().trim();

    if (hasPhotoTag) {
      cleaned = cleaned + ' [SEND_PHOTO]';
    }
    return cleaned;
  }
}

module.exports = AIEngine;
