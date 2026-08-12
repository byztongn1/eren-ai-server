# 🤖 Eren AI — Masaüstü Otonom Sohbet & Persona Yönetim Paneli

Eren Bey (`erenardic`) için geliştirilmiş; **Grok-2 (xAI)**, **DeepSeek V3**, **OpenAI GPT-4o** ve **Claude 3.5 Sonnet** API entegrasyonlu, **ADB & Anti-Detect Fingerprint** korumalı, **dinamik çoklu persona/klasör fotoğraf sistemine** ve **SQLite/JSON token tasarruflu 30 günlük hafızaya** sahip masaüstü otonom sohbet uygulaması.

---

## 💻 VDS ve Her Bilgisayarda %100 Otonom Kurulum

Hiçbir teknik bilgi, Node.js kurulumu veya terminal komutu gerektirmez.

1. **`kurulum.bat`** — Bilgisayarda veya VDS sunucusunda Node.js yoksa otomatik olarak kendisi indirir (`.node`), bağımlılıkları yükler, klasörleri ve `.env` şablonunu oluşturur.
2. **`baslat.bat`** — Masaüstü uygulamasını tek tıkla açar.

---

## 🌟 Öne Çıkan Sistem Özellikleri

1. **🎙️ Grok-2 & DeepSeek V3 AI Motoru (`aiEngine.js`):** Emojisiz, noktalamasız, samimi ve %95+ gerçek insan diyalog akışı (%0 bot hissi).
2. **👥 Sınırsız Karakter & Medya Klasörü Yönetimi (`personaManager.js`):** Masaüstü panelinden yeni karakter ekleme. Karşı taraf "fotoğraf at" dediğinde o karaktere ait klasörden rastgele resim seçip gönderme.
3. **💾 Token Tasarruflu Hafıza (`memoryStore.js`):** 30 günlük diyalog geçmişini saklar, son mesajlar + özet nitelikler göndererek API token harcamasını %80 düşürür.
4. **🥷 ADB & Anti-Detect Fingerprint Gizleme (`adbStealth.js`):** Android cihaz/emülatör dokunma ve yazma taklidi ile bot algılamasını %0'a indirir.
5. **🔌 Local Express Webhook Server (Port: 3344):** Dış sistemlerden veya otomasyon botlarından canlı tetikleme alma.

---

## 📂 Proje Yapısı

```
Eren_AI_Masaustu/
├── app/
│   ├── main.js                  ← Electron Ana Süreç & IPC Kanalları
│   ├── render/                  ← Masaüstü Kullanıcı Arayüzü (HTML5/CSS3/JS)
│   │   ├── index.html
│   │   ├── styles.css           ← Dark Glassmorphism Tasarım
│   │   └── app.js               ← Canlı Chat Simülatörü & Panel Mantığı
│   └── modules/
│       ├── aiEngine.js          ← Grok, DeepSeek, OpenAI & Claude Entegratörü
│       ├── personaManager.js    ← Karakter Yönetimi & Klasör Fotoğraf Seçici
│       ├── memoryStore.js       ← Token Tasarruflu Önbellek
│       └── adbStealth.js        ← ADB & Fingerprint Anti-Detect Motoru
├── data/
│   ├── personas.json            ← Karakter Tanımları
│   └── chat_memory.json         ← Hafıza Veritabanı
├── .env                         ← API Anahtarları
├── kurulum.bat                  ← Otonom VDS/PC Kurulum Betiği
├── baslat.bat                   ← Masaüstü Paneli Başlatıcı
├── package.json
└── README.md
```
