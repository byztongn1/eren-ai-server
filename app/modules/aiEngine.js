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

  // MODEL YÖNLENDİRİCİ:
  // Cinsel / Flört / Sansürsüz Konular -> GROK (xAI)
  // Genel Sohbet / Normal Mesajlar -> DEEPSEEK (Varsayılan)
  selectBestProvider(userMessage) {
    const msgLower = (userMessage || '').toLowerCase();
    
    const uncensoredKeywords = [
      'aşkım', 'bebeğim', 'sevgili', 'öp', 'sarıl', 'foto', 'resim', 'seks', 'sex', 'gece', 'yatak', 'çıplak', 
      'tatlım', 'özledin', 'beğen', 'hoşlan', 'güzel', 'seviyorum', 'am', 'amıma', 'amcık', 'yarak', 'yarrak', 
      'sik', 'sikiş', 'siker', 'göt', 'götümden', 'meme', 'memelerim', 'yala', 'yalasam', 'sakso', 'oral', 
      'fantezi', 'pozisyon', 'boşal', 'boşalıyorsun', 'posta', 'inle', 'inleyerek', 'bacak omuza', '69', 'kelepçe'
    ];
    
    const isUncensoredTopic = uncensoredKeywords.some(k => msgLower.includes(k));

    const hasGrok = !!(this.apiKeys.grok || process.env.GROK_API_KEY);
    const hasDeepSeek = !!(this.apiKeys.deepseek || process.env.DEEPSEEK_API_KEY);
    const hasOpenAI = !!(this.apiKeys.openai || process.env.OPENAI_API_KEY);

    // Cinsel / Sansürsüz ise Öncelik GROK
    if (isUncensoredTopic) {
      if (hasGrok) return 'grok';
      if (hasDeepSeek) return 'deepseek';
      if (hasOpenAI) return 'openai';
    }

    // Normal Genel Sohbet ise Öncelik DEEPSEEK
    if (hasDeepSeek) return 'deepseek';
    if (hasGrok) return 'grok';
    if (hasOpenAI) return 'openai';

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

    // KULLANICININ YAZDIĞI DİNAMİK LOKASYON/MEMLEKET TESPİTİ
    let myLocation = persona.location || '';
    let myHometown = persona.hometown || '';

    if (!myLocation && userCustomPrompt.includes('Yaşadığı Semt/Şehir:')) {
      const match = userCustomPrompt.match(/Yaşadığı Semt\/Şehir:\s*([^.\n]+)/i);
      if (match) myLocation = match[1].trim();
    }

    if (!myHometown && userCustomPrompt.includes('Memleket')) {
      const match = userCustomPrompt.match(/Memleketi?:\s*([^.\n]+)/i);
      if (match) myHometown = match[1].trim();
    }

    let locationPromptBlock = '';
    if (myLocation || myHometown) {
      const locText = myLocation ? `Sen bizzat "${myLocation}" konumunda yaşıyorsun!` : '';
      const homeText = myHometown ? `Senin kendi memleketin "${myHometown}".` : '';
      locationPromptBlock = `\n=== KİŞİSEL KİMLİK VE İKAMET BİLGİLERİN (BU BİLGİLER BİZZAT SANA AİTTİR) ===
- ${locText} ${homeText}
- KESİNLİKLE DİKKAT ET: Senin bizzat yaşadığın yer "${myLocation || myHometown}"'dır. ASLA başka şehir veya semt uydurma! Kullanıcı nerede oturduğunu söylemediyse ona "Hangi şehirde yaşıyorsun" diye sor.\n`;
    }

    return `Sen ${persona.name} adında ${persona.age || 22} yaşında gerçek bir kadınsın. Asla bot veya yapay zeka olduğunu kabul etme.${locationPromptBlock}

=== KULLANICININ SEÇTİĞİ ÖZEL KARAKTER PROMPTU & TALİMATLARI ===
${userCustomPrompt}

=== GENEL MESAJLAŞMA METODOLOJİSİ ===
1. KULLANICININ YAZDIĞI KARAKTER PROMPTU VE ÖRNEK DİYALOGLAR HER ŞEYDEN ÖNCELİKLİDİR.
2. HAFIZA VE GEÇMİŞ SOHBET KONTROLÜ (ÇOK İLERİ DERECEDE ÖNEMLİ): Sohbet geçmişinde kullanıcının sana daha önce söylediği bilgileri (boyu, yaşı, mesleği, yaşadığı yer vb.) KESİNLİKLE AKILDA TUT! Kullanıcı boyunu veya yaşını söylediyse (Örn: '1.75 boyum' veya '25 yaşındayım'), ASLA VE ASLA AYNISINI SANA SÖYLEDİKTEN SONRA TEKRAR "Boyun kaç?" VEYA "Kaç yaşındasın?" DİYE SORMA! Sorduğu şeyin cevabını geçmiş mesajlarda arayıp hatırla.
3. YAPAY KONU YORUMU VE ANALİZ YAPMAK KESİNLİKLE YASAKTIR: Kullanıcının yanıtları hakkında 'işin zormuş ama güzel', 'Ankara güzelmiş hava nasıl orada' gibi robotik felsefi AI yorumları YAPMA! Doğrudan kısa samimi yanıt ver ve tek bir soru sor.
4. "SEN" VE "BEN" KELİMELERİNİ KULLANMAK KESİNLİKLE YASAKTIR (ÇOK İLERİ DERECEDE ÖNEMLİ): Cümlelerinin ve sorularının hiçbir yerinde "sen", "ben", "senin", "benim" kelimelerini KULLANMA! Türkçe ekli anlatım yapısı kullan (Örn: "Nerelisin sen" KULLANMA! Sadece "Nerelisin" yaz. "Senin boyun kaç" KULLANMA! Sadece "Boyun kaç" yaz. "Ben de iyiyim" KULLANMA! Sadece "İyiyim valla" yaz).
5. 'MERAK ETTİM' VE 'MERAK ETTİM DOĞRUSU' KALIPLARI KESİNLİKLE YASAKTIR: Yanıtlarında "merak ettim", "merak ettim doğrusu", "merak ettim valla" gibi yapay basmakalıp lafları ASLA KULLANMA!
6. MESAJLARI KISA VE NET TUT: Yanıtların KESİNLİKLE KISA VE SERİ olsun! İdeal yanıt uzunluğu 20-55 karakter arasında olsun. Paragraflar ve gereksiz laf kalabalığı yazmak KESİNLİKLE YASAKTIR.
7. CÜMLELERİ EKSİKSİZ TAMAMLA: Yanıtını yarıda kesilmiş cümle veya kelimelerle BIRAKMA! Kısa ama eksiksiz tam bir cümle ve soru kur.
8. DOĞAL TANIŞMA MANTIĞI: Nerede oturduğun sorulursa kendi yaşadığın yeri (${myLocation ? '"' + myLocation + '"' : 'sana tanımlanan şehri'}) söyle. Asla tanımda olmayan rastgele şehirler uydurma!
9. GÜN İSİMLERİ KULLANMAK YASAKTIR: Yanıtlarında "salı günü", "çarşamba günü", "pazartesi" gibi gün isimleri KULLANMA!
10. SÜREKLİ SOHBETİ DEVAM ETTİREN VE KARŞIYI TETİKLEYEN KISA SORULAR SOR: Her yanıtının sonunda KESİNLİKLE o an konuşulan konunun bağlamına uygun, karşı tarafı açacak, kışkırtacak veya sohbeti derinleştirecek TEK BİR KISA SORU SOR! (Kullanıcının daha önce cevapladığı soruları tekrar sorma).
11. TEKRARLAYAN KELİME VE KALIPLAR KESİNLİKLE YASAKTIR: 
    - Cümle sonlarına "anlat bakalım", "anlat bakim" veya "merak mı ediyorsun" gibi basmakalıp lafları KESİNLİKLE EKLENMEYECEKTİR! Bu ifadeler tamamen YASAKTIR.
12. ARD ARDA GELEN ÇOKLU MESAJLARI ANLAMA: Eğer kullanıcı ard arda birden fazla soru veya cümle yazdıysa, tüm bu soruları tek seferde anla ve hepsine TEK BİR BÜTÜNSEL MESAJDA yanıt ver!
13. MESAJIN İLK HARFİ KESİNLİKLE BÜYÜK HARF OLACAK!
14. KESİNLİKLE [no punctuation all lowercase] GİBİ PARANTEZLİ KURAL VEYA SİSTEM NOTLARI YAZMA!
15. Noktalama işaretleri (Nokta, virgül, ünlem vb.) ve emoji kullanma.
16. İLK SELAMLAŞMA VARIYASYONLARI: Kullanıcı 'selam', 'selam tatlım', 'merhaba', 'sa', 'mrb' gibi bir selamlama yazdığında doğal selamlama yap ve hemen karşıyı tetikleyecek soru sor (Örn: 'Selam canım nasılsın naptın bugün', 'Selam tatlım nerelisin', 'Selam naber nasıl gidiyor').
17. Fotoğraf istendiğinde yanıtının sonuna "[SEND_PHOTO]" etiketini ekle.${fewShotText}`;
  }

  async generateResponse(requestedProvider, persona, chatHistory, userMessage) {
    this.loadExamples();

    // Doğal Selamlama Varyasyonları (İlk Harf Büyük)
    const msgClean = (userMessage || '').toLowerCase().replace(/[.,\/#!?$%'\^&\*;:{}=\-_`~()"'’]/g, "").trim();
    const basicGreetings = ['selam', 'merhaba', 'selamlar', 'selam tatlim', 'selam tatlım', 'selam canim', 'selam canım', 'sa', 'mrb', 'hey', 'selammm', 'selamm'];
    
    if (basicGreetings.includes(msgClean)) {
      const naturalGreetingResponses = [
        'Selam canım nasılsın naptın bugün',
        'Selam tatlım nerelisin',
        'Selam naber nasıl gidiyor',
        'Selam napıyorsun naptın bugün'
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
        if (activeProvider !== 'deepseek' && (this.apiKeys.deepseek || process.env.DEEPSEEK_API_KEY)) return await this.callDeepSeek(messages);
        if (activeProvider !== 'grok' && (this.apiKeys.grok || process.env.GROK_API_KEY)) return await this.callGrok(messages);
        if (activeProvider !== 'openai' && (this.apiKeys.openai || process.env.OPENAI_API_KEY)) return await this.callOpenAI(messages);
      } catch (e2) {}
      
      return this.cleanHumanOutput("seninle mi uğraşacağım şimdi rahat bırak");
    }
  }

  async callGrok(messages) {
    const apiKey = this.apiKeys.grok || process.env.GROK_API_KEY;
    if (!apiKey) throw new Error('Grok API Key eksik');

    const models = ['grok-latest', 'grok-4.3', 'grok-4.20-non-reasoning', 'grok-4.20', 'grok-4.5'];
    let lastError = null;

    for (const modelName of models) {
      try {
        const res = await axios.post('https://api.x.ai/v1/chat/completions', {
          model: modelName,
          messages: messages,
          temperature: 0.85,
          max_tokens: 120
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
      temperature: 0.85,
      max_tokens: 120
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
      temperature: 0.85,
      max_tokens: 120
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

    // 1. Sistem notlarını / parantez içi kural metinlerini temizle
    cleaned = cleaned.replace(/\[no punctuation.*?\]/gi, '');
    cleaned = cleaned.replace(/\[all lowercase.*?\]/gi, '');
    cleaned = cleaned.replace(/\[system.*?\]/gi, '');
    cleaned = cleaned.replace(/\[rule.*?\]/gi, '');

    // 2. Emojileri temizle
    cleaned = cleaned.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E6}-\u{1F1FF}]/gu, '');
    
    // 3. Noktalama işaretlerini temizle (Nokta, virgül, ünlem vb.)
    cleaned = cleaned.replace(/[.,\/#!?$%'\^&\*;:{}=\-_`~()"'’]/g, " ").replace(/\s+/g, " ").trim();
    
    // Cümle sonundaki yapay peki, anlat bakalım ve tekrarlayan merak kalıplarını temizle
    cleaned = cleaned.replace(/\s+peki$/gi, '').trim();
    cleaned = cleaned.replace(/anlat bakalim/gi, '').trim();
    cleaned = cleaned.replace(/anlat bakalım/gi, '').trim();
    cleaned = cleaned.replace(/anlat bakim/gi, '').trim();
    cleaned = cleaned.replace(/anlat bakayım/gi, '').trim();
    cleaned = cleaned.replace(/anlat bakayim/gi, '').trim();

    // 'MERAK ETTİM' Kalıplarını Tamamen Temizle
    cleaned = cleaned.replace(/merak ettim doğrusu/gi, '').trim();
    cleaned = cleaned.replace(/merak ettim valla/gi, '').trim();
    cleaned = cleaned.replace(/merak ettim simdi/gi, '').trim();
    cleaned = cleaned.replace(/merak ettim şimdi/gi, '').trim();
    cleaned = cleaned.replace(/merak ettim/gi, '').trim();

    cleaned = cleaned.replace(/sen neden soruyorsun bunu merak mi ediyorsun/gi, '').trim();
    cleaned = cleaned.replace(/sen neden soruyorsun bunu merak mi ediyosun/gi, '').trim();
    cleaned = cleaned.replace(/sen neden soruyorsun bunu/gi, '').trim();
    cleaned = cleaned.replace(/merak mi ediyorsun bunu/gi, '').trim();
    cleaned = cleaned.replace(/merak mi ediyosun bunu/gi, '').trim();
    cleaned = cleaned.replace(/merak mi ediyorsun/gi, '').trim();
    cleaned = cleaned.replace(/merak mi ediyosun/gi, '').trim();
    cleaned = cleaned.replace(/sen de mi merak ediyorsun bunu/gi, '').trim();
    cleaned = cleaned.replace(/sen de mi merak ediyorsun/gi, '').trim();

    // 4. "SEN" ve "BEN" Kelimelerini Temizle (Strict Trailing & Phrase Scrubber)
    cleaned = cleaned.replace(/\b(senin boyun)\b/gi, 'boyun').trim();
    cleaned = cleaned.replace(/\b(senin yaşın)\b/gi, 'yaşın').trim();
    cleaned = cleaned.replace(/\b(sen nerede)\b/gi, 'nerede').trim();
    cleaned = cleaned.replace(/\b(sen ne)\b/gi, 'ne').trim();
    cleaned = cleaned.replace(/\b(sen kaç)\b/gi, 'kaç').trim();
    cleaned = cleaned.replace(/\b(ben de)\b/gi, '').trim();
    cleaned = cleaned.replace(/\s+sen$/gi, '').trim();
    cleaned = cleaned.replace(/\s+ben$/gi, '').trim();
    cleaned = cleaned.replace(/\s+sen\s+/gi, ' ').trim();

    // 5. Gün ismi illüzyonlarını temizle (salı günü, çarşamba günü vb.)
    cleaned = cleaned.replace(/\b(salı|çarşamba|perşembe|cuma|cumartesi|pazar|pazartesi)\s+(günü|günleri)?\b/gi, '').trim();
    cleaned = cleaned.replace(/\s+/g, " ").trim();

    const hasPhotoTag = text.includes('[SEND_PHOTO]');
    if (hasPhotoTag) {
      cleaned = cleaned.replace(/\[send_photo\]/gi, '').trim();
    }

    cleaned = cleaned.trim();

    // MESAJIN İLK HARFİ KESİNLİKLE BÜYÜK HARF
    if (cleaned.length > 0) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }

    if (hasPhotoTag) {
      cleaned = cleaned + ' [SEND_PHOTO]';
    }
    return cleaned;
  }
}

module.exports = AIEngine;
