/**
 * Eren AI Masaüstü Uygulaması — AI Sohbet Motoru
 * Grok-2 (xAI), DeepSeek V3 ve OpenAI API Entegratörü
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

  selectBestProvider(userMessage) {
    const msgLower = (userMessage || '').toLowerCase();
    
    const uncensoredKeywords = ['aşkım', 'bebeğim', 'sevgili', 'öp', 'sarıl', 'foto', 'resim', 'seks', 'gece', 'yatak', 'çıplak', 'tatlım', 'özledin', 'beğen', 'hoşlan', 'güzel', 'seviyorum', 'am', 'yarak', 'sik', 'göt', 'meme', 'yala', 'sakso', 'oral'];
    const isUncensoredTopic = uncensoredKeywords.some(k => msgLower.includes(k));

    if (isUncensoredTopic) {
      if (this.apiKeys.grok) return 'grok';
      if (this.apiKeys.deepseek) return 'deepseek';
    }

    if (this.apiKeys.openai) return 'openai';
    if (this.apiKeys.deepseek) return 'deepseek';
    if (this.apiKeys.grok) return 'grok';

    return 'deepseek';
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
2. SOHBETİN DEVAMLILIĞI VE KARŞILIKLI İLETİŞİM (ÇOK İLERİ DERECEDE ÖNEMLİ): Kullanıcı sana yaşını, ne yaptığını, nereli olduğunu veya kişisel bir soru sorduğunda (Örn: 'kaç yaşındasın', 'naptın', 'nerelisin'), kendi cevabını verdikten sonra KESİNLİKLE "sen kaç yaşındasın", "sen naptın", "sen nerelisin" gibi KARŞI SORU SORARAK sohbeti canlı tut ve akışı sürdür.
3. MESAJ UZUNLUĞU: Gerçek mesajlaşma gibi 45 ila 100 karakter arasında insansı yanıtlar ver.
4. KESİNLİKLE HİÇBİR EMOJİ KULLANMA!
5. KESİNLİKLE HİÇBİR NOKTALAMA İŞARETİ KULLANMA! (Küçük harflerle, doğal konuşur gibi yaz).
6. Fotoğraf istendiğinde yanıtının sonuna "[SEND_PHOTO]" etiketini ekle.${fewShotText}`;
  }

  async generateResponse(requestedProvider, persona, chatHistory, userMessage) {
    this.loadExamples();

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
      } else if (activeProvider === 'openai') {
        return await this.callOpenAI(messages);
      } else {
        return await this.callDeepSeek(messages);
      }
    } catch (error) {
      const detail = error.response?.data ? JSON.stringify(error.response.data) : error.message;
      console.error(`AI Engine (${activeProvider}) Hatası [${detail}], yedek motora geçiliyor...`);

      try {
        if (activeProvider !== 'deepseek' && this.apiKeys.deepseek) return await this.callDeepSeek(messages);
        if (activeProvider !== 'grok' && this.apiKeys.grok) return await this.callGrok(messages);
        if (activeProvider !== 'openai' && this.apiKeys.openai) return await this.callOpenAI(messages);
      } catch (e2) {}
      
      return this.cleanHumanOutput("seninle mi uğraşacağım şimdi rahat bırak");
    }
  }

  async callGrok(messages) {
    const apiKey = this.apiKeys.grok || process.env.GROK_API_KEY;
    if (!apiKey) throw new Error('Grok API Key eksik');

    // Model fallback: grok-2-latest -> grok-2 -> grok-beta
    const models = ['grok-2-latest', 'grok-2', 'grok-beta'];
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
          console.log(`Grok (${modelName}) Status 400 aldı, bir sonraki model deneniyor...`);
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
    cleaned = cleaned.toLowerCase();
    
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

    if (hasPhotoTag) {
      cleaned = cleaned + ' [SEND_PHOTO]';
    }
    return cleaned;
  }
}

module.exports = AIEngine;
