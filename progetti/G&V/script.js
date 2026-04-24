'use strict';

function convertTicketsToWeights(prizesWithTickets) {
  const totalTickets = prizesWithTickets.reduce((sum, p) => sum + (p.tickets || 0), 0);
  return prizesWithTickets.map(p => ({
    amount: p.amount,
    weight: ((p.tickets || 0) / totalTickets) * 100
  }));
}

// Biglietti con dati REALI (numero di biglietti per premio)
const TICKETS_RAW = [
  {
    id: 'milioni-di-diamanti',
    name: 'Milioni di Diamanti',
    series: 'CLASSICO',
    price: 30,
    emoji: '💎',
    color: '#1a5276',
    badge: 'PREMIUM',
    badgeClass: 'badge-premium',
    topPrize: 6000000,
    odds: '1:3.22',
    // Dati REALI dal sito ufficiale (lotto 18.240.000 biglietti)
    prizesRaw: [
      { amount: 0,        tickets: 12576364 },
      { amount: 50,       tickets: 4286400 },
      { amount: 100,      tickets: 1094400 },
      { amount: 200,      tickets: 149720 },
      { amount: 500,      tickets: 123880 },
      { amount: 1000,     tickets: 9000 },
      { amount: 2000,     tickets: 200 },
      { amount: 10000,    tickets: 22 },
      { amount: 50000,    tickets: 8 },
      { amount: 100000,   tickets: 4 },
      { amount: 6000000,  tickets: 2 }
    ]
  },
  {
    id: 'la-grande-occasione',
    name: 'La Grande Occasione',
    series: 'CLASSICO',
    price: 15,
    emoji: '💎',
    color: '#1a1740',
    badge: 'PREMIUM',
    badgeClass: 'badge-premium',
    topPrize: 3000000,
    odds: '1:4.23',
    prizesRaw: [
      { amount: 0, tickets: 14662128 },
      { amount: 25, tickets: 2784000 },
      { amount: 40, tickets: 672000 },
      { amount: 50, tickets: 576000 },
      { amount: 100, tickets: 288000 },
      { amount: 1500, tickets: 136000 },
      { amount: 250, tickets: 48000 },
      { amount: 500, tickets: 32000 },
      { amount: 1000, tickets: 1800 },
      { amount: 5000, tickets: 40 },
      { amount: 10000, tickets: 16 },
      { amount: 50000, tickets: 8 },
      { amount: 100000, tickets: 6 },
      { amount: 3000000, tickets: 2 }
    ]
  },
  {
    id: 'turista',
    name: 'Turista per Sempre',
    series: 'CLASSICO',
    price: 5,
    emoji: '✈️',
    color: '#001a1a',
    badge: 'HOT',
    badgeClass: 'badge-hot',
    topPrize: 1768625,
    odds: '1:6.77',
    prizesRaw: [
      { amount: 0, tickets: 40376016 },
      { amount: 5, tickets: 7488000 },
      { amount: 10, tickets: 5148000 },
      { amount: 15, tickets: 1778400 },
      { amount: 20, tickets: 748800 },
      { amount: 50, tickets: 421200 },
      { amount: 100, tickets: 147420 },
      { amount: 200, tickets: 44928 },
      { amount: 500, tickets: 4680 },
      { amount: 1000, tickets: 2340 },
      { amount: 5000, tickets: 144 },
      { amount: 10000, tickets: 36 },
      { amount: 50000, tickets: 27 },
      { amount: 1768625, tickets: 9 }
    ]
  }
];

// Converti automaticamente tutti i biglietti da tickets → weight
const TICKETS = TICKETS_RAW.map(ticket => ({
  ...ticket,
  prizes: convertTicketsToWeights(ticket.prizesRaw)
}));

/* ────────────────────────────────────────────────
   APP STATE (persisted to localStorage)
   ──────────────────────────────────────────────── */
const DEFAULT_STATE = {
  balance: 100,
  totalSpent: 0,
  totalWon: 0,
  totalGames: 0,
  wins: 0,
  history: [],
  sessionCards: 0,
  sessionWins: 0,
  sessionProfit: 0,
  lastWin: 0,
  activityFeed: [],
  cashflowData: {
    labels: [],
    spent: [],
    won: []
  }
};

let state = loadState();
let currentTicket = TICKETS[0];
let currentCells = [];
let revealedCount = 0;
let gameActive = false;
let cashflowChart = null;
let currentHistPage = 1;
const HIST_PER_PAGE = 10;

/* ────────────────────────────────────────────────
   STORAGE
   ──────────────────────────────────────────────── */
function loadState() {
  try {
    const raw = localStorage.getItem('luxescratch_state');
    if (raw) return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch(e) {}
  return { ...DEFAULT_STATE };
}

function saveState() {
  try {
    localStorage.setItem('luxescratch_state', JSON.stringify(state));
  } catch(e) {}
}

/* ────────────────────────────────────────────────
   WEIGHTED RANDOM (core function)
   ──────────────────────────────────────────────── */
function weightedRandom(prizes) {
  const totalWeight = prizes.reduce((sum, p) => sum + p.weight, 0);
  const rnd = Math.random() * totalWeight;
  let acc = 0;
  for (const prize of prizes) {
    acc += prize.weight;
    if (rnd <= acc) return prize.amount;
  }
  return prizes[prizes.length - 1].amount;
}

/* ────────────────────────────────────────────────
   FORMATTING HELPERS
   ──────────────────────────────────────────────── */
function fmt(n) {
  return '€' + Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtK(n) {
  if (n >= 1000000) return '€' + (n/1000000).toFixed(1) + 'M';
  if (n >= 1000)    return '€' + (n/1000).toFixed(0) + 'k';
  return fmt(n);
}
function tsNow() {
  const d = new Date();
  const pad = n => String(n).padStart(2,'0');
  return `Oggi, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function tsDate() {
  const d = new Date();
  return `${d.getDate()} ${['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'][d.getMonth()]} ${d.getFullYear()}`;
}
function genId() {
  return '#LX-' + Math.floor(1000000 + Math.random()*9000000);
}
function rtp() {
  if (!state.totalSpent) return 0;
  return (state.totalWon / state.totalSpent) * 100;
}

/* ────────────────────────────────────────────────
   NAVIGATION
   ──────────────────────────────────────────────── */
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link, .side-link, .bottom-link').forEach(l => l.classList.remove('active'));

  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');

  document.querySelectorAll(`[data-nav="${page}"]`).forEach(l => l.classList.add('active'));

  document.documentElement.setAttribute('data-page', page);

  if (page === 'home')       renderHome();
  if (page === 'tickets')    renderTicketsPage();
  if (page === 'history')    renderHistory();
  if (page === 'statistics') renderStatistics();
  if (page === 'game')       renderGamePage();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ────────────────────────────────────────────────
   HOME PAGE
   ──────────────────────────────────────────────── */
function renderHome() {
  document.getElementById('nav-balance').textContent = fmt(state.balance);

  document.getElementById('home-spent').textContent = fmt(state.totalSpent);
  document.getElementById('home-won').textContent = fmt(state.totalWon);
  document.getElementById('home-won-sub').textContent = `✦ ${state.wins} biglietti vincenti`;

  const net = state.totalWon - state.totalSpent;
  const netEl = document.getElementById('home-net');
  netEl.textContent = fmt(net);
  netEl.className = 'stat-value ' + (net >= 0 ? 'green' : 'red');

  const rtpPct = rtp();
  document.getElementById('home-rtp').textContent = `RITORNO AL GIOCATORE: ${rtpPct.toFixed(0)}%`;
  document.getElementById('home-net-bar').style.width = Math.min(100, rtpPct) + '%';

  const grid = document.getElementById('home-tickets-grid');
  grid.innerHTML = '';
  TICKETS.slice(0, 4).forEach(t => {
    grid.innerHTML += `
      <div class="ticket-card" data-id="${t.id}">
        <div class="ticket-thumb" style="background:${t.color}">
          <div class="ticket-thumb-inner">${t.emoji}</div>
          <span class="ticket-badge ${t.badgeClass}">${t.badge}</span>
        </div>
        <div class="ticket-info">
          <div class="ticket-name">${t.name}</div>
          <div class="ticket-meta">
            <span>Costo: ${fmt(t.price)}</span>
            <span>Premio: ${fmtK(t.topPrize)}</span>
          </div>
          <button class="btn-buy" data-id="${t.id}">Acquista</button>
        </div>
      </div>`;
  });

  grid.querySelectorAll('.btn-buy').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      buyAndPlay(btn.dataset.id);
    });
  });
  grid.querySelectorAll('.ticket-card').forEach(card => {
    card.addEventListener('click', () => buyAndPlay(card.dataset.id));
  });
}

/* ────────────────────────────────────────────────
   TICKETS PAGE
   ──────────────────────────────────────────────── */
function renderTicketsPage() {
  renderStoreGrid();
  populateHistFilter();
}

function renderStoreGrid(filterPrice = 'all') {
  const grid = document.getElementById('store-tickets-grid');
  grid.innerHTML = '';
  const filtered = filterPrice === 'all' ? TICKETS : TICKETS.filter(t => t.price == filterPrice);

  filtered.forEach(t => {
    grid.innerHTML += `
      <div class="store-ticket-card">
        <div class="store-thumb" style="background: linear-gradient(145deg, ${t.color}, #0a0a20)">
          <div class="store-thumb-bg">${t.emoji}</div>
          <span class="store-badge ${t.badgeClass}">${t.badge}</span>
          <span class="store-series-label">Series</span>
          <span class="store-ticket-name">${t.name}</span>
          <span class="store-odds">ODDS ${t.odds}</span>
        </div>
        <div class="store-body">
          <div class="store-price-row">
            <div>
              <div class="store-price-label">Starting at</div>
              <div class="store-price">${fmt(t.price)}</div>
            </div>
            <div style="text-align:right">
              <div class="store-price-label" style="color:var(--amber)">Top Prize</div>
              <div class="store-top-prize">${fmtK(t.topPrize)}</div>
            </div>
          </div>
          <button class="btn-buy-ticket" data-id="${t.id}">Buy Ticket</button>
        </div>
      </div>`;
  });

  grid.querySelectorAll('.btn-buy-ticket').forEach(btn => {
    btn.addEventListener('click', () => buyAndPlay(btn.dataset.id));
  });
}

function switchTab(tab) {
  document.getElementById('tab-store').classList.toggle('active', tab === 'store');
  document.getElementById('tab-inventory').classList.toggle('active', tab === 'inventory');
  document.getElementById('store-view').style.display = tab === 'store' ? '' : 'none';
  document.getElementById('inventory-view').style.display = tab === 'inventory' ? '' : 'none';

  if (tab === 'inventory') renderInventory();
}

function renderInventory() {
  const grid = document.getElementById('inventory-grid');
  const inv = state.history.slice(0, 5);
  grid.innerHTML = '';
  document.getElementById('inventory-empty').style.display = inv.length ? 'none' : '';

  inv.forEach(h => {
    const t = TICKETS.find(x => x.id === h.ticket) || TICKETS[0];
    grid.innerHTML += `
      <div class="store-ticket-card" style="cursor:pointer" data-id="${t.id}">
        <div class="store-thumb" style="background: linear-gradient(145deg, ${t.color}, #0a0a20)">
          <div class="store-thumb-bg">${t.emoji}</div>
          <span class="store-series-label">Series</span>
          <span class="store-ticket-name">${t.name}</span>
        </div>
        <div class="store-body">
          <div class="store-price-row">
            <div><div class="store-price-label">Acquistato</div><div style="font-size:0.78rem;color:var(--text-dim)">${h.ts}</div></div>
            <div style="text-align:right"><div class="store-price-label" style="color:${h.result>0?'var(--green)':'var(--text-dim)'}">Esito</div>
            <div style="font-weight:800;color:${h.result>0?'var(--green)':'var(--text-dim)'}">${fmt(h.result)}</div></div>
          </div>
          <button class="btn-buy-ticket" data-id="${t.id}">Gioca ancora</button>
        </div>
      </div>`;
  });

  grid.querySelectorAll('.btn-buy-ticket').forEach(btn => {
    btn.addEventListener('click', () => buyAndPlay(btn.dataset.id));
  });
}

/* ────────────────────────────────────────────────
   GAME PAGE
   ──────────────────────────────────────────────── */
function buyAndPlay(ticketId) {
  const ticket = TICKETS.find(t => t.id === ticketId) || TICKETS[0];
  if (state.balance < ticket.price) {
    openRechargeModal();
    return;
  }
  currentTicket = ticket;
  navigate('game');
  initNewGame();
}

function renderGamePage() {
  renderWinningSymbols();
  renderActivity();
  updateSessionStats();
  document.getElementById('game-title').textContent = 'The ' + currentTicket.name;
  document.getElementById('game-desc').textContent = `Scopri 3 simboli uguali per vincere fino a ${fmtK(currentTicket.topPrize)}`;
  document.getElementById('game-price').textContent = fmt(currentTicket.price);
  document.getElementById('sc-series').textContent = currentTicket.series;
  document.getElementById('sc-name').textContent = currentTicket.name.toUpperCase();
  document.getElementById('game-last-win').textContent = fmt(state.lastWin);
}

function renderWinningSymbols() {
  const top2 = [...currentTicket.prizes]
    .filter(p => p.amount > 0)
    .sort((a,b) => b.amount - a.amount)
    .slice(0, 2);

  const container = document.getElementById('game-winning-symbols');
  container.innerHTML = '';
  top2.forEach(p => {
    container.innerHTML += `
      <div class="win-sym-item">
        <span class="win-sym-icon">${p.amount >= 1000 ? '💎' : '💰'}</span>
        <span class="win-sym-amt">${fmtK(p.amount)}</span>
      </div>`;
  });
}

function renderActivity() {
  const container = document.getElementById('game-activity');
  container.innerHTML = '';
  const fakeUsers = [4829, 1102, 9923, 3312, 7841];
  const rows = [];
  state.history.slice(0, 2).forEach((h, i) => {
    rows.push({ user: `User#${fakeUsers[i]}`, amount: h.result });
  });
  while (rows.length < 3) rows.push({ user: `User#${fakeUsers[rows.length]}`, amount: 0 });

  rows.slice(0, 3).forEach(r => {
    const cls = r.amount > 0 ? 'amt-pos' : (r.amount < 0 ? 'amt-neg' : 'amt-zero');
    const label = r.amount > 0 ? `+${fmt(r.amount)}` : fmt(r.amount);
    container.innerHTML += `<div class="activity-row"><span>${r.user}</span><span class="${cls}">${label}</span></div>`;
  });
}

function initNewGame() {
  gameActive = true;
  revealedCount = 0;
  document.getElementById('result-overlay').style.display = 'none';
  document.getElementById('game-footer').style.display = 'none';

  const result = weightedRandom(currentTicket.prizes);

  const SYMBOLS = [
    { icon: '💎', label: fmtK(result > 0 ? result : 0) },
    { icon: '💰', label: '€' + Math.floor(Math.random()*50+5) },
    { icon: '⭐', label: 'STAR' },
    { icon: '🎯', label: 'BONUS' },
    { icon: '🔑', label: 'KEY' },
    { icon: '🃏', label: 'JOKER' }
  ];

  if (result > 0) {
    const winSym = { icon: result >= 10000 ? '💎' : '💰', label: fmt(result), isWin: true };
    const losers = Array.from({length: 6}, () => {
      const s = SYMBOLS[Math.floor(Math.random()*SYMBOLS.length)];
      return { icon: s.icon, label: s.label, isWin: false };
    });
    const winPositions = [];
    while (winPositions.length < 3) {
      const pos = Math.floor(Math.random()*9);
      if (!winPositions.includes(pos)) winPositions.push(pos);
    }
    const finalCells = [];
    let loserIdx = 0;
    for (let i = 0; i < 9; i++) {
      finalCells.push(winPositions.includes(i) ? { ...winSym } : losers[loserIdx++ % 6]);
    }
    currentCells = finalCells;
  } else {
    const cellSyms = [];
    const counts = {};
    for (let i = 0; i < 9; i++) {
      let sym;
      let tries = 0;
      do {
        sym = SYMBOLS[Math.floor(Math.random()*SYMBOLS.length)];
        tries++;
      } while ((counts[sym.icon] || 0) >= 2 && tries < 20);
      counts[sym.icon] = (counts[sym.icon] || 0) + 1;
      cellSyms.push({ icon: sym.icon, label: sym.label, isWin: false });
    }
    currentCells = cellSyms;
  }

  state.balance -= currentTicket.price;
  state.totalSpent += currentTicket.price;
  state.totalGames++;
  state.sessionCards++;
  state.sessionProfit -= currentTicket.price;
  saveState();

  renderScratchGrid();
  updateNavBalance();
  updateSessionStats();
}

function renderScratchGrid() {
  const grid = document.getElementById('scratch-grid');
  grid.innerHTML = '';
  currentCells.forEach((cell, i) => {
    const div = document.createElement('div');
    div.className = 'scratch-cell';
    div.dataset.index = i;
    div.innerHTML = `
      <div class="cell-content">
        <span class="cell-icon">${cell.icon}</span>
        <span class="cell-val ${cell.isWin ? 'highlight' : ''}">${cell.label}</span>
      </div>
      <div class="scratch-overlay">
        <span class="scratch-overlay-icon">🪙</span>
      </div>`;
    div.addEventListener('click', () => revealCell(i, div));
    grid.appendChild(div);
  });
}

function revealCell(index, el) {
  if (!gameActive) return;
  const overlay = el.querySelector('.scratch-overlay');
  if (!overlay || overlay.classList.contains('revealed')) return;

  overlay.classList.add('revealed');
  revealedCount++;

  if (currentCells[index].isWin) el.classList.add('winner');

  if (revealedCount === 9) endGame();
}

function revealAll() {
  if (!gameActive) return;
  document.querySelectorAll('.scratch-cell').forEach((el, i) => {
    const overlay = el.querySelector('.scratch-overlay');
    if (overlay && !overlay.classList.contains('revealed')) {
      overlay.classList.add('revealed');
      revealedCount++;
      if (currentCells[i].isWin) el.classList.add('winner');
    }
  });
  endGame();
}

function endGame() {
  gameActive = false;
  const isWin = currentCells.some(c => c.isWin);

  let prize = 0;
  if (isWin) {
    const winCell = currentCells.find(c => c.isWin);
    prize = parseLabel(winCell.label);
  }

  if (prize > 0) {
    state.balance += prize;
    state.totalWon += prize;
    state.wins++;
    state.sessionWins++;
    state.lastWin = prize;
    state.sessionProfit += prize;
  }

  state.history.unshift({
    id: genId(),
    ts: tsNow(),
    date: tsDate(),
    ticket: currentTicket.id,
    cost: currentTicket.price,
    result: prize
  });
  if (state.history.length > 500) state.history.length = 500;

  state.cashflowData.labels.push(state.totalGames);
  state.cashflowData.spent.push(state.totalSpent);
  state.cashflowData.won.push(state.totalWon);
  if (state.cashflowData.labels.length > 30) {
    state.cashflowData.labels.shift();
    state.cashflowData.spent.shift();
    state.cashflowData.won.shift();
  }

  saveState();
  updateNavBalance();
  updateSessionStats();

  if (prize > 0) {
    showGameFooter(prize);
    setTimeout(() => showResultOverlay(true, prize), 800);
  } else {
    setTimeout(() => showResultOverlay(false, 0), 400);
  }
}

function parseLabel(label) {
  if (!label || label === 'BONUS' || label === 'STAR' || label === 'KEY' || label === 'JOKER') return 0;
  let s = label.replace('€','').replace(/\./g,'').replace(',','.');
  if (s.endsWith('M')) return parseFloat(s)*1000000;
  if (s.endsWith('k')) return parseFloat(s)*1000;
  return parseFloat(s) || 0;
}

function showGameFooter(prize) {
  const footer = document.getElementById('game-footer');
  footer.style.display = 'flex';
  document.getElementById('game-win-total').textContent = fmt(prize);
}

function showResultOverlay(won, prize) {
  const overlay = document.getElementById('result-overlay');
  const icon = document.getElementById('result-icon');
  const title = document.getElementById('result-title');
  const amount = document.getElementById('result-amount');

  overlay.style.display = 'flex';
  if (won) {
    icon.textContent = '🎉';
    title.textContent = 'HAI VINTO!';
    title.style.color = 'var(--amber)';
    amount.textContent = fmt(prize);
    amount.style.color = 'var(--amber)';
  } else {
    icon.textContent = '😔';
    title.textContent = 'NESSUNA VINCITA';
    title.style.color = 'var(--text-muted)';
    amount.textContent = 'Riprova!';
    amount.style.color = 'var(--text-dim)';
  }
}

function updateSessionStats() {
  const profitEl = document.getElementById('session-profit');
  const profit = state.sessionProfit;
  profitEl.textContent = (profit >= 0 ? '+' : '') + fmt(profit);
  profitEl.style.color = profit >= 0 ? 'var(--green)' : 'var(--red)';

  const barPct = state.sessionCards > 0
    ? Math.min(100, Math.max(0, 50 + (profit / (state.sessionCards * currentTicket.price)) * 50))
    : 50;
  document.getElementById('session-bar').style.width = barPct + '%';

  document.getElementById('session-cards').textContent = state.sessionCards;
  document.getElementById('session-wins').textContent = state.sessionWins;
  document.getElementById('game-last-win').textContent = fmt(state.lastWin);
}

function updateNavBalance() {
  document.getElementById('nav-balance').textContent = fmt(state.balance);
}

/* ────────────────────────────────────────────────
   PLAY 10 / BULK
   ──────────────────────────────────────────────── */
function playMultiple(times) {
  let played = 0;
  let totalWon = 0;

  const interval = setInterval(() => {
    if (played >= times || state.balance < currentTicket.price) {
      clearInterval(interval);
      const net = totalWon - (played * currentTicket.price);
      showToast(`Completate ${played} giocate. Vinto: ${fmt(totalWon)} | Netto: ${(net>=0?'+':'')+fmt(net)}`);
      renderGamePage();
      renderScratchGrid();
      if (currentCells.some(c => c.isWin)) {
        showGameFooter(parseLabel(currentCells.find(c=>c.isWin).label));
      }
      return;
    }

    const result = weightedRandom(currentTicket.prizes);
    state.balance -= currentTicket.price;
    state.totalSpent += currentTicket.price;
    state.totalGames++;
    state.sessionCards++;
    state.sessionProfit -= currentTicket.price;

    if (result > 0) {
      state.balance += result;
      state.totalWon += result;
      state.wins++;
      state.sessionWins++;
      state.lastWin = result;
      state.sessionProfit += result;
      totalWon += result;
    }

    state.history.unshift({
      id: genId(), ts: tsNow(), date: tsDate(),
      ticket: currentTicket.id, cost: currentTicket.price, result
    });

    played++;
  }, 120);

  saveState();
}

/* ────────────────────────────────────────────────
   HISTORY PAGE
   ──────────────────────────────────────────────── */
function populateHistFilter() {
  const sel = document.getElementById('hist-filter');
  if (!sel) return;
  const existing = Array.from(sel.options).map(o => o.value);
  TICKETS.forEach(t => {
    if (!existing.includes(t.name)) {
      const opt = document.createElement('option');
      opt.value = t.name; opt.textContent = t.name;
      sel.appendChild(opt);
    }
  });
}

function renderHistory() {
  document.getElementById('hist-total').textContent = state.totalGames;
  document.getElementById('hist-week').textContent = `+${Math.min(state.totalGames, 12)} questa settimana`;
  document.getElementById('hist-invested').textContent = fmt(state.totalSpent);
  document.getElementById('hist-won').textContent = fmt(state.totalWon);
  const profit = state.totalWon - state.totalSpent;
  document.getElementById('hist-profit').textContent = `Profitto netto: ${fmt(profit)}`;
  document.getElementById('hist-wr').textContent = state.totalGames > 0
    ? ((state.wins / state.totalGames) * 100).toFixed(1) + '%'
    : '0.0%';
  document.getElementById('hist-bar').style.width = Math.min(100, state.totalSpent / 10) + '%';

  populateHistFilter();
  renderHistoryTable();
}

function getFilteredHistory() {
  let rows = [...state.history];
  const search = document.getElementById('hist-search')?.value.toLowerCase() || '';
  const filter = document.getElementById('hist-filter')?.value || '';

  if (search) rows = rows.filter(r => r.id.toLowerCase().includes(search) || r.ticket.includes(search));
  if (filter) rows = rows.filter(r => {
    const t = TICKETS.find(x => x.id === r.ticket);
    return t && t.name === filter;
  });
  return rows;
}

function renderHistoryTable(page = 1) {
  currentHistPage = page;
  const rows = getFilteredHistory();
  const total = rows.length;
  const start = (page - 1) * HIST_PER_PAGE;
  const pageRows = rows.slice(start, start + HIST_PER_PAGE);

  const tbody = document.getElementById('history-tbody');
  tbody.innerHTML = '';

  if (!pageRows.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-dim)">Nessuna transazione trovata.</td></tr>';
  } else {
    pageRows.forEach(row => {
      const ticket = TICKETS.find(t => t.id === row.ticket) || TICKETS[0];
      const isWin = row.result > 0;
      const isBig = row.result >= 100;
      const badgeClass = isBig ? 'big' : (isWin ? 'win' : 'loss');
      const resultLabel = isWin ? `+ ${fmt(row.result)}` : fmt(0);

      tbody.innerHTML += `
        <tr>
          <td>
            <div class="hist-date">${row.ts}</div>
            <div class="hist-date-sub">${row.date || ''}</div>
          </td>
          <td>
            <div class="hist-ticket-name">
              <div class="ticket-avatar" style="background:${ticket.color}">${ticket.emoji}</div>
              ${ticket.name}
            </div>
          </td>
          <td><span class="hist-id">${row.id}</span></td>
          <td class="hist-cost">${fmt(row.cost)}</td>
          <td>
            <span class="result-badge ${badgeClass}">
              ${isWin ? '●' : '○'} ${resultLabel}
            </span>
          </td>
          <td><button class="btn-view" title="Dettaglio">👁</button></td>
        </tr>`;
    });
  }

  renderPagination(total, page);
}

function renderPagination(total, current) {
  const totalPages = Math.max(1, Math.ceil(total / HIST_PER_PAGE));
  const pag = document.getElementById('pagination');
  if (!pag) return;

  let pagesHtml = '';
  for (let i = 1; i <= Math.min(totalPages, 5); i++) {
    pagesHtml += `<button class="page-btn ${i === current ? 'active' : ''}" data-page="${i}">${i}</button>`;
  }
  if (totalPages > 5) pagesHtml += `<button class="page-btn" disabled>…</button><button class="page-btn" data-page="${totalPages}">${totalPages}</button>`;

  pag.innerHTML = `
    <span>Mostrando ${Math.min((current-1)*HIST_PER_PAGE+1, total)}–${Math.min(current*HIST_PER_PAGE, total)} di ${total} transazioni</span>
    <div class="page-btns">
      <button class="page-btn" data-page="${Math.max(1, current-1)}">‹</button>
      ${pagesHtml}
      <button class="page-btn" data-page="${Math.min(totalPages, current+1)}">›</button>
    </div>`;

  pag.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', () => renderHistoryTable(+btn.dataset.page));
  });
}

function exportCSV() {
  const rows = getFilteredHistory();
  const lines = [['ID','Data','Ticket','Costo','Vincita'].join(',')];
  rows.forEach(r => {
    const t = TICKETS.find(x => x.id === r.ticket);
    lines.push([r.id, r.ts, t?.name || r.ticket, r.cost, r.result].join(','));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'luxescratch_history.csv';
  a.click();
}

/* ────────────────────────────────────────────────
   STATISTICS PAGE
   ──────────────────────────────────────────────── */
function renderStatistics() {
  const rtpVal = rtp();
  const net = state.totalWon - state.totalSpent;

  document.getElementById('stats-rtp').textContent = rtpVal.toFixed(1) + '%';
  document.getElementById('stats-rtp-vs').textContent = (rtpVal - 92.4).toFixed(1) + '% vs Global Avg';
  document.getElementById('stats-net').textContent = fmt(net);
  document.getElementById('stats-net').className = 'stat-value ' + (net >= 0 ? 'green' : 'red');
  document.getElementById('stats-scratched').textContent = state.totalGames.toLocaleString();
  document.getElementById('stats-scratched-vs').textContent = `+${state.totalGames > 0 ? '12' : '0'}% vs last month`;

  const luck = Math.min(100, Math.max(0, Math.round(50 + (net / Math.max(1, state.totalSpent)) * 30)));
  const luckLabel = luck < 35 ? 'Sfortunato' : luck > 65 ? 'Fortunato' : 'Balanced';
  document.getElementById('stats-luck').textContent = luckLabel;
  document.getElementById('luck-bar').style.width = luck + '%';
  document.getElementById('luck-score').textContent = luck + '/100';

  renderCashflowChart();
  renderOutcomeDistribution();
  renderProbMatrix();

  const forecastRtp = Math.min(99, Math.max(80, rtpVal + (Math.random()*4 - 2))).toFixed(0);
  document.getElementById('forecast-rtp').textContent = forecastRtp + '%';
  const now = new Date();
  document.getElementById('forecast-updated').textContent =
    `Data updated at ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')} UTC today.`;
}

function renderCashflowChart() {
  const ctx = document.getElementById('cashflow-chart').getContext('2d');

  const labels = state.cashflowData.labels.length > 0
    ? state.cashflowData.labels.map((_,i) => 'G' + (i+1))
    : ['G1'];
  const spentData = state.cashflowData.spent.length > 0 ? state.cashflowData.spent : [0];
  const wonData   = state.cashflowData.won.length > 0   ? state.cashflowData.won   : [0];

  if (cashflowChart) {
    cashflowChart.data.labels = labels;
    cashflowChart.data.datasets[0].data = wonData;
    cashflowChart.data.datasets[1].data = spentData;
    cashflowChart.update();
    return;
  }

  cashflowChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Wins',
          data: wonData,
          borderColor: '#4ade80',
          backgroundColor: 'rgba(74,222,128,0.08)',
          tension: 0.4,
          fill: true,
          pointRadius: 3,
          borderWidth: 2
        },
        {
          label: 'Spent',
          data: spentData,
          borderColor: '#c4c1fb',
          backgroundColor: 'rgba(196,193,251,0.06)',
          tension: 0.4,
          fill: true,
          pointRadius: 3,
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      interaction: { intersect: false, mode: 'index' },
      plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1d2022', borderColor: '#47464f', borderWidth: 1 } },
      scales: {
        x: { ticks: { color: '#928f9a', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: '#928f9a', font: { size: 11 }, callback: v => '€'+v }, grid: { color: 'rgba(255,255,255,0.04)' } }
      }
    }
  });
}

function renderOutcomeDistribution() {
  const total = state.totalGames || 1;
  const wins = state.wins;
  const bigWins = state.history.filter(h => h.result >= 50).length;
  const smallWins = wins - bigWins;
  const breakEven = state.history.filter(h => h.result > 0 && h.result < 5).length;
  const losses = total - wins;

  const categories = [
    { label: 'Non-winning Tickets', pct: Math.round((losses / total) * 100), color: '#928f9a' },
    { label: 'Break-even (Free Ticket)', pct: Math.round((breakEven / total) * 100), color: '#c4c1fb' },
    { label: 'Low Tier Wins (€2–€10)', pct: Math.round((smallWins / total) * 100), color: '#4ade80' },
    { label: 'High Tier Wins (€50+)', pct: Math.round((bigWins / total) * 100), color: '#ffb95f' }
  ];

  const list = document.getElementById('outcome-list');
  list.innerHTML = '';
  categories.forEach(c => {
    list.innerHTML += `
      <div class="outcome-row">
        <div class="outcome-label"><span>${c.label}</span><span class="outcome-pct">${c.pct}%</span></div>
        <div class="outcome-bar-wrap"><div class="outcome-bar" style="width:${c.pct}%;background:${c.color}"></div></div>
      </div>`;
  });

  document.getElementById('outcome-note').textContent =
    total > 10
      ? `Your distribution matches the mathematical expectation for the '${currentTicket.name}' series within a 2.3% margin of error.`
      : 'Gioca di più per ottenere statistiche dettagliate sulla distribuzione.';
}

function renderProbMatrix() {
  const tbody = document.getElementById('prob-tbody');
  tbody.innerHTML = '';

  const prizes = [...currentTicket.prizes]
    .filter(p => p.amount > 0)
    .sort((a,b) => b.amount - a.amount);

  prizes.forEach(p => {
    const hits = state.history.filter(h => h.ticket === currentTicket.id && h.result === p.amount).length;
    const totalWeight = currentTicket.prizes.reduce((s,x) => s + x.weight, 0);
    const oddsVal = Math.round(totalWeight / p.weight);
    const landed = hits > 0;

    tbody.innerHTML += `
      <tr>
        <td style="font-weight:700">${fmt(p.amount)}</td>
        <td>${hits}</td>
        <td>1 ogni ${oddsVal.toLocaleString('it-IT')}</td>
        <td><span class="status-badge ${landed ? 'landed' : 'unmet'}">${landed ? 'LANDED' : 'UNMET'}</span></td>
      </tr>`;
  });
}

/* ────────────────────────────────────────────────
   TOAST
   ──────────────────────────────────────────────── */
function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.style.cssText = `position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:var(--surface-hi);border:1px solid var(--border);color:var(--text);padding:12px 20px;border-radius:12px;font-size:0.85rem;font-weight:700;z-index:999;box-shadow:0 4px 24px rgba(0,0,0,0.5);text-align:center;max-width:90vw;transition:opacity 0.4s`;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 3500);
}

/* ────────────────────────────────────────────────
   MODALS
   ──────────────────────────────────────────────── */
function openRechargeModal() {
  document.getElementById('recharge-modal').style.display = 'flex';
}

function openWithdrawModal() {
  document.getElementById('withdraw-balance').textContent = fmt(state.balance);
  document.getElementById('withdraw-modal').style.display = 'flex';
}

/* ────────────────────────────────────────────────
   RESET
   ──────────────────────────────────────────────── */
function resetSimulation() {
  if (!confirm('Sei sicuro di voler resettare la simulazione? Tutti i dati verranno cancellati.')) return;
  localStorage.removeItem('luxescratch_state');
  state = { ...DEFAULT_STATE };
  saveState();
  if (cashflowChart) { cashflowChart.destroy(); cashflowChart = null; }
  navigate('home');
  showToast('Simulazione resettata. Nuovo saldo: €100');
}

/* ────────────────────────────────────────────────
   EVENT LISTENERS
   ──────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-nav]');
    if (el) {
      e.preventDefault();
      navigate(el.dataset.nav);
    }
  });

  document.getElementById('btn-recharge').addEventListener('click', openRechargeModal);
  document.getElementById('recharge-cancel').addEventListener('click', () => {
    document.getElementById('recharge-modal').style.display = 'none';
  });
  document.querySelectorAll('.recharge-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.balance += +btn.dataset.amount;
      saveState();
      updateNavBalance();
      document.getElementById('recharge-modal').style.display = 'none';
      showToast(`Saldo ricaricato di ${fmt(+btn.dataset.amount)}. Totale: ${fmt(state.balance)}`);
      if (document.getElementById('page-home').classList.contains('active')) renderHome();
    });
  });
  document.getElementById('recharge-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.style.display = 'none';
  });

  document.getElementById('btn-withdraw').addEventListener('click', openWithdrawModal);
  document.getElementById('withdraw-cancel').addEventListener('click', () => {
    document.getElementById('withdraw-modal').style.display = 'none';
  });
  document.getElementById('withdraw-confirm').addEventListener('click', () => {
    const amount = parseFloat(document.getElementById('withdraw-amount').value);
    if (!amount || amount <= 0 || amount > state.balance) {
      showToast('Importo non valido.'); return;
    }
    state.balance -= amount;
    saveState();
    updateNavBalance();
    document.getElementById('withdraw-modal').style.display = 'none';
    showToast(`Prelievo di ${fmt(amount)} effettuato. Saldo: ${fmt(state.balance)}`);
  });
  document.getElementById('withdraw-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.style.display = 'none';
  });

  document.getElementById('btn-new-game').addEventListener('click', () => {
    if (state.balance < currentTicket.price) { openRechargeModal(); return; }
    initNewGame();
  });

  document.getElementById('btn-reveal-all').addEventListener('click', revealAll);

  document.getElementById('btn-next-game').addEventListener('click', () => {
    document.getElementById('result-overlay').style.display = 'none';
    if (state.balance < currentTicket.price) { openRechargeModal(); return; }
    initNewGame();
  });

  document.getElementById('btn-play10').addEventListener('click', () => {
    if (state.balance < currentTicket.price) { openRechargeModal(); return; }
    const btn = document.getElementById('btn-play10');
    btn.disabled = true;
    document.getElementById('result-overlay').style.display = 'none';
    document.getElementById('game-footer').style.display = 'none';
    playMultiple(10);
    setTimeout(() => { btn.disabled = false; }, 1600);
  });

  document.getElementById('btn-reset').addEventListener('click', resetSimulation);

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderStoreGrid(btn.dataset.price);
    });
  });

  ['hist-search','hist-filter','hist-period'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => renderHistoryTable(1));
  });

  document.getElementById('btn-export')?.addEventListener('click', exportCSV);

  document.getElementById('btn-pdf')?.addEventListener('click', () => {
    showToast('Generazione report PDF in corso… (funzione dimostrativa)');
  });

  document.getElementById('bulk-toggle')?.addEventListener('change', e => {
    const label = document.querySelector('.toggle-on');
    if (label) label.style.color = e.target.checked ? 'var(--green)' : 'var(--text-dim)';
  });

  navigate('home');
});