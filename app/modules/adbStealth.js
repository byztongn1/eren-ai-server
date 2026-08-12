/**
 * Eren AI Masaüstü Uygulaması — ADB & Fingerprint Stealth Motoru
 * Cihaz/Parmak İzi Gizleme & OtonomADB Dokunma/Yazma Otomasyonu
 */

const { exec } = require('child_process');

class ADBStealth {
  constructor() {
    this.connectedDevices = [];
    this.adbPath = 'adb'; // Sistemdeki adb komutu
  }

  /**
   * Bağlı ADB Cihazlarını Listele
   */
  async getDevices() {
    return new Promise((resolve) => {
      exec(`${this.adbPath} devices`, (err, stdout) => {
        if (err) {
          resolve([]);
          return;
        }
        const lines = stdout.split('\n').filter(l => l.trim().length > 0);
        const devices = [];
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split('\t');
          if (parts.length >= 2 && parts[1].trim() === 'device') {
            devices.push(parts[0].trim());
          }
        }
        this.connectedDevices = devices;
        resolve(devices);
      });
    });
  }

  /**
   * İnsansı Rastgele Tuş Gecikmesi ile Metin Yazma (Human Typing Latency)
   */
  async typeHumanText(deviceId, text) {
    const chars = text.split('');
    for (const char of chars) {
      const escapedChar = char.replace(/"/g, '\\"').replace(/'/g, "\\'");
      await this.runAdbCmd(deviceId, `shell input text "${escapedChar}"`);
      // 50-180ms arası rastgele insan yazma gecikmesi
      const delay = Math.floor(Math.random() * 130) + 50;
      await new Promise(r => setTimeout(r, delay));
    }
  }

  /**
   * İnsansı Ekrana Dokunma (Touch Input Simulation)
   */
  async tapScreen(deviceId, x, y) {
    // 5 piksel sapma ile insansı doğal tıklama
    const randomX = x + Math.floor(Math.random() * 10) - 5;
    const randomY = y + Math.floor(Math.random() * 10) - 5;
    return await this.runAdbCmd(deviceId, `shell input tap ${randomX} ${randomY}`);
  }

  /**
   * Fingerprint & Device ID Rastgeleleştirme (Bot Algılamayı Sıfırlama)
   */
  generateStealthFingerprint() {
    const androidVersions = ['11.0', '12.0', '13.0', '14.0'];
    const models = [
      'Samsung Galaxy S22 Ultra',
      'Xiaomi 13 Pro',
      'Google Pixel 7 Pro',
      'OnePlus 11'
    ];

    const randomVersion = androidVersions[Math.floor(Math.random() * androidVersions.length)];
    const randomModel = models[Math.floor(Math.random() * models.length)];
    const randomDeviceId = '86' + Math.floor(10000000000000 + Math.random() * 90000000000000);

    return {
      model: randomModel,
      androidVersion: randomVersion,
      deviceId: randomDeviceId,
      userAgent: `Mozilla/5.0 (Linux; Android ${randomVersion}; ${randomModel}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36`
    };
  }

  runAdbCmd(deviceId, cmd) {
    return new Promise((resolve) => {
      const target = deviceId ? `-s ${deviceId}` : '';
      exec(`${this.adbPath} ${target} ${cmd}`, (err, stdout) => {
        if (err) {
          resolve({ success: false, error: err.message });
        } else {
          resolve({ success: true, output: stdout.trim() });
        }
      });
    });
  }
}

module.exports = ADBStealth;
