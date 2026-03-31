/* app.js — Nexore AI */

const GROQ_API_KEY = 'YOUR_GROQ_API_KEY_HERE';
const MODEL = 'llama-3.3-70b-versatile';

let users = JSON.parse(localStorage.getItem('nx_users') || '{}');
let currentUser = JSON.parse(localStorage.getItem('nx_session') || 'null');
let chats = {}, currentChatId = null, isGenerating = false;

// pending images: array of {base64, mime, thumb}
let pendingImages = [];

// ── ICON HELPER ───────────────────────────────────────
const ic = (id, s = 14) => `<svg width="${s}" height="${s}"><use href="#${id}"/></svg>`;

// ── INIT ──────────────────────────────────────────────
window.onload = () => {
  if (currentUser) { loadChats(); showChat(); }
  else showWelcome();
};

// ── AUTH ──────────────────────────────────────────────
function switchTab(t) {
  document.getElementById('loginForm').style.display = t === 'login' ? '' : 'none';
  document.getElementById('registerForm').style.display = t === 'register' ? '' : 'none';
  document.querySelectorAll('.auth-tab').forEach((el, i) =>
    el.classList.toggle('active', (i === 0) === (t === 'login')));
}

function doLogin() {
  const e = document.getElementById('loginEmail').value.trim().toLowerCase();
  const p = document.getElementById('loginPass').value;
  const err = document.getElementById('loginError'); err.style.display = 'none';
  if (!e || !p) return se(err, 'يرجى تعبئة جميع الحقول');
  if (!users[e]) return se(err, 'البريد الإلكتروني غير مسجل');
  if (users[e].pass !== btoa(p)) return se(err, 'كلمة المرور غير صحيحة');
  currentUser = { email: e, name: users[e].name };
  localStorage.setItem('nx_session', JSON.stringify(currentUser));
  loadChats(); showChat();
}

function doRegister() {
  const n = document.getElementById('regName').value.trim();
  const e = document.getElementById('regEmail').value.trim().toLowerCase();
  const p = document.getElementById('regPass').value;
  const err = document.getElementById('regError'); err.style.display = 'none';
  if (!n || !e || !p) return se(err, 'يرجى تعبئة جميع الحقول');
  if (!e.includes('@')) return se(err, 'بريد إلكتروني غير صحيح');
  if (p.length < 6) return se(err, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
  if (users[e]) return se(err, 'هذا البريد مسجل مسبقاً');
  users[e] = { name: n, pass: btoa(p) };
  localStorage.setItem('nx_users', JSON.stringify(users));
  currentUser = { email: e, name: n };
  localStorage.setItem('nx_session', JSON.stringify(currentUser));
  loadChats(); showChat();
}

function doLogout() {
  localStorage.removeItem('nx_session');
  currentUser = null; currentChatId = null;
  pendingImages = [];
  document.getElementById('landing').classList.add('active');
  document.getElementById('chat').classList.remove('active');
  document.getElementById('loginEmail').value = '';
  document.getElementById('loginPass').value = '';
}

const se = (el, msg) => { el.textContent = msg; el.style.display = 'block'; };

// ── CHAT UI ───────────────────────────────────────────
function showChat() {
  document.getElementById('landing').classList.remove('active');
  document.getElementById('chat').classList.add('active');
  document.getElementById('userAvatar').textContent = currentUser.name.charAt(0).toUpperCase();
  document.getElementById('userEmail').textContent = currentUser.email;
  renderChatList(); showWelcome();
  document.getElementById('userInput').focus();
}

function loadChats() { chats = JSON.parse(localStorage.getItem('nx_chats_' + currentUser.email) || '{}'); }
function saveChats() { localStorage.setItem('nx_chats_' + currentUser.email, JSON.stringify(chats)); }

function newChat() {
  currentChatId = 'chat_' + Date.now();
  chats[currentChatId] = { title: 'محادثة جديدة', messages: [], created: Date.now() };
  saveChats(); renderChatList(); showWelcome();
  document.getElementById('currentChatTitle').textContent = 'محادثة جديدة';
  document.getElementById('userInput').focus();
  toggleSidebar(false);
}

function selectChat(id) {
  currentChatId = id; renderMessages();
  document.getElementById('currentChatTitle').textContent = chats[id]?.title || 'محادثة';
  renderChatList(); toggleSidebar(false);
}

function deleteChat(id, e) {
  e.stopPropagation(); delete chats[id];
  if (currentChatId === id) { currentChatId = null; showWelcome(); }
  saveChats(); renderChatList();
}

function renderChatList() {
  const list = document.getElementById('chatList');
  const sorted = Object.entries(chats).sort((a, b) => b[1].created - a[1].created);
  list.innerHTML = sorted.map(([id, c]) => `
    <div class="chat-item ${id === currentChatId ? 'active' : ''}" onclick="selectChat('${id}')">
      <span class="chat-item-icon">${ic('ic-msg', 13)}</span>
      <span class="chat-item-title">${esc(c.title)}</span>
      <button class="chat-item-del" onclick="deleteChat('${id}',event)">${ic('ic-trash', 13)}</button>
    </div>
  `).join('') || '<div style="color:#2a2a2a;font-size:12px;text-align:center;padding:20px 0">لا توجد محادثات</div>';
}

function showWelcome() {
  document.getElementById('messagesWrap').innerHTML = `
    <div class="welcome-screen" id="welcomeScreen">
      <div class="welcome-icon">${ic('ic-spark', 36)}</div>
      <div class="welcome-title">كيف أقدر أساعدك؟</div>
      <div class="welcome-sub">اسألني أي شيء — برمجة، كتابة، أفكار، أو حتى محادثة عادية.</div>
      <div class="suggestions">
        <div class="suggestion-chip" onclick="sendSuggestion('اشرح لي كيف يعمل الذكاء الاصطناعي')">${ic('ic-cpu', 14)} اشرح الذكاء الاصطناعي</div>
        <div class="suggestion-chip" onclick="sendSuggestion('ساعدني في كتابة بريد إلكتروني احترافي')">${ic('ic-mail', 14)} بريد إلكتروني احترافي</div>
        <div class="suggestion-chip" onclick="sendSuggestion('اكتب كود Python لقراءة ملف CSV')">${ic('ic-code', 14)} كود Python</div>
        <div class="suggestion-chip" onclick="sendSuggestion('ما أفضل طريقة لتعلم البرمجة؟')">${ic('ic-book', 14)} تعلم البرمجة</div>
      </div>
    </div>`;
}

function renderMessages() {
  if (!currentChatId || !chats[currentChatId]) return showWelcome();
  const msgs = chats[currentChatId].messages;
  if (!msgs.length) return showWelcome();
  document.getElementById('messagesWrap').innerHTML = msgs.map(m => msgHTML(m)).join('');
  scrollBottom();
}

// Build message HTML — handles text + optional images
function msgHTML(m) {
  const u = m.role === 'user';
  const av = u
    ? `<div class="msg-avatar">${currentUser.name.charAt(0).toUpperCase()}</div>`
    : `<div class="msg-avatar">${ic('ic-spark', 16)}</div>`;

  let body = '';

  // images first
  if (m.images && m.images.length) {
    body += m.images.map(img =>
      `<img class="msg-img" src="${img}" alt="صورة مرفقة" onclick="openImgFull(this.src)">`
    ).join('');
  }

  // text
  if (m.content) {
    body += u
      ? `<span>${esc(m.content).replace(/\n/g, '<br>')}</span>`
      : md(m.content);
  }

  return `<div class="msg ${u ? 'user' : 'ai'}">${av}<div class="msg-body"><div class="msg-sender">${u ? currentUser.name : 'Nexore AI'}</div><div class="msg-text">${body}</div></div></div>`;
}

// ── IMAGE HANDLING ────────────────────────────────────
function handleImgSelect(event) {
  const files = Array.from(event.target.files);
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      const base64 = e.target.result; // full data URL
      const mime = file.type;
      pendingImages.push({ base64, mime });
      renderImgPreview();
    };
    reader.readAsDataURL(file);
  });
  // reset so same file can be re-selected
  event.target.value = '';
}

function renderImgPreview() {
  const bar = document.getElementById('imgPreviewBar');
  if (!pendingImages.length) { bar.style.display = 'none'; bar.innerHTML = ''; return; }
  bar.style.display = 'flex';
  bar.innerHTML = pendingImages.map((img, i) => `
    <div class="img-thumb-wrap">
      <img class="img-thumb" src="${img.base64}" alt="preview">
      <button class="img-thumb-remove" onclick="removeImg(${i})">${ic('ic-x', 10)}</button>
    </div>
  `).join('');
}

function removeImg(i) {
  pendingImages.splice(i, 1);
  renderImgPreview();
}

function openImgFull(src) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;';
  overlay.onclick = () => overlay.remove();
  const img = document.createElement('img');
  img.src = src;
  img.style.cssText = 'max-width:90vw;max-height:90vh;border-radius:10px;box-shadow:0 0 60px rgba(255,255,255,.1);';
  overlay.appendChild(img);
  document.body.appendChild(overlay);
}

// ── SEND MESSAGE ──────────────────────────────────────
async function sendMessage() {
  if (isGenerating) return;
  const inp = document.getElementById('userInput');
  const text = inp.value.trim();
  const imgs = [...pendingImages];

  if (!text && !imgs.length) return;

  if (!currentChatId) {
    currentChatId = 'chat_' + Date.now();
    chats[currentChatId] = { title: 'محادثة جديدة', messages: [], created: Date.now() };
  }

  document.getElementById('welcomeScreen')?.remove();

  // Build user message object
  const userMsg = {
    role: 'user',
    content: text,
    images: imgs.map(i => i.base64),
  };

  chats[currentChatId].messages.push(userMsg);

  // Auto-title from first message
  if (chats[currentChatId].messages.length === 1) {
    const titleText = text || (imgs.length ? 'صورة مرفقة' : 'محادثة');
    chats[currentChatId].title = titleText.slice(0, 36) + (titleText.length > 36 ? '…' : '');
    document.getElementById('currentChatTitle').textContent = chats[currentChatId].title;
  }

  // Clear input + images
  inp.value = ''; inp.style.height = 'auto';
  pendingImages = []; renderImgPreview();

  saveChats(); renderChatList();
  appendMsgEl(userMsg);
  scrollBottom();

  const tid = 't_' + Date.now();
  appendTyping(tid);
  scrollBottom();

  isGenerating = true;
  document.getElementById('sendBtn').disabled = true;

  try {
    // Build Groq messages — convert images to base64 content parts
    const apiMessages = chats[currentChatId].messages.map(m => {
      if (!m.images || !m.images.length) {
        return { role: m.role, content: m.content || '' };
      }
      // Vision: content array with image_url parts
      const parts = m.images.map(img => ({
        type: 'image_url',
        image_url: { url: img }
      }));
      if (m.content) parts.push({ type: 'text', text: m.content });
      return { role: m.role, content: parts };
    });

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: 'أنت مساعد ذكاء اصطناعي متطور ومفيد يتحدث العربية والإنجليزية بطلاقة. كن واضحاً، دقيقاً، ومفيداً. تم تطويرك بواسطة Nexore Team.' },
          ...apiMessages
        ],
        max_tokens: 2048, temperature: 0.7, stream: true
      })
    });

    if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || 'API Error'); }
    document.getElementById(tid)?.remove();

    let aiText = '';
    const aiEl = appendMsgEl({ role: 'assistant', content: '' });
    aiEl.querySelector('.msg-text').classList.add('cursor-blink');

    const reader = res.body.getReader(), dec = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      for (const line of dec.decode(value, { stream: true }).split('\n').filter(l => l.startsWith('data: '))) {
        const d = line.slice(6); if (d === '[DONE]') continue;
        try {
          const delta = JSON.parse(d).choices?.[0]?.delta?.content || '';
          if (delta) {
            aiText += delta;
            aiEl.querySelector('.msg-text').innerHTML = md(aiText);
            aiEl.querySelector('.msg-text').classList.add('cursor-blink');
            scrollBottom();
          }
        } catch {}
      }
    }

    aiEl.querySelector('.msg-text').classList.remove('cursor-blink');
    chats[currentChatId].messages.push({ role: 'assistant', content: aiText });
    saveChats();

  } catch (err) {
    document.getElementById(tid)?.remove();
    const el = appendMsgEl({ role: 'assistant', content: '' });
    el.querySelector('.msg-text').innerHTML =
      `<span style="display:flex;align-items:center;gap:8px;color:#ff6b6b">${ic('ic-warn', 15)} ${esc(err.message)}</span>`;
    scrollBottom();
  }

  isGenerating = false;
  document.getElementById('sendBtn').disabled = false;
  document.getElementById('userInput').focus();
}

function sendSuggestion(t) { document.getElementById('userInput').value = t; sendMessage(); }

function appendMsgEl(m) {
  const wrap = document.getElementById('messagesWrap');
  const d = document.createElement('div');
  d.innerHTML = msgHTML(m);
  const el = d.firstElementChild;
  wrap.appendChild(el); return el;
}

function appendTyping(id) {
  document.getElementById('messagesWrap').insertAdjacentHTML('beforeend', `
    <div class="msg ai typing-indicator" id="${id}">
      <div class="msg-avatar">${ic('ic-spark', 16)}</div>
      <div class="msg-body"><div class="msg-sender">Nexore AI</div>
      <div class="msg-text"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div></div>
    </div>`);
}

// ── HELPERS ───────────────────────────────────────────
const scrollBottom = () => { const w = document.getElementById('messagesWrap'); w.scrollTop = w.scrollHeight; };

function handleKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }

function autoResize(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 180) + 'px'; }

function toggleSidebar(open) {
  document.getElementById('sidebar').classList.toggle('open', open);
  document.getElementById('sidebarOverlay').classList.toggle('active', open);
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function md(t) {
  return t
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/```([\w]*)\n?([\s\S]*?)```/g, (_, l, c) => `<pre><code>${c.trim()}</code></pre>`)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^\- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, s => `<ul>${s}</ul>`)
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
}

// ── PROTECTION ────────────────────────────────────────
document.addEventListener('contextmenu', e => e.preventDefault());

document.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (e.ctrlKey && (k === 'u' || k === 's' || k === 'p')) { e.preventDefault(); return false; }
  if (e.ctrlKey && e.shiftKey && (k === 'i' || k === 'j' || k === 'c')) { e.preventDefault(); return false; }
  if (k === 'f12') { e.preventDefault(); return false; }
});

document.addEventListener('selectstart', e => {
  const tag = e.target.tagName.toLowerCase();
  if (!['input', 'textarea'].includes(tag)) e.preventDefault();
});

document.addEventListener('dragstart', e => e.preventDefault());
