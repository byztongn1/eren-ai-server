/**
 * Eren AI Masaüstü Uygulaması — Persona & Medya Yöneticisi
 * Dinamik Karakter Tanımları & Özel Klasörden Rastgele Fotoğraf Seçim Motoru
 */

const fs = require('fs');
const path = require('path');

class PersonaManager {
  constructor(dataPath) {
    this.dataPath = dataPath || path.join(__dirname, '../../data/personas.json');
    this.personas = [];
    this.sentPhotosHistory = {}; // personaId -> set of photo file basenames
    this.init();
  }

  init() {
    const dir = path.dirname(this.dataPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(this.dataPath)) {
      try {
        const raw = fs.readFileSync(this.dataPath, 'utf8');
        this.personas = JSON.parse(raw);
      } catch (err) {
        console.error('Personas JSON okunurken hata oluştu, varsayılanlar yüklendi:', err.message);
        this.personas = this.getDefaultPersonas();
        this.save();
      }
    } else {
      this.personas = this.getDefaultPersonas();
      this.save();
    }
  }

  getDefaultPersonas() {
    return [
      {
        id: 'p_1',
        name: 'Selin Yılmaz',
        age: 22,
        gender: 'Kadın',
        provider: 'grok',
        systemPrompt: 'Cilveli, tatlı, hafif nazlı ve samimi genç kız',
        mediaFolderPath: path.join(__dirname, '../../data/photos/selin'),
        outboundEnabled: true,
        outboundIntervalMinutes: 30
      },
      {
        id: 'p_2',
        name: 'Elif Demir',
        age: 23,
        gender: 'Kadın',
        provider: 'deepseek',
        systemPrompt: 'Eğlenceli, cilveli, neşeli genç kız',
        mediaFolderPath: path.join(__dirname, '../../data/photos/mert'),
        outboundEnabled: false,
        outboundIntervalMinutes: 60
      }
    ];
  }

  save() {
    fs.writeFileSync(this.dataPath, JSON.stringify(this.personas, null, 2), 'utf8');
  }

  getPersonas() {
    return this.personas;
  }

  getPersonaById(id) {
    return this.personas.find(p => p.id === id);
  }

  addPersona(personaData) {
    const newPersona = {
      id: 'p_' + Date.now(),
      name: personaData.name || 'Yeni Karakter',
      age: parseInt(personaData.age) || 22,
      gender: personaData.gender || 'Kadın',
      provider: personaData.provider || 'grok',
      systemPrompt: personaData.systemPrompt || 'Cilveli, tatlı genç kız',
      mediaFolderPath: personaData.mediaFolderPath || '',
      outboundEnabled: !!personaData.outboundEnabled,
      outboundIntervalMinutes: parseInt(personaData.outboundIntervalMinutes) || 45
    };

    if (newPersona.mediaFolderPath && !fs.existsSync(newPersona.mediaFolderPath)) {
      try {
        fs.mkdirSync(newPersona.mediaFolderPath, { recursive: true });
      } catch (e) {}
    }

    this.personas.push(newPersona);
    this.save();
    return newPersona;
  }

  updatePersona(id, updatedData) {
    const idx = this.personas.findIndex(p => p.id === id);
    if (idx !== -1) {
      this.personas[idx] = { ...this.personas[idx], ...updatedData };
      this.save();
      return this.personas[idx];
    }
    return null;
  }

  deletePersona(id) {
    this.personas = this.personas.filter(p => p.id !== id);
    this.save();
  }

  /**
   * Karakterin Medya Klasöründen Rastgele Gönderilmemiş Fotoğraf Seçer
   */
  getRandomPhoto(personaId) {
    const persona = this.getPersonaById(personaId);
    if (!persona || !persona.mediaFolderPath || !fs.existsSync(persona.mediaFolderPath)) {
      return null;
    }

    try {
      const files = fs.readdirSync(persona.mediaFolderPath);
      const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
      const imageFiles = files.filter(f => validExtensions.includes(path.extname(f).toLowerCase()));

      if (imageFiles.length === 0) return null;

      if (!this.sentPhotosHistory[personaId]) {
        this.sentPhotosHistory[personaId] = new Set();
      }

      let availablePhotos = imageFiles.filter(f => !this.sentPhotosHistory[personaId].has(f));

      if (availablePhotos.length === 0) {
        this.sentPhotosHistory[personaId].clear();
        availablePhotos = imageFiles;
      }

      const randomIndex = Math.floor(Math.random() * availablePhotos.length);
      const selectedFile = availablePhotos[randomIndex];
      
      this.sentPhotosHistory[personaId].add(selectedFile);

      return path.join(persona.mediaFolderPath, selectedFile);
    } catch (err) {
      console.error(`Klasörden fotoğraf okunurken hata (${personaId}):`, err.message);
      return null;
    }
  }
}

module.exports = PersonaManager;
