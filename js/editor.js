// ── Layout editor (only loads with ?edit) ─────────────────────
// Drag magnets, the webring and the page-views note around; click a magnet to
// select it, then −/+ to resize, Duplicate, or Delete. "Copy layout" exports
// the arrangement to paste into js/layout.js (VIEWS_POS goes in styles.css).
(function () {
let maxZ = 100;
function makeDraggable(el, onDrop) {
  el.addEventListener('pointerdown', e => {
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    el.style.zIndex = ++maxZ;

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

// Webring: position + size are saved in this browser (js/fridge.js restores them)
function saveRingPos() {
  const w = $('ring-wrap');
  localStorage.setItem('ringPos', JSON.stringify({
    top:    parseFloat(w.style.top    || getComputedStyle(w).top),
    left:   parseFloat(w.style.left   || getComputedStyle(w).left),
    width:  parseFloat(w.style.width  || getComputedStyle(w).width),
    height: parseFloat(w.style.height || getComputedStyle(w).height)
  }));
}

// Webring: draggable + resizable (desktop only)
if (!IS_TOUCH) {
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

// Page-views note: drag to move; drag the corner handle to scale (font-size in
// cqw). Its position lives only in CSS, so nothing is saved here: read the
// values off "Copy layout" (VIEWS_POS) and bake them into styles.css.
{
  const v = $('views-magnet');
  v.hidden = false;                 // show it for editing even before Firebase answers
  v.style.cursor = 'move';
  makeDraggable(v);

  const vh = document.createElement('div');
  vh.style.cssText = 'position:absolute;right:-6px;bottom:-6px;width:14px;height:14px;background:#f6d400;border:1px solid #111;border-radius:2px;cursor:nwse-resize;z-index:10';
  v.appendChild(vh);
  vh.addEventListener('pointerdown', e => {
    e.stopPropagation(); e.preventDefault();
    vh.setPointerCapture(e.pointerId);
    const cRect = $('fridge').getBoundingClientRect();
    const sX = e.clientX;
    const startSize = parseFloat(v.style.fontSize) ||
                      (parseFloat(getComputedStyle(v).fontSize) / cRect.width * 100);
    const onMove = e => {
      const dx = (e.clientX - sX) / cRect.width * 100;
      v.style.fontSize = Math.max(0.2, Math.round((startSize + dx) * 100) / 100) + 'cqw';
    };
    const onUp = () => {
      vh.removeEventListener('pointermove', onMove);
      vh.removeEventListener('pointerup',   onUp);
    };
    vh.addEventListener('pointermove', onMove);
    vh.addEventListener('pointerup',   onUp);
  });
}

// Magnets
{
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
  document.querySelectorAll('.item').forEach(el => {
    if (el !== _ttt) { el.style.cursor = 'move'; makeDraggable(el); }
    el.addEventListener('pointerdown', () => selectItem(el));
  });
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
    const _vm = $('views-magnet');
    if (_vm) {
      const vt = _vm.style.top      ? +parseFloat(_vm.style.top).toFixed(3)  : 61;
      const vl = _vm.style.left     ? +parseFloat(_vm.style.left).toFixed(3) : 26;
      const vs = _vm.style.fontSize ? +parseFloat(_vm.style.fontSize)        : 1.3;
      json += '\n\nconst VIEWS_POS = { top: ' + vt + ', left: ' + vl + ', size: ' + vs + ' };';
    }
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
})();
