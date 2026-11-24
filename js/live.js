// ── Live bits, shared through Firebase: page views + communal tic-tac-toe ──
// These values are a public client identifier, not a secret — Firebase is
// designed to expose them. Access is controlled by database security rules,
// which restrict writes to the pageViews and letters/tictactoe nodes.
// The SDK loads via deferred <script> tags, so the fridge renders without
// waiting on it; startFirebase() runs once it's ready (before DOMContentLoaded),
// and if it's blocked or offline both features simply don't appear.
(function () {
let db = null;
function startFirebase() {
  if (typeof firebase === 'undefined') return;   // blocked/offline: skip the game
  firebase.initializeApp({
    apiKey: "AIzaSyBNcJ4SXzzcTKH8edt1cqt9Rm30aN6CFuo",
    authDomain: "fridge-b5a68.firebaseapp.com",
    databaseURL: "https://fridge-b5a68-default-rtdb.firebaseio.com",
    projectId: "fridge-b5a68",
    storageBucket: "fridge-b5a68.firebasestorage.app",
    messagingSenderId: "813069686196",
    appId: "1:813069686196:web:54550c3883d20850f04ee1"
  });
  db = firebase.database();
  if (!isEditMode) initTicTacToe();
  initPageViews();
}

// ── Page-views sticky note ──
// Live total of page loads, shown as a Post-it on the fridge door. The magnet
// stays hidden until Firebase answers, so it never flashes an empty/zero note.
function initPageViews() {
  const wrap = $('views-magnet');
  const out  = $('views-count');
  if (!wrap || !out || !db) return;
  const ref  = db.ref('pageViews');
  const show = n => { out.textContent = (n || 0).toLocaleString(); wrap.hidden = false; };
  const hide = () => { wrap.hidden = true; };   // denied/offline: no magnet at all

  // The total is shared with js/away.js too, which puts a star in the Moon's sky for every visit.
  const share = (total, mine) => {
    window.fridgeViews = { total: total || 0, mine: mine != null ? mine : (window.fridgeViews || {}).mine };
    dispatchEvent(new Event('fridge-views'));
  };
  if (isEditMode) {                              // show the total but don't count
    ref.once('value', s => show(s.val()), hide);
    return;
  }
  // Count this load, then reveal the SERVER-confirmed total (not the optimistic
  // local value) and keep it live for anyone watching the page.
  ref.transaction(n => (n || 0) + 1, (err, committed, snap) => {
    if (err || !committed) return hide();
    show(snap.val());
    share(snap.val(), snap.val());               // this visit's own number
    ref.on('value', s => { show(s.val()); share(s.val()); }, hide);
  });
}

// ── Tic-tac-toe ──
// Each visitor plays as whoever's turn it is and makes one move; after a
// move they're locked until someone else moves (lastMoveBy guard). The board
// clears on win/draw; X-vs-O win totals persist in the shared state.
// Board position: TTT_POS in js/layout.js.
function initTicTacToe() {
  const PATH = 'letters/tictactoe'; // under the read/write-permitted node
  const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  const EMPTY = '         '; // 9 spaces
  const winnerOf = b => {
    for (const [a,c,d] of LINES) if (b[a] !== ' ' && b[a] === b[c] && b[a] === b[d]) return { who: b[a], line: [a,c,d] };
    return null;
  };
  const isFull = b => b.indexOf(' ') === -1;
  const fresh = (starter = 'X') => ({ board: EMPTY, turn: starter, winner: null, lastMoveBy: '', scores: { X: 0, O: 0 }, startNext: starter === 'X' ? 'O' : 'X' });

  // 8×8 pixel-art bitmaps for the marks; '1' = colored pixel, '0' = white.
  const SHAPES = {
    X: ['10000001','11000011','01100110','00111100','00111100','01100110','11000011','10000001'],
    O: ['00111100','01100110','11000011','11000011','11000011','11000011','01100110','00111100']
  };
  const MARK_COLOR = { X: '#d62828', O: '#1f6feb' };

  let cid;
  try { cid = localStorage.getItem('tttClientId') || (localStorage.setItem('tttClientId', cid = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)), cid); }
  catch (e) { cid = 'c' + Math.random().toString(36).slice(2); }

  // Build DOM
  const el = document.createElement('div');
  el.id = 'ttt';
  el.style.top   = TTT_POS.top   + '%';
  el.style.left  = TTT_POS.left  + '%';
  el.style.width = TTT_POS.width + '%';
  el.innerHTML = '<div id="ttt-status"></div><div class="ttt-board-wrap"><div id="ttt-grid"></div></div>';
  $('fridge').appendChild(el);
  const statusEl = el.querySelector('#ttt-status');

  const grid = el.querySelector('#ttt-grid');
  const boardWrap = el.querySelector('.ttt-board-wrap');
  ['v v1','v v2','h h1','h h2'].forEach(cls => { const l = document.createElement('div'); l.className = 'ttt-line ' + cls; boardWrap.appendChild(l); });
  const cells = [];
  for (let i = 0; i < 9; i++) {
    const c = document.createElement('div');
    c.className = 'ttt-cell';
    grid.appendChild(c);
    cells.push(c);
    c.addEventListener('click', () => move(i));
  }

  // Scale the whole board by setting a base font-size from its pixel width
  // (all inner sizes are in em). Robust where container-query units aren't.
  const sizeBoard = () => { const w = el.getBoundingClientRect().width; if (w) el.style.fontSize = (w * 0.115) + 'px'; };
  if (window.ResizeObserver) new ResizeObserver(sizeBoard).observe(el);
  requestAnimationFrame(sizeBoard);

  let state = null, resetTimer = null, shown = EMPTY;

  // Draw a mark into a cell as an 8×8 grid of pixels that fade in
  // diagonally (top-left → bottom-right) to reveal the X or O.
  function drawMark(cell, mark) {
    const shape = SHAPES[mark], color = MARK_COLOR[mark];
    if (!shape) { cell.textContent = ''; return; } // ignore unknown marks from shared state
    const px = document.createElement('div');
    px.className = 'ttt-px';
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const on = shape[r][c] === '1';
      const bit = document.createElement('div');
      bit.className = 'ttt-bit';
      bit.style.background = on ? color : 'transparent';
      bit.style.transitionDelay = ((r + c) * 18) + 'ms';
      px.appendChild(bit);
    }
    cell.textContent = '';
    cell.appendChild(px);
    requestAnimationFrame(() => px.classList.add('reveal'));
  }

  function render() {
    const s = state || fresh();
    const b = (s.board && s.board.length === 9) ? s.board : EMPTY;
    const win = s.winner;
    const wl = (win && win !== 'draw') ? winnerOf(b) : null;
    cells.forEach((c, i) => {
      const m = b[i];
      if (m !== shown[i]) { // only animate genuine changes
        if (m === ' ') c.textContent = '';
        else drawMark(c, m);
      }
      c.className = 'ttt-cell' + (m === 'X' ? ' x' : m === 'O' ? ' o' : ' empty') + (wl && wl.line.includes(i) ? ' win' : '');
    });
    shown = b;
    let locked;
    if (win === 'draw') { statusEl.textContent = 'Draw!'; locked = true; }
    else if (win) { statusEl.textContent = win + ' wins!'; locked = true; }
    else if (s.lastMoveBy === cid) { statusEl.textContent = 'Waiting for ' + s.turn + '…'; locked = true; }
    else { statusEl.textContent = s.turn + ' to move'; locked = false; }
    el.classList.toggle('locked', locked);
    // Keep the finished board (winning line highlighted) up briefly, then reset
    if (win && !resetTimer) resetTimer = setTimeout(() => { resetTimer = null; reset(); }, 3500);
  }

  function move(i) {
    const s = state;
    if (s && (s.winner || (s.board && s.board[i] !== ' ') || s.lastMoveBy === cid)) return;
    db.ref(PATH).transaction(cur => {
      cur = cur || fresh();
      if (!cur.board || cur.board.length !== 9) cur.board = EMPTY;
      if (cur.winner) return;
      if (cur.board[i] !== ' ') return;
      if (cur.lastMoveBy === cid) return;
      const turn = cur.turn || 'X';
      cur.board = cur.board.slice(0, i) + turn + cur.board.slice(i + 1);
      cur.lastMoveBy = cid;
      cur.scores = cur.scores || { X: 0, O: 0 };
      const w = winnerOf(cur.board);
      if (w) { cur.winner = w.who; cur.scores[w.who] = (cur.scores[w.who] || 0) + 1; }
      else if (isFull(cur.board)) { cur.winner = 'draw'; }
      else { cur.turn = turn === 'X' ? 'O' : 'X'; }
      return cur;
    });
  }

  function reset() {
    db.ref(PATH).transaction(cur => {
      if (!cur || !cur.winner) return; // someone else already reset
      const n = fresh(cur.startNext || 'X');
      n.scores = cur.scores || { X: 0, O: 0 };
      return n;
    });
  }

  db.ref(PATH).on('value', snap => { state = snap.val(); render(); });
  db.ref(PATH).transaction(cur => cur || fresh()); // seed initial state once
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startFirebase);
else startFirebase();
})();
