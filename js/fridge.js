// ── The fridge: magnets, plus zoom/pan (desktop) and centering (phones) ──
// Magnet positions live in js/layout.js. Exposes createItemEl (the editor
// uses it to duplicate magnets).

// One picture per calendar day (visitor's local date), cycling through the list
function pickDaily(srcs) {
  const now = new Date();
  const day = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
  return srcs[day % srcs.length];
}

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
    const refW = 1280, refH = 480; // 8:3 reference; app margin ≈ a few % here
    wrap.style.aspectRatio = item.aspect || '8 / 3';
    // A "fluid" embed lays itself out to whatever box it is given (the Amtrak
    // map's canvas is width:100%), so it needs no reference-size scaling.
    const fluid = !!item.fluid;
    wrap.style.position = 'absolute'; // containing block for the iframe (already abs on fridge)
    // The iframe is clipped by an inner box, not the item itself, so the item's
    // hover label can still sit above it (e.g. "Live Amtrak").
    const clip = document.createElement('div');
    clip.style.cssText = `position:absolute; inset:0; overflow:hidden; border-radius:${item.square ? '0' : '4px'};`;   // square: a printed card, e.g. the rides map
    wrap.appendChild(clip);
    const frame = document.createElement('iframe');
    const load = () => { if (!frame.src) frame.src = item.embed; };
    if (fluid) {
      // The maps are prominent magnets: fetch them right away, in parallel with
      // the fridge's own images, so they don't pop in seconds later.
      frame.loading = 'eager';
      load();
    } else {
      // Heavier embeds (the clock's ~150KB React app) wait for the browser to
      // go idle so they don't compete for the initial bandwidth.
      frame.loading = 'lazy';
      whenIdle(load);
    }
    frame.setAttribute('scrolling', 'no');
    // position:absolute keeps the iframe's 480px layout height out of flow, so
    // the item box is only as tall as its aspect-ratio (no oversized hit area).
    frame.style.cssText = fluid
      ? 'position:absolute; top:0; left:0; width:100%; height:100%; border:none; display:block; pointer-events:none; background:transparent;'
      : `position:absolute; top:0; left:0; width:${refW}px; height:${refH}px; border:none; display:block; pointer-events:none; transform-origin:top left; background:transparent;`;
    clip.appendChild(frame);
    if (!fluid) {
      const fit = () => { const w = wrap.clientWidth; if (w) frame.style.transform = `scale(${w / refW})`; };
      if (window.ResizeObserver) new ResizeObserver(fit).observe(wrap);
      requestAnimationFrame(fit);
      frame.addEventListener('load', fit);
    }
  } else {
    const img = document.createElement('img');
    img.src = encodeURI(item.daily ? pickDaily(item.daily) : item.src);
    if (item.daily) {
      // Every daily picture is cropped to the same card shape, so overlays
      // like the "about me" label stay put whatever the photo's proportions.
      img.style.aspectRatio = item.aspect;
      img.style.objectFit = 'cover';
    }
    img.loading = 'lazy';
    img.draggable = false;
    wrap.appendChild(img);
  }
  if (item.hoverLabel) {
    const label = document.createElement('span');
    label.className = 'item-hover-label';
    label.textContent = item.hoverLabel;
    wrap.appendChild(label);
  }
  return wrap;
}

(function renderItems() {
  const fridge = $('fridge');
  ITEMS.forEach(item => {
    const el = createItemEl(item);
    fridge.appendChild(el);
    if (isEditMode) return;   // js/editor.js makes them draggable instead
    const open = item.windowEmbed
      ? () => openEmbedWindow(item.windowEmbed, item.windowTitle || item.hoverLabel, item.aspect)
      : item.href && (() => openWindow(item.href, item.windowTitle || item.hoverLabel || item.href));
    if (open) {
      el.style.cursor = 'pointer';
      el.classList.add('clickable');
      el.addEventListener('click', open);
    } else if (item.passthrough) {
      // Decorative overlay (e.g. the "about me" label on the dog card): let hover
      // and clicks fall through to the clickable magnet beneath it.
      el.style.pointerEvents = 'none';
    }
  });
})();

if (isEditMode) loadScript('js/editor.js?v=1');

// On desktop, restore the webring position + size saved in edit mode. On
// touch, CSS pins the webring above the ventilation strip, so skip it there.
if (!IS_TOUCH) {
  try {
    const rp = JSON.parse(localStorage.getItem('ringPos') || 'null');
    if (rp) {
      const w = $('ring-wrap');
      for (const k of ['top', 'left', 'width', 'height']) if (rp[k] != null) w.style[k] = rp[k] + '%';
    }
  } catch (e) {}
}

// ── Phones: center the scroll on the fridge once it has laid out ──
if (IS_TOUCH && !FINE_POINTER) {
  const centerScroll = () => {
    const r = $('fridge').getBoundingClientRect();
    scrollTo(r.left + scrollX + r.width / 2 - innerWidth / 2, r.top + scrollY + r.height / 2 - innerHeight / 2);
  };
  const bg = document.querySelector('.fridge-bg');
  if (bg && bg.complete) requestAnimationFrame(centerScroll);
  else if (bg) bg.addEventListener('load', centerScroll);
  else addEventListener('load', centerScroll);
}

// ── Desktop: wheel to zoom, drag the fridge to pan ──
if (FINE_POINTER) {
  const zFridge = $('fridge');
  let zoom = 1, panX = 0, panY = 0;
  const MIN_ZOOM = 0.3, MAX_ZOOM = 5;
  const applyTransform = () => { zFridge.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`; };

  const initZoom = () => {
    const fW = zFridge.offsetWidth, fH = zFridge.offsetHeight;
    // Bail until the fridge and viewport actually have dimensions — otherwise
    // zoom computes to 0 (scale(0) → blank fridge). Retry next frame.
    if (!fW || !fH || !innerWidth || !innerHeight) { requestAnimationFrame(initZoom); return; }
    zoom = Math.min((innerWidth * 1.05) / fW, (innerHeight * 1.05) / fH);
    panX = (innerWidth  - fW * zoom) / 2;
    panY = (innerHeight - fH * zoom) / 2;
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

  let panning = false, panStart = { x: 0, y: 0 }, panOrigin = { x: 0, y: 0 };
  document.addEventListener('pointerdown', e => {
    if (windowOpen()) return;
    if (e.target !== zFridge && !e.target.closest('.fridge-bg, .door-pan')) return;   // the door and the inside pan too
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
