// Kill native browser drag-ghost on any image (capture phase, all elements)
document.addEventListener('dragstart', e => e.preventDefault(), true);
document.addEventListener('drag',      e => e.preventDefault(), true);

// ── Helpers ────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const pageType = href => {
  const h = href.toLowerCase();
  return h.includes('decisions') ? 'decisions'
       : h.includes('woodshop') || h.includes('bethtrain') ? 'woodshop'
       : h.includes('postcard')  ? 'postcard'
       : 'generic';
};

// ── Firebase realtime DB ───────────────────────────────────
// These values are a public client identifier, not a secret — Firebase is
// designed to expose them. Access is controlled by database security rules,
// which restrict writes to the letters/tictactoe nodes.
// Firebase powers the communal tic-tac-toe only. It loads via deferred
// <script> tags (see head), so the fridge renders without waiting on it;
// startFirebase() runs once the SDK is ready (before DOMContentLoaded).
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
}

// ── Letter set (magnets) ───────────────────────────────────
const PALETTE = ['#e63946','#f6d400','#3a86ff','#2dc653','#ff6b35','#9b5de5','#ff85a1','#ffffff'];
const LETTER_SET = ['e','t','a','o','i','n','s','h'].map((char, i) => ({
  id: `${char.toLowerCase()}${i}`, char, color: PALETTE[i % PALETTE.length]
}));
const letterDefaultPos = i => ({
  left: (74 + (i % 2) * 8).toFixed(1),
  top:  (76 + Math.floor(i / 2) * 6).toFixed(1)
});

// ── Items config (edit with ?edit + Copy layout) ───────────
let ITEMS = [
  { id: "item_1779583589922", src: "items/Bike Business.webp", top: 37.548, left: 29.04, width: 21.8, rotate: 0, href: "rides.html", hoverLabel: "Rides", windowTitle: "Best Rides" },
  { id: "item_1779583606062", src: "items/furniture_web.webp?v=2", top: 19.91, left: 26.77, width: 9.442, rotate: 0, href: "woodshop/woodshop copy.html", hoverLabel: "Woodshop" },
  { id: "item_1779583643716", src: "items/greeting.webp", top: 9.908, left: 49.123, width: 13, rotate: 0, href: null, hoverLabel: null },
  { id: "item_1779586060280", src: "items/tj receipt.webp", top: 10.299, left: 63.313, width: 9, rotate: 0, href: "https://tj-prices.com", hoverLabel: "TJ Prices" },
  { id: "item_1781388702732", src: "items/about me.png", top: 9.922, left: 48.594, width: 13.9, rotate: 0, href: "about.html", hoverLabel: null, windowTitle: "About Me" },
  { id: "item_1781392936791", src: "items/better doms.webp", top: 35.286, left: 53.122, width: 18.7, rotate: 0, href: null, hoverLabel: null },
  { id: "item_amtrak", embed: "/amtrak/map.html?embed=1&v=2", fluid: true, aspect: "50 / 33", top: 9.76, left: 26.07, width: 23, rotate: 0, windowEmbed: "/amtrak/map.html?v=2", windowTitle: "Live Amtrak", hoverLabel: "Trains" },
  { id: "item_1781393177283", src: "items/shopping.png", top: 38.006, left: 37.651, width: 2.5, rotate: 0, href: null, hoverLabel: null },
  { id: "item_1786000000001", src: "items/writing.png", top: 20.514, left: 61.953, width: 11.5, rotate: 0, href: "writing/writing.html", hoverLabel: null, windowTitle: "Writing" },
  { id: "item_clockclock24", embed: "/ClockClock24/index.html?v=3", aspect: "8 / 3", top: 23.345, left: 46.158, width: 29.2, rotate: 0, href: "https://github.com/ArnaudSpanneut/ClockClock24", hoverLabel: null },
  { id: "item_1788007465835", src: "items/shopping.png", top: 35.879, left: 61.621, width: 2.5, rotate: 0, href: null, hoverLabel: null }
];

// Tic-tac-toe board position (draggable in edit mode).
const TTT_POS = { top: 19.545, left: 37.545, width: 10.135 };

// Optional per-item edit-mode overrides — paste from Copy Layout to update
// positions/widths; href/hoverLabel/windowTitle stay set above.

// ── Mode ───────────────────────────────────────────────────
const isEditMode = new URLSearchParams(location.search).has('edit');
if (isEditMode) document.body.classList.add('edit-mode');

const isPostcardOnTouch = item =>
  window.matchMedia('(pointer: coarse), (max-width: 900px)').matches
  && !!item.href && item.href.includes('postcard');

// ── Drag system ────────────────────────────────────────────
let maxZ = 100, letterMaxZ = 500;
function makeDraggable(el, onDrop, isLetter = false) {
  el.addEventListener('pointerdown', e => {
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    el.style.zIndex = isLetter ? ++letterMaxZ : ++maxZ;

    const cRect = $('fridge').getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    const ox = e.clientX - eRect.left, oy = e.clientY - eRect.top;

    const onMove = e => {
      el.style.left = Math.max(0, Math.min(95,  (e.clientX - cRect.left - ox) / cRect.width  * 100)) + '%';
      el.style.top  = Math.max(0, Math.min(110, (e.clientY - cRect.top  - oy) / cRect.height * 100)) + '%';
    };
    const onUp = () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup',   onUp);
      if (onDrop) onDrop(el);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup',   onUp);
  });
}

// ── Fridge OS window ───────────────────────────────────────
const _injectedFonts = new Set();
let _windowCleanup = null;

// A full-screen OS window on touch should stay pinned to the screen. Pinch-zoom
// would shrink that "full screen" window and reveal the fridge behind it, so we
// lock zoom while a window is open (and release it after, leaving the fridge
// itself zoomable). user-scalable=no is ignored by iOS Safari, so we also block
// its pinch gesture events directly.
const _viewportMeta  = document.querySelector('meta[name="viewport"]');
const _VIEWPORT_FREE   = 'width=device-width, initial-scale=1.0';
const _VIEWPORT_LOCKED = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
const _blockGesture = e => e.preventDefault();
function lockZoom(on) {
  if (_viewportMeta) _viewportMeta.setAttribute('content', on ? _VIEWPORT_LOCKED : _VIEWPORT_FREE);
  const method = on ? 'addEventListener' : 'removeEventListener';
  document[method]('gesturestart', _blockGesture, { passive: false });
  document[method]('gesturechange', _blockGesture, { passive: false });
}

async function openWindow(href, title) {
  if (_windowCleanup) { _windowCleanup(); _windowCleanup = null; }
  if (href.startsWith('http')) { window.open(href, '_blank', 'noopener,noreferrer'); return; }
  // On touch: push history state so back button closes the overlay
  if (_isTouch) { history.pushState({ fridgeWindow: true }, '', ''); lockZoom(true); }

  const overlay   = $('os-overlay');
  const contentEl = $('os-content-inner');
  const styleEl   = $('os-injected-style');
  $('os-window-title').textContent = title || 'Jack Kane';
  // Reset any inline sizing left by a previous window; each window type
  // (postcard, woodshop) sizes itself after its content loads.
  $('os-window').style.width = '';
  $('os-window').style.height = '';
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden'; // lock background scroll while open
  contentEl.innerHTML = '<div style="padding:48px 56px;color:#aaa;font-family:-apple-system,sans-serif;font-size:14px;">Loading…</div>';
  styleEl.textContent = '';

  const type = pageType(href);

  try {
    const resp = await fetch(encodeURI(href), { cache: 'no-store' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    let html = await resp.text();

    const doc = new DOMParser().parseFromString(html, 'text/html');

    // Drop the page's own sidebar nav — irrelevant inside the OS window
    doc.querySelectorAll('.sidebar, aside').forEach(el => el.remove());

    // Fix relative image paths (prepend baseDir)
    const baseDir = href.includes('/') ? href.substring(0, href.lastIndexOf('/') + 1) : '';
    doc.querySelectorAll('img[src]').forEach(img => {
      const src = img.getAttribute('src');
      if (src && !src.startsWith('http') && !src.startsWith('/') && !src.startsWith('data:')) {
        img.setAttribute('src', baseDir + src);
      }
    });

    // Inject external stylesheets (fonts, etc.) once
    doc.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
      const fh = link.getAttribute('href');
      if (fh && !_injectedFonts.has(fh)) {
        const l = document.createElement('link');
        l.rel = 'stylesheet'; l.href = fh;
        document.head.appendChild(l);
        _injectedFonts.add(fh);
      }
    });

    // Extract and scope page styles (rewrite body{} → #os-content-inner{})
    let css = '';
    doc.querySelectorAll('style').forEach(s => { css += s.textContent; });
    styleEl.textContent = css.replace(/\bbody\s*{/g, '#os-content-inner {');

    // Build body content per page type
    let wsSrcs = null;
    // Snapshot scripts before any adoption (adoptNode moves nodes out of doc)
    const docScripts = Array.from(doc.querySelectorAll('script'));
    if (type === 'decisions') {
      const terminal = doc.querySelector('.terminal-container');
      contentEl.innerHTML = '';
      const wrap = document.createElement('div');
      wrap.style.cssText = 'padding:20px;box-sizing:border-box;';
      if (terminal) {
        wrap.appendChild(document.adoptNode(terminal));
      } else {
        Array.from(doc.body.childNodes).forEach(n => wrap.appendChild(document.adoptNode(n)));
      }
      contentEl.appendChild(wrap);
    } else if (type === 'woodshop') {
      wsSrcs = Array.from(doc.querySelectorAll('img.project-image')).map(img => img.getAttribute('src'));
      contentEl.innerHTML = `<div id="ws-slide">
  <img id="ws-img" src="${wsSrcs[0]}">
  <div id="ws-counter">1 / ${wsSrcs.length}</div>
  <button id="ws-prev" class="ws-nav prev" title="Previous">◀</button>
  <button id="ws-next" class="ws-nav next" title="Next">▶</button>
</div>`;
    } else {
      contentEl.innerHTML = '';
      Array.from(doc.body.childNodes).forEach(n => contentEl.appendChild(document.adoptNode(n)));
    }

    if (type === 'woodshop') wireWoodshop(contentEl, wsSrcs);
    if (type === 'decisions') _windowCleanup = startDecisionsGame();
    if (type === 'postcard')  sizePostcard();

    // Re-execute inline scripts (decisions handles its own logic above)
    if (type !== 'decisions') {
      docScripts.forEach(oldScript => {
        const s = document.createElement('script');
        if (oldScript.src) s.src = oldScript.src;
        else s.textContent = oldScript.textContent;
        document.body.appendChild(s);
        document.body.removeChild(s);
      });
    }

  } catch (err) {
    contentEl.innerHTML = `<div style="padding:48px 56px;color:#e63946;font-family:-apple-system,sans-serif;font-size:13px;">Could not load page.<br><br><code>${err.message}</code></div>`;
    console.error('openWindow:', err);
  }
}

// ── Embedded window (iframe) ───────────────────────────────
// Some pages are whole self-contained apps (the Amtrak map: its own pixel
// font, canvas and 60s data loop). Those open in their own document instead
// of being inlined like the essay pages — no id or style collisions with the
// fridge, and re-opening costs nothing because the file is already cached.
function openEmbedWindow(src, title, aspect) {
  if (_windowCleanup) { _windowCleanup(); _windowCleanup = null; }
  if (_isTouch) { history.pushState({ fridgeWindow: true }, '', ''); lockZoom(true); }

  $('os-window-title').textContent = title || 'Jack Kane';
  $('os-window').style.width = '';
  $('os-window').style.height = '';
  $('os-injected-style').textContent = '';
  $('os-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';

  const frame = document.createElement('iframe');
  frame.className = 'os-embed-frame';
  frame.src = src;
  const inner = $('os-content-inner');
  inner.innerHTML = '';
  inner.appendChild(frame);
  if (aspect) sizeEmbedWindow(frame, aspect);
  _windowCleanup = () => { frame.src = 'about:blank'; };   // stop its timers on close
}

// Fit the embed window to its content's aspect ratio plus whatever slim footer
// the page keeps, so it wraps tightly like the postcard/woodshop windows
// instead of floating in the default 84vw × 76vh box.
function sizeEmbedWindow(frame, aspect) {
  if (window.matchMedia('(pointer: coarse)').matches) return; // window is full-screen on touch only
  const win = $('os-window');
  // Deterministic fit: window = map (at `aspect`) + a fixed allowance for the
  // page's wrap padding and slim footer. Measuring the iframe's footer across
  // frames raced the map's own script (before it hid the tall "how it's made"
  // details) and oversized the window, so we size to a constant instead.
  const TITLEBAR = 38, HPAD = 8, VCHROME = 53; // wrap padding (4·2 / 6+8) + slim 2-line footer (+margin)
  const [aw, ah] = aspect.split('/').map(parseFloat);
  const ar = aw / ah;
  requestAnimationFrame(() => {
    const maxW = Math.min(window.innerWidth * 0.9, 900);
    const maxContentH = window.innerHeight * 0.9 - TITLEBAR;
    let w = maxW;
    let mapH = (w - HPAD) / ar;
    let contentH = mapH + VCHROME;
    if (contentH > maxContentH) {          // very short screen: fit to height instead
      contentH = maxContentH;
      mapH = contentH - VCHROME;
      w = mapH * ar + HPAD;
    }
    win.style.width  = Math.round(w) + 'px';
    win.style.height = Math.round(contentH + TITLEBAR) + 'px';
    $('os-content').style.overflow = 'hidden';
  });
}

// ── Postcard: size window to image aspect (1568×1003) exactly ──
// Set BOTH width and height so the content area matches the postcard's
// aspect — no letterbox/frame around the card.
function sizePostcard() {
  requestAnimationFrame(() => {
    if (window.matchMedia('(pointer: coarse), (max-width: 900px)').matches) return;
    const win = $('os-window');
    const TITLEBAR = 38;
    const ar = 1568 / 1003;
    const maxW = Math.min(window.innerWidth * 0.9, 960);
    const maxContentH = window.innerHeight * 0.9 - TITLEBAR;
    let w = maxW;
    let h = w / ar;
    if (h > maxContentH) { h = maxContentH; w = h * ar; }
    win.style.width  = Math.round(w) + 'px';
    win.style.height = Math.round(h + TITLEBAR) + 'px';
    $('os-content').style.overflow = 'hidden';
  });
}

// ── Woodshop slideshow wiring ──────────────────────────────
function wireWoodshop(contentEl, srcs) {
  if (!srcs?.length) return;
  const img = contentEl.querySelector('#ws-img');
  const ctr = contentEl.querySelector('#ws-counter');
  let i = 0;
  // Fit the window to each image so there's no black letterbox space.
  img.onload = () => sizeWoodshopToImage(img);
  if (img.complete && img.naturalWidth) sizeWoodshopToImage(img);
  const show = n => {
    i = (n + srcs.length) % srcs.length;
    img.src = srcs[i];
    ctr.textContent = (i + 1) + ' / ' + srcs.length;
  };
  contentEl.querySelector('#ws-next').onclick = () => show(i + 1);
  contentEl.querySelector('#ws-prev').onclick = () => show(i - 1);
  contentEl.querySelector('#ws-slide').onclick = e => {
    if (e.target.tagName !== 'BUTTON') show(i + 1);
  };
}

// Size the OS window to match the current woodshop image's aspect ratio
// (desktop only — on touch the window is forced full-screen via CSS).
function sizeWoodshopToImage(img) {
  if (!img || !img.naturalWidth) return;
  if (window.matchMedia('(pointer: coarse), (max-width: 900px)').matches) return;
  const win = $('os-window');
  const TITLEBAR = 38;
  const ar = img.naturalWidth / img.naturalHeight;
  const maxW = Math.min(window.innerWidth * 0.9, 1100);
  const maxContentH = window.innerHeight * 0.9 - TITLEBAR;
  let w = maxW;
  let h = w / ar;
  if (h > maxContentH) { h = maxContentH; w = h * ar; }
  win.style.width  = Math.round(w) + 'px';
  win.style.height = Math.round(h + TITLEBAR) + 'px';
}

// ── Decisions terminal game ────────────────────────────────
function startDecisionsGame() {
  let cancelled = false;
  const PERSON_COLORS = ['#ffbd2e','#e06c75','#56d3e8','#c678dd','#61afef','#e5c07b','#ff85a1'];
  let outputLines = [], inputResolver = null, isWaitingForInput = false, personColors = {};
  const MAX_LINES = 20;

  const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const colored = (t, c) => `<span style="color:${c}">${esc(t)}</span>`;
  const personSpan = n => colored(n, personColors[n] || '#00ff00');

  const flushOutput = () => {
    if (cancelled) return;
    const out = $('terminal-output'); if (!out) return;
    if (outputLines.length > MAX_LINES) outputLines = outputLines.slice(-MAX_LINES);
    out.innerHTML = outputLines.join('\n');
    out.scrollTop = out.scrollHeight;
  };
  const appendOutput = text => { text.split('\n').forEach(l => outputLines.push(esc(l))); flushOutput(); };
  const appendHTML   = html => { outputLines.push(html); flushOutput(); };
  const clearOutput  = () => { outputLines = []; const o = $('terminal-output'); if (o) o.innerHTML = ''; };

  const getInput = prompt => {
    if (cancelled) return Promise.resolve('');
    if (prompt) appendOutput(prompt);
    isWaitingForInput = true;
    const il = $('input-line'), fi = $('terminal-input');
    if (il) il.style.display = 'flex';
    if (fi) { fi.value = ''; fi.focus(); }
    return new Promise(r => { inputResolver = r; });
  };

  const handleSubmit = () => {
    if (!isWaitingForInput || !inputResolver) return;
    const fi = $('terminal-input');
    const val = fi ? fi.value : '';
    appendOutput(val + '\n');
    if (fi) fi.value = '';
    const il = $('input-line'); if (il) il.style.display = 'none';
    isWaitingForInput = false;
    const r = inputResolver; inputResolver = null; r(val);
  };

  const onKey = e => { if (!cancelled && e.key === 'Enter') { e.preventDefault(); handleSubmit(); } };
  const fi = $('terminal-input');
  if (fi) fi.addEventListener('keydown', onKey);

  const shuffle = a => {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
    return a;
  };

  const askInt = async (prompt, ok, errMsg) => {
    while (true) {
      if (cancelled) return null;
      const n = parseInt(await getInput(prompt));
      if (!isNaN(n) && ok(n)) return n;
      appendOutput(errMsg + '\n');
    }
  };

  async function run() {
    try {
      clearOutput(); personColors = {};
      const numPeople  = await askInt('Enter # of decision makers: ', n => n > 0, 'Please enter a positive number.');
      if (numPeople == null) return;
      const numOptions = await askInt('Enter # of options deciding between: ', n => n > 1, 'Please enter at least 2 options.');
      if (numOptions == null) return;

      const options = [];
      appendOutput('Enter the name of each option:\n');
      for (let i = 0; i < numOptions; i++) {
        if (cancelled) return;
        const name = (await getInput(`Option ${i+1}: `)).trim();
        options.push(name);
      }
      const people = shuffle(Array.from({length: numPeople}, (_, i) => `Person ${i+1}`));
      people.forEach((p, i) => { personColors[p] = PERSON_COLORS[i % PERSON_COLORS.length]; });
      appendOutput('\nELIMINATION PROCESS\n');

      let round = 1, pi = 0;
      while (options.length > 1) {
        if (cancelled) return;
        appendOutput(`\nRound ${round}\n`);
        appendOutput(`Remaining: ${options.join(', ')}\n`);
        appendHTML(`\n${personSpan(people[pi])}'s turn!`);
        appendOutput('Choose the option to ELIMINATE:\n');
        options.forEach((o, i) => appendOutput(`  ${i+1}. ${o}`));
        const choice = await askInt(`\nEnter number (1-${options.length}): `,
          n => n >= 1 && n <= options.length,
          `Please enter a number between 1 and ${options.length}.`);
        if (choice == null) return;
        const gone = options.splice(choice-1, 1)[0];
        appendHTML(`\n${personSpan(people[pi])} eliminated ${gone}!\n`);
        pi = (pi+1) % numPeople; round++;
      }
      appendOutput(`\nThe group has chosen: ${options[0]}\n`);
      await new Promise(r => setTimeout(r, 7000));
      if (!cancelled) run();
    } catch(e) { if (!cancelled) appendOutput('\nError: ' + e.message + '\n'); }
  }

  run();
  return () => { cancelled = true; if (fi) fi.removeEventListener('keydown', onKey); };
}

function closeWindow() {
  if (_windowCleanup) { _windowCleanup(); _windowCleanup = null; }
  lockZoom(false);
  $('os-overlay').classList.remove('open');
  document.body.style.overflow = ''; // restore background scroll
  const win = $('os-window');
  setTimeout(() => {
    $('os-content-inner').innerHTML = '';
    $('os-injected-style').textContent = '';
    win.style.width = ''; win.style.height = '';
    $('os-content').style.overflow = '';
  }, 250);
}

$('tl-close').addEventListener('click', closeWindow);
$('os-overlay').addEventListener('click', e => { if (e.target === $('os-overlay')) closeWindow(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeWindow(); });
// Back button closes window on mobile
window.addEventListener('popstate', e => {
  if ($('os-overlay').classList.contains('open')) closeWindow();
});

// ── Resizable window ───────────────────────────────────────
let _resize = null;
const MIN_W = 320, MIN_H = 200;
document.querySelectorAll('#os-window .resize-handle').forEach(handle => {
  handle.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const win = $('os-window');
    const rect = win.getBoundingClientRect();
    win.style.width  = rect.width  + 'px';
    win.style.height = rect.height + 'px';
    _resize = {
      dir: handle.dataset.dir,
      startX: e.clientX, startY: e.clientY,
      origW: rect.width, origH: rect.height
    };
  });
});
document.addEventListener('mousemove', e => {
  if (!_resize) return;
  const win = $('os-window');
  const dx = e.clientX - _resize.startX, dy = e.clientY - _resize.startY;
  const { dir, origW, origH } = _resize;
  if (dir === 'e'  || dir === 'se') win.style.width = Math.max(MIN_W, origW + dx) + 'px';
  if (dir === 'w'  || dir === 'sw') win.style.width = Math.max(MIN_W, origW - dx) + 'px';
  if (dir === 's'  || dir === 'se' || dir === 'sw') {
    win.style.height = Math.max(MIN_H, origH + dy) + 'px';
    $('os-content').style.overflow = 'auto';
  }
});
document.addEventListener('mouseup', () => { _resize = null; });

// ── Render items ───────────────────────────────────────────
function createItemEl(item) {
  const wrap = document.createElement('div');
  wrap.className = 'item';
  wrap.dataset.id = item.id;
  Object.assign(wrap.style, {
    top:    item.top    + '%',
    left:   item.left   + '%',
    width:  item.width  + '%',
    transform: `rotate(${item.rotate || 0}deg)`,
    zIndex: 10
  });
  if (item.embed) {
    // Live embed (e.g. the ClockClock24 clock). The embedded app centers its
    // content with a roughly constant pixel margin, so render at a large fixed
    // reference size (where that margin is a tiny fraction) and scale uniformly
    // to the item's slot — minimal blank space, no fragile per-frame cropping.
    // pointer-events off so the item stays draggable in edit mode.
    const ar = item.aspect || '8 / 3';
    const refW = 1280, refH = 480; // 8:3 reference; app margin ≈ a few % here
    wrap.style.aspectRatio = ar;
    // A "fluid" embed lays itself out to whatever box it is given (the Amtrak
    // map's canvas is width:100%), so it needs no reference-size scaling.
    const fluid = !!item.fluid;
    wrap.style.overflow = 'hidden';
    wrap.style.borderRadius = '4px';
    wrap.style.position = 'absolute'; // containing block for the iframe (already abs on fridge)
    const frame = document.createElement('iframe');
    const _embedSrc = item.embed;
    const _loadEmbed = () => { if (!frame.src) frame.src = _embedSrc; };
    if (fluid) {
      // The map is a prominent magnet: fetch it right away, in parallel with
      // the fridge's own images, so it doesn't pop in seconds later.
      frame.loading = 'eager';
      _loadEmbed();
    } else {
      // Heavier embeds (the clock's ~150KB React app) wait for the browser to
      // go idle so they don't compete for the initial bandwidth.
      frame.loading = 'lazy';
      if ('requestIdleCallback' in window) requestIdleCallback(_loadEmbed, { timeout: 1500 });
      else setTimeout(_loadEmbed, 600);
    }
    frame.setAttribute('scrolling', 'no');
    // position:absolute keeps the iframe's 480px layout height out of flow, so
    // the item box is only as tall as its aspect-ratio (no oversized hit area).
    frame.style.cssText = fluid
      ? 'position:absolute; top:0; left:0; width:100%; height:100%; border:none; display:block; pointer-events:none; background:transparent;'
      : `position:absolute; top:0; left:0; width:${refW}px; height:${refH}px; border:none; display:block; pointer-events:none; transform-origin:top left; background:transparent;`;
    wrap.appendChild(frame);
    if (!fluid) {
      const fit = () => { const w = wrap.clientWidth; if (w) frame.style.transform = `scale(${w / refW})`; };
      if (window.ResizeObserver) new ResizeObserver(fit).observe(wrap);
      requestAnimationFrame(fit);
      frame.addEventListener('load', () => fit());
    }
  } else {
    const img = document.createElement('img');
    img.src = encodeURI(item.src);
    img.loading = 'lazy';
    img.draggable = false;
    wrap.appendChild(img);
  }
  if (item.hoverLabel && !isPostcardOnTouch(item)) {
    const label = document.createElement('span');
    label.className = 'item-hover-label';
    label.textContent = item.hoverLabel;
    wrap.appendChild(label);
  }
  return wrap;
}

function renderItems() {
  const fridge = $('fridge');
  ITEMS.forEach(item => {
    const el = createItemEl(item);
    fridge.appendChild(el);
    if (isEditMode) {
      el.style.cursor = 'move';
      makeDraggable(el);
    } else if (item.windowEmbed) {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => openEmbedWindow(item.windowEmbed, item.windowTitle || item.hoverLabel, item.aspect));
    } else if (item.href && !isPostcardOnTouch(item)) {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => openWindow(item.href, item.windowTitle || item.hoverLabel || item.href));
    }
  });
}

const activeDrags = new Set(); // letters currently being dragged by this user

function renderLetters(savedPositions) {
  const fridge = $('fridge');
  LETTER_SET.forEach((letter, i) => {
    const el = document.createElement('div');
    el.className = 'letter';
    el.textContent = letter.char;
    el.dataset.id = letter.id;
    el.style.color = letter.color;
    const pos = savedPositions[letter.id] || letterDefaultPos(i);
    el.style.left = pos.left + '%';
    el.style.top  = pos.top  + '%';
    fridge.appendChild(el);
    el.addEventListener('pointerdown', () => activeDrags.add(letter.id));
    makeDraggable(el, el => {
      activeDrags.delete(letter.id);
      db.ref(`letters/${letter.id}`).set({
        left: parseFloat(el.style.left), top: parseFloat(el.style.top)
      });
    }, true);
  });
}

// ── Init ───────────────────────────────────────────────────
renderItems();

// On desktop, restore saved webring position + size (set in edit mode).
// On mobile / touch, the CSS media query pins the webring above the
// ventilation strip — skip restore so saved values can't override it.
const _isTouch = window.matchMedia('(pointer: coarse), (max-width: 900px)').matches;
if (!_isTouch) {
  try {
    const rp = JSON.parse(localStorage.getItem('ringPos') || 'null');
    if (rp) {
      const w = $('ring-wrap');
      if (rp.top    != null) w.style.top    = rp.top    + '%';
      if (rp.left   != null) w.style.left   = rp.left   + '%';
      if (rp.width  != null) w.style.width  = rp.width  + '%';
      if (rp.height != null) w.style.height = rp.height + '%';
    }
  } catch (e) {}
}

function saveRingPos() {
  const w = $('ring-wrap');
  localStorage.setItem('ringPos', JSON.stringify({
    top:    parseFloat(w.style.top    || getComputedStyle(w).top),
    left:   parseFloat(w.style.left   || getComputedStyle(w).left),
    width:  parseFloat(w.style.width  || getComputedStyle(w).width),
    height: parseFloat(w.style.height || getComputedStyle(w).height)
  }));
}

// Make webring draggable + resizable in edit mode (desktop only)
if (isEditMode && !_isTouch) {
  const ring = $('ring-wrap');
  makeDraggable(ring, saveRingPos);

  // Resize handle (corner) — independent width/height scaling
  const rh = document.createElement('div');
  rh.className = 'resize-handle';
  ring.appendChild(rh);
  rh.addEventListener('pointerdown', e => {
    e.stopPropagation(); e.preventDefault();
    rh.setPointerCapture(e.pointerId);
    const cRect = $('fridge').getBoundingClientRect();
    const ringRect = ring.getBoundingClientRect();
    const sX = e.clientX, sY = e.clientY;
    const sW = ringRect.width  / cRect.width  * 100;
    const sH = ringRect.height / cRect.height * 100;
    const onMove = e => {
      const dx = (e.clientX - sX) / cRect.width  * 100;
      const dy = (e.clientY - sY) / cRect.height * 100;
      ring.style.width  = Math.max(5, Math.round((sW + dx) * 10) / 10) + '%';
      ring.style.height = Math.max(2, Math.round((sH + dy) * 10) / 10) + '%';
    };
    const onUp = () => {
      rh.removeEventListener('pointermove', onMove);
      rh.removeEventListener('pointerup',   onUp);
      saveRingPos();
    };
    rh.addEventListener('pointermove', onMove);
    rh.addEventListener('pointerup',   onUp);
  });
}

if (isEditMode) {
  // Layout editor: drag to move, click an item to select, then resize
  // (−/+) or delete it. "Copy layout" exports the arrangement.
  const _meta = Object.fromEntries(ITEMS.map(it => [it.id, it]));
  let _sel = null;
  const selectItem = el => {
    if (_sel) _sel.style.outline = '';
    _sel = el || null;
    if (_sel) _sel.style.outline = '2px solid #f6d400';
    _bar.style.display = _sel ? 'flex' : 'none';
  };
  const resize = d => { if (_sel) _sel.style.width = Math.max(2, (parseFloat(_sel.style.width) || 10) + d) + '%'; };
  const del = () => { if (_sel) { _sel.remove(); selectItem(null); } };
  // Clone the selected magnet: same image, a new id, nudged so it's visible.
  // Registering it in _meta means Copy layout exports it like any other item.
  const dup = () => {
    if (!_sel) return;
    const base = _meta[_sel.dataset.id];
    if (!base || base.embed) return;   // duplicate image magnets, not the live embeds/board
    const clone = Object.assign({}, base, {
      id: 'item_' + Date.now(),
      top:   +(parseFloat(_sel.style.top)  + 4).toFixed(3),
      left:  +(parseFloat(_sel.style.left) + 4).toFixed(3),
      width: +(parseFloat(_sel.style.width) || base.width).toFixed(3)
    });
    _meta[clone.id] = clone;
    const el = createItemEl(clone);
    $('fridge').appendChild(el);
    el.style.cursor = 'move';
    makeDraggable(el);
    el.addEventListener('pointerdown', () => selectItem(el));
    selectItem(el);
  };
  const _bar = document.createElement('div');
  _bar.style.cssText = 'position:fixed;bottom:60px;right:16px;z-index:100000;display:none;gap:6px';
  const _mk = (t, fn, bg) => { const b = document.createElement('button'); b.textContent = t; b.style.cssText = 'padding:10px 13px;background:' + (bg || '#333') + ';color:#fff;border:none;border-radius:6px;font:600 15px -apple-system,sans-serif;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.4)'; b.onclick = fn; _bar.appendChild(b); };
  _mk('−', () => resize(-0.5));
  _mk('+', () => resize(0.5));
  _mk('Duplicate', dup, '#2d7d46');
  _mk('Delete', del, '#c0392b');
  document.body.appendChild(_bar);
  // Editable tic-tac-toe board placeholder (the live game is off in edit mode)
  const _ttt = document.createElement('div');
  _ttt.className = 'item';
  _ttt.dataset.id = 'ttt-board';
  _ttt.dataset.ttt = '1';
  Object.assign(_ttt.style, { position: 'absolute', top: TTT_POS.top + '%', left: TTT_POS.left + '%', width: TTT_POS.width + '%', aspectRatio: '1 / 1', zIndex: 12, cursor: 'move', boxSizing: 'border-box' });
  _ttt.style.backgroundImage = 'linear-gradient(#fff,#fff),linear-gradient(#fff,#fff),linear-gradient(#fff,#fff),linear-gradient(#fff,#fff)';
  _ttt.style.backgroundSize = '2px 100%,2px 100%,100% 2px,100% 2px';
  _ttt.style.backgroundPosition = '33.33% 0,66.66% 0,0 33.33%,0 66.66%';
  _ttt.style.backgroundRepeat = 'no-repeat';
  $('fridge').appendChild(_ttt);
  makeDraggable(_ttt);
  document.querySelectorAll('.item').forEach(el => el.addEventListener('pointerdown', () => selectItem(el)));
  document.addEventListener('keydown', e => {
    if (!_sel) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); del(); }
    else if (e.key === 'd' || e.key === 'D') dup();
    else if (e.key === '+' || e.key === '=') resize(0.5);
    else if (e.key === '-' || e.key === '_') resize(-0.5);
  });
  const _btn = document.createElement('button');
  _btn.textContent = 'Copy layout';
  _btn.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:100000;padding:12px 16px;background:#f6d400;color:#111;border:none;border-radius:6px;font:600 14px -apple-system,sans-serif;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.4)';
  document.body.appendChild(_btn);
  _btn.addEventListener('click', () => {
    const updated = [...document.querySelectorAll('.item')].map(el => {
      const base = _meta[el.dataset.id]; if (!base) return null;
      const rot = (el.style.transform.match(/rotate\(([-0-9.]+)deg\)/) || [])[1];
      return Object.assign({}, base, {
        top:   +parseFloat(el.style.top).toFixed(3),
        left:  +parseFloat(el.style.left).toFixed(3),
        width: +parseFloat(el.style.width).toFixed(3),
        rotate: rot ? +rot : (base.rotate || 0)
      });
    }).filter(Boolean);
    let json = 'let ITEMS = [\n' + updated.map(it => '  ' + JSON.stringify(it)).join(',\n') + '\n];';
    const _tt = document.querySelector('[data-ttt]');
    if (_tt) json += '\n\nconst TTT_POS = { top: ' + (+parseFloat(_tt.style.top).toFixed(3)) + ', left: ' + (+parseFloat(_tt.style.left).toFixed(3)) + ', width: ' + (+parseFloat(_tt.style.width).toFixed(3)) + ' };';
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:100001;display:flex;flex-direction:column;padding:16px;gap:8px';
    const st = document.createElement('div');
    st.textContent = 'Copy this and paste it back to Claude.';
    st.style.cssText = 'color:#f6d400;font:12px -apple-system,sans-serif';
    const ta = document.createElement('textarea');
    ta.value = json;
    ta.style.cssText = 'flex:1;width:100%;font-family:"Courier New",monospace;font-size:11px;padding:10px;background:#111;color:#0f0;border:1px solid #333;resize:none';
    const rw = document.createElement('div');
    rw.style.cssText = 'display:flex;gap:8px';
    const cp = document.createElement('button');
    cp.textContent = 'Copy';
    cp.style.cssText = 'flex:1;padding:14px;background:#f6d400;color:#111;border:none;font-size:14px;font-weight:bold;border-radius:4px';
    const cl = document.createElement('button');
    cl.textContent = 'Close';
    cl.style.cssText = 'flex:1;padding:14px;background:#333;color:#fff;border:none;font-size:14px;border-radius:4px';
    rw.appendChild(cp); rw.appendChild(cl);
    ov.appendChild(st); ov.appendChild(ta); ov.appendChild(rw);
    document.body.appendChild(ov);
    cp.onclick = () => {
      ta.focus(); ta.setSelectionRange(0, ta.value.length);
      let ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(json).then(() => st.textContent = '✓ Copied').catch(() => {});
      else st.textContent = ok ? '✓ Copied' : 'Long-press the text → Select All → Copy';
    };
    cl.onclick = () => ov.remove();
    setTimeout(() => { ta.focus(); ta.setSelectionRange(0, ta.value.length); }, 50);
  });
}

// ── Tic-tac-toe: communal live game (shared via Firebase) ──────────
// Each visitor plays as whoever's turn it is and makes one move; after a
// move they're locked until someone else moves (lastMoveBy guard). Board
// clears on win/draw; X-vs-O win totals persist in the scoreboard.
// TTT_POS is declared up near ITEMS so edit mode can position the board.
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
  el.innerHTML = '<div id="ttt-status"></div><div class="ttt-board-wrap"><div id="ttt-grid"></div><div id="ttt-scoreboard"></div></div>';
  $('fridge').appendChild(el);
  const statusEl = el.querySelector('#ttt-status');
  const sbEl = el.querySelector('#ttt-scoreboard');

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
    // Score readout removed — keep the finished board (with the winning
    // line highlighted) on screen briefly, then reset. No scoreboard.
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
// Start Firebase + tic-tac-toe once the deferred SDK has executed.
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startFirebase);
else startFirebase();

// ── Mobile/touch: center the scroll on the fridge after it lays out ──
if (window.matchMedia('(pointer: coarse), (max-width: 900px)').matches
    && !window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
  const centerScroll = () => {
    const f = $('fridge');
    const r = f.getBoundingClientRect();
    const fcx = r.left + window.scrollX + r.width  / 2;
    const fcy = r.top  + window.scrollY + r.height / 2;
    window.scrollTo(fcx - window.innerWidth / 2, fcy - window.innerHeight / 2);
  };
  const bg = document.querySelector('.fridge-bg');
  if (bg && bg.complete) requestAnimationFrame(centerScroll);
  else if (bg) bg.addEventListener('load', centerScroll);
  else window.addEventListener('load', centerScroll);
}

// ── Zoom / pan (desktop only) ──────────────────────────────
if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
  const zFridge = $('fridge');
  let zoom = 1, panX = 0, panY = 0;
  const MIN_ZOOM = 0.3, MAX_ZOOM = 5;
  const applyTransform = () => { zFridge.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`; };

  const initZoom = () => {
    const fW = zFridge.offsetWidth, fH = zFridge.offsetHeight;
    // Bail until the fridge and viewport actually have dimensions — otherwise
    // zoom computes to 0 (scale(0) → blank fridge). Retry next frame; the load
    // and resize handlers below also re-run it once layout settles.
    if (!fW || !fH || !window.innerWidth || !window.innerHeight) {
      requestAnimationFrame(initZoom);
      return;
    }
    zoom = Math.min((window.innerWidth * 1.05) / fW, (window.innerHeight * 1.05) / fH);
    panX = (window.innerWidth  - fW * zoom) / 2;
    panY = (window.innerHeight - fH * zoom) / 2;
    applyTransform();
  };
  const bgImg = zFridge.querySelector('.fridge-bg');
  bgImg.complete ? initZoom() : bgImg.addEventListener('load', initZoom);

  const windowOpen = () => $('os-overlay').classList.contains('open');

  document.addEventListener('wheel', e => {
    if (windowOpen()) return;
    e.preventDefault();
    const delta = e.deltaY !== 0 ? e.deltaY : -e.deltaX;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * (delta < 0 ? 1.08 : 0.93)));
    const fx = (e.clientX - panX) / zoom, fy = (e.clientY - panY) / zoom;
    zoom = newZoom;
    panX = e.clientX - fx * zoom;
    panY = e.clientY - fy * zoom;
    applyTransform();
  }, { passive: false });

  let panning = false, panStart = {x:0,y:0}, panOrigin = {x:0,y:0};
  document.addEventListener('pointerdown', e => {
    if (windowOpen()) return;
    if (e.target !== zFridge && !e.target.classList.contains('fridge-bg')) return;
    panning = true;
    document.body.style.cursor = 'grabbing';
    panStart  = { x: e.clientX, y: e.clientY };
    panOrigin = { x: panX, y: panY };
  });
  document.addEventListener('pointermove', e => {
    if (!panning) return;
    panX = panOrigin.x + (e.clientX - panStart.x);
    panY = panOrigin.y + (e.clientY - panStart.y);
    applyTransform();
  });
  document.addEventListener('pointerup', () => {
    panning = false;
    document.body.style.cursor = '';
  });
}
