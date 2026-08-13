/**
 * Eren AI Masaüstü & Web Platformu — Kullanıcı Arayüzü Mantığı (Renderer)
 * Universal Hibrit Mimari: Hem Masaüstü (Electron) hem de Web (Railway/Tarayıcı) Uyumlu!
 */

// -------------------------------------------------------------
// UNİVERSAL HİBRİT İLETİŞİM MOTORU (ELECTRON IPC vs WEB REST API)
// -------------------------------------------------------------
const isElectron = typeof window !== 'undefined' && typeof window.require === 'function';
const ipcRenderer = isElectron ? window.require('electron').ipcRenderer : null;

async function apiCall(channel, data = null) {
  if (isElectron && ipcRenderer) {
    return await ipcRenderer.invoke(channel, data);
  }

  // Web Browser / Railway URL REST API Eşleştirmesi
  try {
    if (channel === 'get-personas') {
      const res = await fetch('/api/personas');
      return await res.json();
    }
    if (channel === 'add-persona') {
      const res = await fetch('/api/personas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await res.json();
    }
    if (channel === 'update-persona-prompt') {
      const res = await fetch('/api/personas/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await res.json();
    }
    if (channel === 'delete-persona') {
      const res = await fetch('/api/personas/' + data, { method: 'DELETE' });
      return await res.json();
    }
    if (channel === 'get-chat-history') {
      const res = await fetch(`/api/chat/history?personaId=${data.personaId}&userId=${data.userId}`);
      return await res.json();
    }
    if (channel === 'send-chat-message') {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await res.json();
    }
    if (channel === 'get-dialogue-examples') {
      const res = await fetch('/api/dialogues');
      return await res.json();
    }
    if (channel === 'add-dialogue-example') {
      const res = await fetch('/api/dialogues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await res.json();
    }
    if (channel === 'bulk-add-dialogue-examples') {
      const res = await fetch('/api/dialogues/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await res.json();
    }
    if (channel === 'delete-dialogue-example-by-index') {
      const res = await fetch('/api/dialogues/' + data, { method: 'DELETE' });
      return await res.json();
    }
    if (channel === 'clear-all-dialogue-examples') {
      const res = await fetch('/api/dialogues', { method: 'DELETE' });
      return await res.json();
    }
    if (channel === 'get-api-keys') {
      const res = await fetch('/api/keys');
      return await res.json();
    }
    if (channel === 'save-api-keys') {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await res.json();
    }
    if (channel === 'get-adb-devices') {
      return [];
    }
  } catch (err) {
    console.error('Web REST API Hatası:', err);
    return null;
  }
}

// Global State
let personas = [];
let activePersona = null;
let currentUserId = 'user_demo_1';
let allDialogueExamples = [];
let isSendingMessage = false;

// DOM Elementleri
const personasListEl = document.getElementById('personas-list');
const inputSearchPersona = document.getElementById('input-search-persona');
const activeAvatarEl = document.getElementById('active-avatar');
const activePersonaNameEl = document.getElementById('active-persona-name');
const activePersonaSubEl = document.getElementById('active-persona-subtitle');
const chatMessagesEl = document.getElementById('chat-messages');
const chatInputEl = document.getElementById('input-chat-message');
const btnSendMessage = document.getElementById('btn-send-message');

// Inspector Elementleri
const inspectorNameEl = document.getElementById('inspector-name');
const inspectorAgeGenderEl = document.getElementById('inspector-age-gender');
const inspectorPromptEl = document.getElementById('inspector-prompt');
const inspectorFolderPathEl = document.getElementById('inspector-folder-path');
const btnSaveInspectorPrompt = document.getElementById('btn-save-inspector-prompt');
const btnDeleteActivePersona = document.getElementById('btn-delete-active-persona');
const dialogueCountBadgeEl = document.getElementById('dialogue-count-badge');

// Diyalog Yönetim Modalı Elementleri
const modalDialogueManager = document.getElementById('modal-dialogue-manager');
const btnOpenDialogueManager = document.getElementById('btn-open-dialogue-manager');
const btnCloseDialogueManager = document.getElementById('btn-close-dialogue-manager');
const btnAddDialogueItem = document.getElementById('btn-add-dialogue-item');
const btnClearAllDialogues = document.getElementById('btn-clear-all-dialogues');
const dialogueMgrUser = document.getElementById('dialogue-mgr-user');
const dialogueMgrAi = document.getElementById('dialogue-mgr-ai');
const dialogueMgrSearch = document.getElementById('dialogue-mgr-search');
const dialogueItemsListEl = document.getElementById('dialogue-items-list');
const dialogueListTotalCountEl = document.getElementById('dialogue-list-total-count');

// Toplu Kopyala Yapıştır Sekme Elementleri
const tabBtnSingle = document.getElementById('tab-btn-single');
const tabBtnBulk = document.getElementById('tab-btn-bulk');
const tabContentSingle = document.getElementById('tab-content-single');
const tabContentBulk = document.getElementById('tab-content-bulk');
const bulkDialogueTextarea = document.getElementById('bulk-dialogue-textarea');
const btnBulkImportDialogues = document.getElementById('btn-bulk-import-dialogues');

// Modal Elementleri
const modalAddPersona = document.getElementById('modal-add-persona');
const btnOpenAddPersona = document.getElementById('btn-open-add-persona');
const btnCancelAdd = document.getElementById('btn-cancel-add');
const btnSavePersona = document.getElementById('btn-save-persona');
const btnBrowseFolder = document.getElementById('btn-browse-folder');
const newFolderPathInput = document.getElementById('new-folder-path');

// Prompt Modal Elementleri
const modalPromptEditor = document.getElementById('modal-prompt-editor');
const btnOpenPromptModal = document.getElementById('btn-open-prompt-modal');
const btnCancelPromptModal = document.getElementById('btn-cancel-prompt-modal');
const btnSavePromptModal = document.getElementById('btn-save-prompt-modal');
const promptModalPersonaName = document.getElementById('prompt-modal-persona-name');
const promptModalText = document.getElementById('prompt-modal-text');

const modalApiKeys = document.getElementById('modal-api-keys');
const btnOpenApiModal = document.getElementById('btn-open-api-modal');
const btnCloseApiModal = document.getElementById('btn-close-api-modal');
const btnRefreshAdb = document.getElementById('btn-refresh-adb');
const adbStatusEl = document.getElementById('adb-status');

// State
let selectedGender = 'Kadın';
let selectedAge = 22;

// -------------------------------------------------------------
// SAYFA YÜKLENME VE BAŞLANGIÇ
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  await loadPersonas();
  await loadDialogueExamplesCount();
  setupEventListeners();
  setupCorporatePillsAndTags();
  checkAdbDevices();
  
  if (chatInputEl) {
    chatInputEl.focus();
  }
});

async function loadPersonas() {
  personas = await apiCall('get-personas');
  renderPersonasList();
  if (personas && personas.length > 0) {
    if (!activePersona || !personas.find(p => p.id === activePersona.id)) {
      await setActivePersona(personas[0]);
    }
  } else {
    activePersona = null;
    inspectorNameEl.value = '';
    inspectorAgeGenderEl.value = '';
    inspectorPromptEl.value = '';
    inspectorFolderPathEl.value = '';
    activePersonaNameEl.innerText = 'Karakter Bulunamadı';
    chatMessagesEl.innerHTML = `<div class="system-message">Lütfen sol üstteki (+) butonundan yeni bir karakter ekleyin.</div>`;
  }
}

async function loadDialogueExamplesCount() {
  try {
    allDialogueExamples = await apiCall('get-dialogue-examples');
    if (dialogueCountBadgeEl) {
      dialogueCountBadgeEl.innerText = `${(allDialogueExamples || []).length} Örnek Kayıtlı`;
    }
  } catch (e) {}
}

// DİYALOG ÖRNEKLERİ LİSTELEME VE ARAMA
function renderDialogueItemsList(filterQuery = '') {
  dialogueItemsListEl.innerHTML = '';
  const query = filterQuery.toLowerCase().trim();

  const filtered = (allDialogueExamples || []).map((ex, index) => ({ ex, originalIndex: index }))
    .filter(item => 
      item.ex.user.toLowerCase().includes(query) ||
      item.ex.ai.toLowerCase().includes(query)
    );

  dialogueListTotalCountEl.innerText = `${filtered.length} / ${(allDialogueExamples || []).length} Kayıt`;

  if (filtered.length === 0) {
    dialogueItemsListEl.innerHTML = `<div style="font-size:12px; color:#94a3b8; text-align:center; padding:10px;">Diyalog bulunamadı</div>`;
    return;
  }

  filtered.forEach(item => {
    const el = document.createElement('div');
    el.style.cssText = 'background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); padding:8px 12px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; font-size:12px;';

    el.innerHTML = `
      <div style="flex:1; display:flex; flex-direction:column; gap:2px; overflow:hidden;">
        <div style="color:#c084fc; font-weight:600; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">👤 Soru: "${escapeHtml(item.ex.user)}"</div>
        <div style="color:#38bdf8; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">🤖 Yanıt: "${escapeHtml(item.ex.ai)}"</div>
      </div>
      <button class="btn-secondary" style="color:#ef4444; border-color:rgba(239,68,68,0.3); padding:4px 8px; font-size:11px; margin-left:10px;" onclick="deleteDialogueItem(${item.originalIndex})">🗑️ Sil</button>
    `;

    dialogueItemsListEl.appendChild(el);
  });
}

window.deleteDialogueItem = async function(index) {
  const res = await apiCall('delete-dialogue-example-by-index', index);
  if (res && res.success) {
    await loadDialogueExamplesCount();
    renderDialogueItemsList(dialogueMgrSearch.value);
  }
};

dialogueMgrSearch.addEventListener('input', (e) => {
  renderDialogueItemsList(e.target.value);
});

// KARAKTER ARAMA VE LİSTELEME
function renderPersonasList(filterQuery = '') {
  personasListEl.innerHTML = '';
  const query = filterQuery.toLowerCase().trim();

  const filtered = (personas || []).filter(p => 
    p.name.toLowerCase().includes(query) ||
    p.gender.toLowerCase().includes(query)
  );

  if (filtered.length === 0) {
    personasListEl.innerHTML = `<div style="font-size:12px; color:#94a3b8; text-align:center; padding:10px;">Karakter bulunamadı</div>`;
    return;
  }

  filtered.forEach(p => {
    const item = document.createElement('div');
    item.className = `persona-item ${activePersona && activePersona.id === p.id ? 'active' : ''}`;
    item.onclick = async () => await setActivePersona(p);

    item.innerHTML = `
      <div class="avatar">${p.name.charAt(0)}</div>
      <div class="persona-info">
        <div class="persona-name">${escapeHtml(p.name)}</div>
        <div class="persona-meta">Otomatik Router • ${p.gender}, ${p.age}</div>
      </div>
    `;

    personasListEl.appendChild(item);
  });
}

inputSearchPersona.addEventListener('input', (e) => {
  renderPersonasList(e.target.value);
});

// AKTİF KARAKTER DEĞİŞTİRME & PROMPT YÜKLEME
async function setActivePersona(persona) {
  if (!persona) return;
  activePersona = persona;
  renderPersonasList(inputSearchPersona.value);

  activeAvatarEl.innerText = persona.name.charAt(0);
  activePersonaNameEl.innerText = persona.name;
  activePersonaSubEl.innerText = `Otomatik Akıllı Model Yönlendirici (Grok / DeepSeek / OpenAI)`;

  inspectorNameEl.value = persona.name;
  inspectorAgeGenderEl.value = `${persona.age} Yaş, ${persona.gender}`;
  inspectorPromptEl.value = persona.systemPrompt || '';
  inspectorFolderPathEl.value = persona.mediaFolderPath || 'Klasör Seçilmedi';

  chatMessagesEl.innerHTML = `
    <div class="system-message">
      💡 ${escapeHtml(persona.name)} ile sohbet. Geçmiş konuşmalarınız korunuyor.
    </div>
  `;

  try {
    const history = await apiCall('get-chat-history', {
      personaId: persona.id,
      userId: currentUserId
    });

    if (history && history.length > 0) {
      history.forEach(m => {
        appendMessage(m.sender, m.content, m.mediaPath);
      });
    }
  } catch (err) {
    console.error('Geçmiş yükleme hatası:', err);
  }

  if (chatInputEl) {
    chatInputEl.focus();
  }
}

// -------------------------------------------------------------
// SOHBET İŞLEMLERİ
// -------------------------------------------------------------
if (btnSendMessage) {
  btnSendMessage.addEventListener('click', handleSendMessage);
}

if (chatInputEl) {
  chatInputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });
}

async function handleSendMessage() {
  if (isSendingMessage) return;

  const text = chatInputEl.value.trim();
  if (!text) return;
  
  if (!activePersona) {
    if (personas && personas.length > 0) {
      await setActivePersona(personas[0]);
    } else {
      alert('Lütfen önce bir karakter seçin.');
      return;
    }
  }

  isSendingMessage = true;
  chatInputEl.value = '';
  appendMessage('user', text);

  const typingIndicatorId = 'typing-' + Date.now();
  appendTypingIndicator(typingIndicatorId);

  try {
    const response = await apiCall('send-chat-message', {
      personaId: activePersona.id,
      userId: currentUserId,
      message: text,
      provider: 'auto'
    });

    removeTypingIndicator(typingIndicatorId);
    if (response && response.reply) {
      appendMessage('assistant', response.reply, response.attachedPhoto);
    } else {
      appendMessage('assistant', 'baglanti hatasi olustu tekrar yaz');
    }
  } catch (err) {
    removeTypingIndicator(typingIndicatorId);
    appendMessage('assistant', 'baglanti hatasi olustu tekrar yaz');
    console.error('Mesaj hatası:', err);
  } finally {
    isSendingMessage = false;
    if (chatInputEl) {
      chatInputEl.disabled = false;
      chatInputEl.focus();
    }
  }
}

function appendTypingIndicator(id) {
  const msgRow = document.createElement('div');
  msgRow.className = 'msg-row assistant';
  msgRow.id = id;
  msgRow.innerHTML = `
    <div class="msg-bubble" style="opacity:0.6; font-style:italic; font-size:12px;">
      yanıt yazılıyor...
    </div>
  `;
  chatMessagesEl.appendChild(msgRow);
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

function removeTypingIndicator(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function appendMessage(sender, text, mediaPath = null) {
  const msgRow = document.createElement('div');
  msgRow.className = `msg-row ${sender}`;

  let mediaHtml = '';
  if (mediaPath) {
    const src = mediaPath.startsWith('http') || mediaPath.startsWith('/data') ? mediaPath : `file://${mediaPath}`;
    mediaHtml = `
      <div class="msg-media">
        <img src="${src}" alt="Gönderilen Fotoğraf" onclick="window.open('${src}')">
      </div>
    `;
  }

  msgRow.innerHTML = `
    <div class="msg-bubble">${escapeHtml(text)}</div>
    ${mediaHtml}
  `;

  chatMessagesEl.appendChild(msgRow);
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function setupCorporatePillsAndTags() {
  const genderPills = document.querySelectorAll('#group-gender .btn-pill');
  genderPills.forEach(btn => {
    btn.onclick = () => {
      genderPills.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      selectedGender = btn.getAttribute('data-value');
    };
  });

  const agePills = document.querySelectorAll('#group-age .btn-pill');
  agePills.forEach(btn => {
    btn.onclick = () => {
      agePills.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      selectedAge = parseInt(btn.getAttribute('data-age'));
    };
  });

  const traitTags = document.querySelectorAll('#group-traits .tag-pill');
  traitTags.forEach(tag => {
    tag.onclick = () => {
      tag.classList.toggle('active');
    };
  });
}

// -------------------------------------------------------------
// MODALLAR VE KARAKTER ETKİLEŞİMLERİ
// -------------------------------------------------------------
function setupEventListeners() {
  btnDeleteActivePersona.onclick = async () => {
    if (!activePersona) {
      alert('Silinecek aktif karakter bulunamadı.');
      return;
    }

    const confirmDelete = confirm(`"${activePersona.name}" isimli karakter profilini ve tüm ayarlarını silmek istediğinizden emin misiniz?`);
    if (confirmDelete) {
      const res = await apiCall('delete-persona', activePersona.id);
      if (res && res.success) {
        const deletedName = activePersona.name;
        activePersona = null;
        await loadPersonas();
        alert(`🗑️ "${deletedName}" karakter profili başarıyla silindi.`);
      }
    }
  };

  tabBtnSingle.onclick = () => {
    tabBtnSingle.classList.add('active');
    tabBtnBulk.classList.remove('active');
    tabContentSingle.style.display = 'flex';
    tabContentBulk.style.display = 'none';
  };

  tabBtnBulk.onclick = () => {
    tabBtnBulk.classList.add('active');
    tabBtnSingle.classList.remove('active');
    tabContentBulk.style.display = 'flex';
    tabContentSingle.style.display = 'none';
  };

  btnClearAllDialogues.onclick = async () => {
    if ((allDialogueExamples || []).length === 0) {
      alert('Zaten silinecek diyalog kaydı yok.');
      return;
    }
    const confirmDelete = confirm(`Kayıtlı tüm (${allDialogueExamples.length} adet) diyalog örneklerini silmek istediğinizden emin misiniz?`);
    if (confirmDelete) {
      const res = await apiCall('clear-all-dialogue-examples');
      if (res && res.success) {
        await loadDialogueExamplesCount();
        renderDialogueItemsList();
        alert('🗑️ Tüm diyalog örnekleri başarıyla silindi ve sıfırlandı.');
      }
    }
  };

  btnBulkImportDialogues.onclick = async () => {
    const rawText = bulkDialogueTextarea.value.trim();
    if (!rawText) {
      alert('Lütfen kopyaladığınız metni yapıştırın.');
      return;
    }

    const items = [];

    const cleanLines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    for (let i = 0; i < cleanLines.length - 1; i++) {
      const line1 = cleanLines[i];
      const line2 = cleanLines[i + 1];

      const isSoruLine = /^Soru:?/i.test(line1) || /^Kullanıcı:?/i.test(line1) || /^User:?/i.test(line1);
      const isCevapLine = /^Cevap:?/i.test(line2) || /^Yanıt:?/i.test(line2) || /^AI:?/i.test(line2) || /^Assistant:?/i.test(line2);

      if (isSoruLine && isCevapLine) {
        const uText = line1.replace(/^Soru:?/i, '').replace(/^Kullanıcı:?/i, '').replace(/^User:?/i, '').trim();
        const aText = line2.replace(/^Cevap:?/i, '').replace(/^Yanıt:?/i, '').replace(/^AI:?/i, '').replace(/^Assistant:?/i, '').trim();
        if (uText && aText) {
          items.push({ user: uText, ai: aText });
          i++;
        }
      }
    }

    if (items.length === 0) {
      cleanLines.forEach(line => {
        let parts = null;
        if (line.includes('=>')) parts = line.split('=>');
        else if (line.includes('->')) parts = line.split('->');
        else if (line.includes('|')) parts = line.split('|');
        else if (line.includes('\t')) parts = line.split('\t');
        else if (line.includes('=')) parts = line.split('=');
        else if (line.includes(' - ')) parts = line.split(' - ');
        else if (line.includes(':') && !/^https?:/i.test(line)) parts = line.split(':');

        if (parts && parts.length >= 2) {
          const userStr = parts[0].trim();
          const aiStr = parts.slice(1).join(' ').trim();
          if (userStr && aiStr && userStr.toLowerCase() !== 'soru' && aiStr.toLowerCase() !== 'cevap') {
            items.push({ user: userStr, ai: aiStr });
          }
        }
      });
    }

    if (items.length === 0 && cleanLines.length >= 2) {
      for (let i = 0; i < cleanLines.length - 1; i += 2) {
        const uText = cleanLines[i].replace(/^Soru:?/i, '').trim();
        const aText = cleanLines[i + 1].replace(/^Cevap:?/i, '').trim();
        if (uText && aText) {
          items.push({ user: uText, ai: aText });
        }
      }
    }

    if (items.length === 0) {
      alert('Hiçbir geçerli soru-cevap çifti okunamadı. Lütfen metninizde "Soru:" ve "Cevap:" satırları veya "soru => cevap" ayraçları olduğundan emin olun.');
      return;
    }

    try {
      const res = await apiCall('bulk-add-dialogue-examples', items);
      if (res && res.success) {
        bulkDialogueTextarea.value = '';
        await loadDialogueExamplesCount();
        renderDialogueItemsList(dialogueMgrSearch.value);
        alert(`✅ ${res.addedCount} adet soru-cevap diyalog örneği başarıyla içe aktarıldı! (Toplam: ${res.total})`);
      } else {
        alert('Toplu aktarım hatası: ' + (res?.error || 'Bilinmeyen hata'));
      }
    } catch (err) {
      alert('Hata oluştu: ' + err.message);
    }
  };

  btnOpenDialogueManager.onclick = async () => {
    await loadDialogueExamplesCount();
    dialogueMgrUser.value = '';
    dialogueMgrAi.value = '';
    dialogueMgrSearch.value = '';
    renderDialogueItemsList();
    modalDialogueManager.classList.add('open');
  };

  btnCloseDialogueManager.onclick = () => {
    modalDialogueManager.classList.remove('open');
    if (chatInputEl) chatInputEl.focus();
  };

  btnAddDialogueItem.onclick = async () => {
    const u = dialogueMgrUser.value.trim();
    const a = dialogueMgrAi.value.trim();
    if (!u || !a) {
      alert('Lütfen hem kullanıcı sorusunu hem de karakter yanıtını giriniz.');
      return;
    }
    const res = await apiCall('add-dialogue-example', { user: u, ai: a });
    if (res && res.success) {
      dialogueMgrUser.value = '';
      dialogueMgrAi.value = '';
      await loadDialogueExamplesCount();
      renderDialogueItemsList(dialogueMgrSearch.value);
    }
  };

  btnSaveInspectorPrompt.onclick = async () => {
    if (!activePersona) return;
    const newPrompt = inspectorPromptEl.value.trim();
    const res = await apiCall('update-persona-prompt', {
      id: activePersona.id,
      systemPrompt: newPrompt
    });
    if (res && res.success) {
      activePersona.systemPrompt = newPrompt;
      alert('✅ Karakter promptu başarıyla güncellendi!');
    }
  };

  btnOpenPromptModal.onclick = () => {
    if (!activePersona) {
      alert('Lütfen önce sol taraftan bir karakter seçin.');
      return;
    }
    promptModalPersonaName.value = activePersona.name;
    promptModalText.value = activePersona.systemPrompt || '';
    modalPromptEditor.classList.add('open');
  };

  btnCancelPromptModal.onclick = () => {
    modalPromptEditor.classList.remove('open');
    if (chatInputEl) chatInputEl.focus();
  };

  btnSavePromptModal.onclick = async () => {
    if (!activePersona) return;
    const newPrompt = promptModalText.value.trim();
    await apiCall('update-persona-prompt', {
      id: activePersona.id,
      systemPrompt: newPrompt
    });
    activePersona.systemPrompt = newPrompt;
    inspectorPromptEl.value = newPrompt;

    modalPromptEditor.classList.remove('open');
    alert('✅ Prompt Başarıyla Kaydedildi!');
    if (chatInputEl) chatInputEl.focus();
  };

  btnOpenAddPersona.onclick = () => modalAddPersona.classList.add('open');
  btnCancelAdd.onclick = () => {
    modalAddPersona.classList.remove('open');
    if (chatInputEl) chatInputEl.focus();
  };

  btnBrowseFolder.onclick = async () => {
    if (isElectron) {
      const selectedFolder = await apiCall('select-media-folder');
      if (selectedFolder) {
        newFolderPathInput.value = selectedFolder;
      }
    } else {
      alert('Fotoğraf klasörü seçimi masaüstü uygulamasında geçerlidir.');
    }
  };

  btnSavePersona.onclick = async () => {
    const name = document.getElementById('new-name').value.trim();
    const hometownInput = document.getElementById('new-hometown');
    const locationInput = document.getElementById('new-location');
    const hometown = hometownInput ? hometownInput.value.trim() : '';
    const location = locationInput ? locationInput.value.trim() : '';
    const folderPath = newFolderPathInput.value.trim();

    const activeTraits = Array.from(document.querySelectorAll('#group-traits .tag-pill.active'))
      .map(t => t.getAttribute('data-trait'))
      .join(', ');

    if (!name) {
      alert('Lütfen karakter adını giriniz.');
      return;
    }

    let systemPrompt = activeTraits || 'Samimi, hızlı ve neşeli konuşan arkadaş';
    if (hometown) systemPrompt += `. Memleketi: ${hometown}`;
    if (location) systemPrompt += `. Yaşadığı Semt/Şehir: ${location}`;

    const newP = await apiCall('add-persona', {
      name,
      age: selectedAge,
      gender: selectedGender,
      hometown,
      location,
      provider: 'auto',
      systemPrompt: systemPrompt,
      mediaFolderPath: folderPath
    });

    if (document.getElementById('new-name')) document.getElementById('new-name').value = '';
    if (hometownInput) hometownInput.value = '';
    if (locationInput) locationInput.value = '';
    newFolderPathInput.value = '';

    modalAddPersona.classList.remove('open');
    await loadPersonas();
    if (newP) await setActivePersona(newP);
  };

  btnOpenApiModal.onclick = async () => {
    try {
      const keys = await apiCall('get-api-keys');
      if (keys) {
        if (keys.grok) document.getElementById('key-grok').value = keys.grok;
        if (keys.deepseek) document.getElementById('key-deepseek').value = keys.deepseek;
        if (keys.openai) document.getElementById('key-openai').value = keys.openai;
      }
    } catch (e) {}
    modalApiKeys.classList.add('open');
  };

  btnCloseApiModal.onclick = () => {
    const keys = {
      grok: document.getElementById('key-grok').value.trim(),
      deepseek: document.getElementById('key-deepseek').value.trim(),
      openai: document.getElementById('key-openai').value.trim()
    };
    apiCall('save-api-keys', keys);
    modalApiKeys.classList.remove('open');
    if (chatInputEl) chatInputEl.focus();
  };

  btnRefreshAdb.onclick = checkAdbDevices;
}

async function checkAdbDevices() {
  if (!isElectron) {
    adbStatusEl.innerText = 'ADB: Masaüstü Modunda Aktif';
    adbStatusEl.style.color = '#38bdf8';
    return;
  }

  adbStatusEl.innerText = 'ADB: Taranıyor...';
  try {
    const devices = await apiCall('get-adb-devices');
    if (devices && devices.length > 0) {
      adbStatusEl.innerText = `ADB: ${devices.length} Cihaz Bağlı (${devices[0]})`;
      adbStatusEl.style.color = '#22c55e';
    } else {
      adbStatusEl.innerText = 'ADB: Cihaz Bulunamadı';
      adbStatusEl.style.color = '#94a3b8';
    }
  } catch (e) {
    adbStatusEl.innerText = 'ADB: Hata';
  }
}
