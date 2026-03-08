// ── CONFIG ────────────────────────────────────────────────
const PHP_URL = 'api.php';

// ── STATE ─────────────────────────────────────────────────
let currentUser       = null;
let currentChat       = null;
let allChats          = [];
let pollTimer         = null;
let lastMsgCount      = 0;
let pendingDeleteChat = null;

// ══ AUTH ══════════════════════════════════════════════════
function switchTab(tab) {
  const isLogin = tab === 'login';
  document.querySelectorAll('.auth-tab').forEach((t,i) => t.classList.toggle('active', i===0 ? isLogin : !isLogin));
  document.getElementById('panel-login').classList.toggle('active', isLogin);
  document.getElementById('panel-register').classList.toggle('active', !isLogin);
}

async function doLogin() {
  const user = v('login-user'), pass = v('login-pass');
  const err  = $('login-error');
  err.textContent = '';
  if (!user || !pass) { err.textContent = 'Compila tutti i campi.'; return; }
  try {
    const res = await api({ action:'login', username:user, password:pass });
    if (res.ok) {
      startSession(res.username, res.chats || []);
    } else {
      err.textContent = res.error || 'Credenziali errate.';
    }
  } catch { err.textContent = 'Errore di connessione.'; }
}

async function doRegister() {
  const user  = v('reg-user'), pass = v('reg-pass'), pass2 = v('reg-pass2');
  const err   = $('reg-error'), succ = $('reg-success');
  err.textContent = ''; succ.textContent = '';
  if (!user || !pass || !pass2) { err.textContent = 'Compila tutti i campi.'; return; }
  if (pass !== pass2) { err.textContent = 'Le password non coincidono.'; return; }
  try {
    const res = await api({ action:'register', username:user, password:pass });
    if (res.ok) {
      succ.textContent = '✅ Account creato! Ora puoi accedere.';
      ['reg-user','reg-pass','reg-pass2'].forEach(id => $(id).value = '');
      setTimeout(() => switchTab('login'), 1800);
    } else {
      err.textContent = res.error || 'Errore nella registrazione.';
    }
  } catch { err.textContent = 'Errore di connessione.'; }
}

function doLogout() {
  currentUser = null; currentChat = null; allChats = [];
  clearInterval(pollTimer);
  $('app').classList.remove('visible');
  $('login-screen').style.display = 'flex';
  ['login-user','login-pass'].forEach(id => $(id).value = '');
}

function startSession(username, chats) {
  currentUser = username; allChats = chats;
  $('login-screen').style.display = 'none';
  $('app').classList.add('visible');
  $('sidebar-username').textContent = username;
  $('sidebar-avatar').textContent   = username[0].toUpperCase();
  renderChatList();
}

$('login-pass').addEventListener('keydown', e => { if (e.key==='Enter') doLogin(); });
$('reg-pass2').addEventListener('keydown',  e => { if (e.key==='Enter') doRegister(); });

// ══ CHAT LIST ═════════════════════════════════════════════
function renderChatList(filter = '') {
  const list  = $('chat-list');
  list.innerHTML = '';
  const chats = filter
    ? allChats.filter(c => c.toLowerCase().includes(filter.toLowerCase()))
    : allChats;

  if (!chats.length) {
    list.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-secondary);font-size:13px;">Nessuna chat trovata</div>';
    return;
  }
  chats.forEach(name => {
    const div = document.createElement('div');
    div.className = 'chat-item' + (name === currentChat ? ' active' : '');
    const initials = name.split('+').map(n => n[0]?.toUpperCase()||'?').join('').slice(0,2);
    div.innerHTML = `
      <div class="chat-avatar-list js-open">${initials}</div>
      <div class="chat-meta js-open">
        <div class="chat-name-item">${esc(formatName(name))}</div>
        <div class="chat-preview">${name.split('+').length} partecipanti</div>
      </div>
      <div class="chat-action-btns">
        <button class="chat-btn-small edit js-members" title="Gestisci membri">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
          </svg>
        </button>
        <button class="chat-btn-small del js-delete" title="Elimina chat">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
          </svg>
        </button>
      </div>`;
    div.querySelectorAll('.js-open').forEach(el => el.addEventListener('click', () => openChat(name)));
    div.querySelector('.js-members').addEventListener('click', e => { e.stopPropagation(); openManageMembersFor(name); });
    div.querySelector('.js-delete').addEventListener('click',  e => { e.stopPropagation(); openDeleteChatModal(name); });
    list.appendChild(div);
  });
}

function formatName(raw) { return raw.split('+').join(' · '); }

// ══ OPEN CHAT ═════════════════════════════════════════════
function openChat(name) {
  currentChat = name; lastMsgCount = 0;
  $('empty-state').style.display  = 'none';
  $('chat-view').style.display    = 'flex';
  const mems = name.split('+');
  $('chat-header-name').textContent    = formatName(name);
  $('chat-header-members').textContent = mems.length + ' partecipant' + (mems.length===1?'e':'i');
  $('chat-header-avatar').textContent  = mems.map(n=>n[0]?.toUpperCase()||'?').join('').slice(0,2);
  renderChatList();
  loadMessages();
  clearInterval(pollTimer);
  pollTimer = setInterval(loadMessages, 3000);
}

// ══ MESSAGES ══════════════════════════════════════════════
async function loadMessages() {
  if (!currentChat) return;
  try {
    const res = await api({ action:'getMessages', chatName:currentChat });
    if (!res.ok) return;
    const msgs = res.messages || [];
    if (msgs.length === lastMsgCount) return;
    lastMsgCount = msgs.length;
    renderMessages(msgs);
  } catch {}
}

function renderMessages(msgs) {
  const box = $('messages');
  const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
  box.innerHTML = ''; let lastDate = '';
  msgs.forEach(m => {
    const dt      = new Date(m.datetime);
    const dateStr = isNaN(dt) ? '' : dt.toLocaleDateString('it-IT',{day:'2-digit',month:'long',year:'numeric'});
    const timeStr = isNaN(dt) ? m.datetime : dt.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});
    if (dateStr && dateStr !== lastDate) {
      lastDate = dateStr;
      const d = document.createElement('div');
      d.className = 'msg-date-divider';
      d.innerHTML = `<span>${dateStr}</span>`;
      box.appendChild(d);
    }
    const isOut = m.sender === currentUser;
    const w = document.createElement('div');
    w.className = 'bubble-wrap ' + (isOut ? 'out' : 'in');
    w.innerHTML = `<div class="bubble">
      ${!isOut ? `<div class="bubble-sender">${esc(m.sender)}</div>` : ''}
      <div class="bubble-text">${esc(m.text)}</div>
      <div class="bubble-time">${timeStr}</div>
    </div>`;
    box.appendChild(w);
  });
  if (atBottom || lastMsgCount <= 1) box.scrollTop = box.scrollHeight;
}

// ══ SEND ══════════════════════════════════════════════════
async function sendMessage() {
  const inp  = $('msg-input');
  const text = inp.value.trim();
  if (!text || !currentChat) return;
  inp.value = ''; inp.style.height = '';
  try {
    const res = await api({ action:'sendMessage', chatName:currentChat, sender:currentUser, text });
    if (res.ok) { lastMsgCount = 0; loadMessages(); }
    else showToast('Errore: ' + (res.error||''));
  } catch { showToast('Errore di rete'); }
}
function handleKey(e) { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }
function autoResize(el) { el.style.height='auto'; el.style.height=Math.min(el.scrollHeight,120)+'px'; }

// ══ NUOVA CHAT ════════════════════════════════════════════
function openNewChatModal() {
  $('nc-members').value = '';
  $('nc-error').textContent = '';
  openModal('modal-newchat');
  setTimeout(() => $('nc-members').focus(), 200);
}
async function createChat() {
  const errEl = $('nc-error');
  errEl.textContent = '';
  const others = v('nc-members').split(',').map(s=>s.trim()).filter(Boolean);
  if (!others.length) { errEl.textContent = 'Inserisci almeno un partecipante.'; return; }
  const members  = [currentUser, ...others.filter(o => o.toLowerCase() !== currentUser.toLowerCase())];
  const chatName = [...new Set(members.map(m=>m.trim()))].sort().join('+');
  try {
    const res = await api({ action:'createChat', chatName, username:currentUser });
    if (res.ok) {
      if (!allChats.includes(chatName)) allChats.push(chatName);
      renderChatList();
      closeModal('modal-newchat');
      openChat(chatName);
      showToast('✅ Chat creata!');
    } else { errEl.textContent = res.error || 'Errore nella creazione.'; }
  } catch { errEl.textContent = 'Errore di connessione.'; }
}

// ══ GESTIONE MEMBRI ═══════════════════════════════════════
function openManageMembersModal() { openManageMembersFor(currentChat); }

function openManageMembersFor(chatName) {
  if (!chatName) return;
  $('add-member-input').value = '';
  $('members-error').textContent = '';
  $('modal-members').dataset.chat = chatName;
  renderMembersList(chatName);
  openModal('modal-members');
}

function renderMembersList(chatName) {
  const list    = $('members-list');
  const members = chatName.split('+');
  list.innerHTML = '';
  members.forEach(m => {
    const isMe = m.toLowerCase() === currentUser.toLowerCase();
    const chip = document.createElement('div');
    chip.className = 'member-chip';
    chip.innerHTML = `
      <span>${esc(m)}${isMe ? '<span class="chip-you">tu</span>' : ''}</span>
      ${!isMe ? `<button class="btn-remove-member" title="Rimuovi ${esc(m)}">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg></button>` : ''}`;
    if (!isMe) {
      chip.querySelector('.btn-remove-member').addEventListener('click', () => removeMember(chatName, m));
    }
    list.appendChild(chip);
  });
}

async function addMember() {
  const targetChat = $('modal-members').dataset.chat;
  const newMember  = v('add-member-input');
  const errEl      = $('members-error');
  errEl.textContent = '';
  if (!newMember) { errEl.textContent = 'Inserisci un nome utente.'; return; }
  const current = targetChat.split('+').map(m => m.toLowerCase());
  if (current.includes(newMember.toLowerCase())) { errEl.textContent = 'Utente già presente.'; return; }
  const allMems   = [...targetChat.split('+'), newMember];
  const newName   = [...new Set(allMems.map(m=>m.trim()))].sort().join('+');
  try {
    const res = await api({ action:'addMember', oldChatName:targetChat, newChatName:newName, newMember, username:currentUser });
    if (res.ok) {
      updateChatName(targetChat, newName);
      $('modal-members').dataset.chat = newName;
      $('add-member-input').value = '';
      renderMembersList(newName);
      renderChatList();
      showToast(`✅ ${newMember} aggiunto/a!`);
    } else { errEl.textContent = res.error || "Errore nell'aggiunta."; }
  } catch { errEl.textContent = 'Errore di connessione.'; }
}

async function removeMember(chatName, memberToRemove) {
  const errEl = $('members-error');
  errEl.textContent = '';
  const remaining = chatName.split('+').filter(m => m.toLowerCase() !== memberToRemove.toLowerCase());
  if (remaining.length < 2) {
    errEl.textContent = 'Minimo 2 partecipanti. Usa "Elimina chat" per rimuovere tutti.'; return;
  }
  const newName = remaining.sort().join('+');
  try {
    const res = await api({ action:'removeMember', oldChatName:chatName, newChatName:newName, memberToRemove, username:currentUser });
    if (res.ok) {
      updateChatName(chatName, newName);
      $('modal-members').dataset.chat = newName;
      renderMembersList(newName);
      renderChatList();
      showToast(`🗑️ ${memberToRemove} rimosso/a.`);
    } else { errEl.textContent = res.error || 'Errore nella rimozione.'; }
  } catch { errEl.textContent = 'Errore di connessione.'; }
}

function updateChatName(oldName, newName) {
  const idx = allChats.indexOf(oldName);
  if (idx !== -1) allChats[idx] = newName;
  if (currentChat === oldName) {
    currentChat = newName; lastMsgCount = 0;
    const mems = newName.split('+');
    $('chat-header-name').textContent    = formatName(newName);
    $('chat-header-members').textContent = mems.length + ' partecipant' + (mems.length===1?'e':'i');
    $('chat-header-avatar').textContent  = mems.map(n=>n[0]?.toUpperCase()||'?').join('').slice(0,2);
  }
}

// ══ ELIMINA CHAT ══════════════════════════════════════════
function openDeleteChatModal(chatName) {
  if (!chatName) return;
  pendingDeleteChat = chatName;
  $('del-chat-name').textContent  = formatName(chatName);
  $('del-chat-error').textContent = '';
  openModal('modal-delete-chat');
}
async function confirmDeleteChat() {
  if (!pendingDeleteChat) return;
  const errEl = $('del-chat-error');
  errEl.textContent = '';
  try {
    const res = await api({ action:'deleteChat', chatName:pendingDeleteChat, username:currentUser });
    if (res.ok) {
      const wasActive = currentChat === pendingDeleteChat;
      allChats = allChats.filter(c => c !== pendingDeleteChat);
      pendingDeleteChat = null;
      closeModal('modal-delete-chat');
      if (wasActive) {
        currentChat = null; clearInterval(pollTimer);
        $('chat-view').style.display   = 'none';
        $('empty-state').style.display = 'flex';
      }
      renderChatList();
      showToast('🗑️ Chat rimossa dal tuo elenco.');
    } else { errEl.textContent = res.error || "Errore durante l'eliminazione."; }
  } catch { errEl.textContent = 'Errore di connessione.'; }
}

// ══ ELIMINA ACCOUNT ═══════════════════════════════════════
function openDeleteAccountModal() {
  $('del-account-name').textContent = currentUser;
  $('del-account-pass').value       = '';
  $('del-account-error').textContent = '';
  openModal('modal-delete-account');
}
async function confirmDeleteAccount() {
  const pass  = v('del-account-pass');
  const errEl = $('del-account-error');
  errEl.textContent = '';
  if (!pass) { errEl.textContent = 'Inserisci la tua password per confermare.'; return; }
  try {
    const res = await api({ action:'deleteUser', username:currentUser, password:pass });
    if (res.ok) {
      closeModal('modal-delete-account');
      showToast('Account eliminato. Arrivederci!', 2000);
      setTimeout(doLogout, 2000);
    } else { errEl.textContent = res.error || "Errore durante l'eliminazione."; }
  } catch { errEl.textContent = 'Errore di connessione.'; }
}

// ══ MODALS ════════════════════════════════════════════════
function openModal(id)  { $(id).classList.add('show'); }
function closeModal(id) { $(id).classList.remove('show'); }
['modal-newchat','modal-members','modal-delete-chat','modal-delete-account'].forEach(id => {
  $(id).addEventListener('click', function(e) { if (e.target===this) closeModal(id); });
});

// ══ UTILS ═════════════════════════════════════════════════
function $(id) { return document.getElementById(id); }
function v(id) { return $(id).value.trim(); }
function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
async function api(data) {
  const r = await fetch(PHP_URL, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify(data)
  });
  return r.json();
}
function showToast(msg, ms=2800) {
  const t = $('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), ms);
}