// ── Fridge door: pull the lower handle to open the fridge ─────
// What you see inside is not drawn here: it is two physically rendered images
// (made by _fridge/render.py, from a 3D model matched to the fridge photo):
//   fridge/interior.webp  the cavity with the door out of the way
//   fridge/open.webp      the same view with the door hanging open at 112°
//
// Opening: the door's front (a crop of the photo, plus every magnet on it)
// swings on its right-hand hinge to edge-on, showing the cavity behind it; as it
// turns out of sight the rendered open door fades in where it comes to rest.
// The magnets are never re-parented: each gets the same rotation about the same
// hinge line under one shared perspective, so their links, hover labels and
// positions stay exactly as js/fridge.js made them.
(function () {
  if (isEditMode) return;   // layout editing keeps the plain, closed fridge

  const fridge = $('fridge');
  const IMG    = { w: 1024, h: 1536 };                  // fridge2.jpg
  const DOOR   = { x: 250, y: 503, w: 522, h: 811 };    // lower door, in photo pixels
  const HANDLE = { x: 284, y: 524, w: 196, h: 46 };     // its chrome handle
  const OPEN   = { x: 250, y: 430, w: 935, h: 1021 };   // what fridge/open.webp covers (see FX0…FY1 in render.py)
  const FLOOR  = { x: 770, y: 1392, w: 400, h: 70 };    // where the open door's shadow falls
  const HINGE  = { inset: 9, depth: 11 };               // hinge pin: px in from the door's right edge, px behind its face
  const CAMERA = 2733;                                  // the photo's camera distance, in photo px (3 m)
  const STILL  = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SWING_MS = STILL ? 0 : 560, FADE_MS = STILL ? 0 : 200, CLOSE_MS = STILL ? 0 : 460;
  const V = '?v=3';

  const pct = r => ({ left: r.x / IMG.w * 100 + '%', top: r.y / IMG.h * 100 + '%',
                      width: r.w / IMG.w * 100 + '%', height: r.h / IMG.h * 100 + '%' });
  const el = (tag, cls, style) => { const e = document.createElement(tag); if (cls) e.className = cls; if (style) Object.assign(e.style, style); return e; };

  // ── Pieces ──
  const interior = el('img', 'door-interior door-pan', pct(DOOR));
  const openView = el('img', 'door-open', pct(OPEN));
  [interior, openView].forEach(i => { i.alt = ''; i.draggable = false; i.decoding = 'async'; });

  const panel = el('div', 'door-panel door-pan', pct(DOOR));
  const crop = el('img', '', { left: -DOOR.x / DOOR.w * 100 + '%', top: -DOOR.y / DOOR.h * 100 + '%', width: IMG.w / DOOR.w * 100 + '%' });
  crop.src = 'fridge2.jpg'; crop.alt = ''; crop.draggable = false;
  panel.appendChild(crop);

  const handle = el('button', 'item door-handle', pct(HANDLE));
  handle.type = 'button';
  handle.setAttribute('aria-label', 'Open the fridge');
  handle.setAttribute('aria-expanded', 'false');
  const hint = el('span', 'item-hover-label'); hint.textContent = 'Open'; handle.appendChild(hint);

  const floor = el('div', 'door-floor', pct(FLOOR));
  fridge.querySelector('.fridge-bg').after(floor, interior, openView, panel, handle);

  // The renders are ~0.5 MB: fetch them once the page is idle (or the moment the handle is touched)
  let loaded = null;
  const load = () => loaded = loaded || Promise.all([[interior, 'fridge/interior.webp'], [openView, 'fridge/open.webp']].map(([img, src]) => {
    img.src = src + V;
    return img.decode().catch(() => {});
  }));
  whenIdle(load, 4000);
  ['pointerenter', 'touchstart', 'focus'].forEach(ev => handle.addEventListener(ev, load, { once: true, passive: true }));

  // ── Swing ──
  let state = 'closed', group = null, saved = new Map(), timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

  // Everything that sits on the lower door turns with it
  function doorGroup() {
    const fw = fridge.offsetWidth, fh = fridge.offsetHeight, k = fw / IMG.w;
    const r = { l: DOOR.x * k, t: DOOR.y / IMG.h * fh, w: DOOR.w * k, h: DOOR.h / IMG.h * fh };
    const onDoor = e => {
      if (e.hidden || !e.offsetWidth) return false;
      const cx = e.offsetLeft + e.offsetWidth / 2, cy = e.offsetTop + e.offsetHeight / 2;
      return cx > r.l && cx < r.l + r.w && cy > r.t && cy < r.t + r.h;
    };
    const magnets = [...fridge.querySelectorAll('.item'), $('views-magnet'), $('ring-wrap')]
      .filter(e => e && e !== handle && onDoor(e));
    // Same perspective as the photo and the renders: the camera, level with the photo's centre
    fridge.style.perspective = Math.round(CAMERA * k) + 'px';
    fridge.style.perspectiveOrigin = '50% 50%';
    return { hingeX: r.l + r.w - HINGE.inset * k, depth: HINGE.depth * k, members: [panel, handle, ...magnets] };
  }

  // Turn every member about the hinge pin: move to it, rotate, move back, then its own transform
  function setAngle(deg, ms, ease) {
    group.members.forEach(e => {
      const H = group.hingeX - (e.offsetLeft + e.offsetWidth / 2), Z = group.depth;
      e.style.transition = ms ? `transform ${ms}ms ${ease}` : 'none';
      e.style.transform = `translateX(${H}px) translateZ(${-Z}px) rotateY(${deg}deg) translateZ(${Z}px) translateX(${-H}px) ${saved.get(e).base}`;
    });
  }

  // On a phone the fridge fills the screen and the hinge sits at its edge, so the view
  // pulls back and slides over until the opening and the open door both fit on screen.
  // (Transforms, not scrolling: mobile browsers disagree on scripted scrolling when zoomed.)
  function reframe(on, ms, ease) {
    if (!(IS_TOUCH && !FINE_POINTER)) return;
    let x = 0, k = 1;
    if (on) {
      const r = panel.getBoundingClientRect(), f = fridge.getBoundingClientRect(), vv = window.visualViewport;
      const viewL = vv ? vv.offsetLeft : 0, viewW = vv ? vv.width : innerWidth;
      const span = r.width * OPEN.w / DOOR.w;
      k = Math.min(1, (viewW - 16) / span);
      const ox = f.left + f.width / 2;                      // scale() works about the top centre
      x = viewL + (viewW - span * k) / 2 - (ox + (r.left - ox) * k);
    }
    fridge.style.transformOrigin = '50% 0';
    fridge.style.transition = ms ? `translate ${ms}ms ${ease}, scale ${ms}ms ${ease}` : '';
    fridge.style.translate = on ? `${x}px 0` : '';
    fridge.style.scale = on ? String(k) : '';
  }

  async function open() {
    if (state !== 'closed') return;
    state = 'opening';
    await load();
    clearTimers();
    group = doorGroup();
    saved = new Map(group.members.map(e => {
      const inline = e.style.transform, computed = getComputedStyle(e).transform;
      return [e, { inline, base: inline || (computed === 'none' ? '' : computed) }];
    }));
    group.members.forEach(e => e.classList.add('door-member'));
    fridge.classList.add('fridge-open');
    handle.setAttribute('aria-expanded', 'true');
    setAngle(0, 0);
    void fridge.offsetWidth;                                // start the swing from closed
    requestAnimationFrame(() => {
      setAngle(90, SWING_MS, 'cubic-bezier(.45,.02,.75,.55)');   // the seal lets go, then it gathers speed
      reframe(true, SWING_MS + FADE_MS, 'cubic-bezier(.45,.05,.25,1)');
    });
    // As the door front turns edge-on, the rendered open door takes over
    later(() => fridge.classList.add('door-ajar'), SWING_MS * 0.82);
    later(() => { group.members.forEach(e => e.classList.add('door-gone')); state = 'open'; }, SWING_MS);
  }

  function close() {
    if (state !== 'open' && state !== 'opening') return;
    if (!group) return;                                     // still loading: nothing has moved yet
    state = 'closing';
    clearTimers();
    fridge.classList.remove('door-ajar');
    group.members.forEach(e => e.classList.remove('door-gone'));
    handle.setAttribute('aria-expanded', 'false');
    setAngle(0, CLOSE_MS, 'cubic-bezier(.3,.2,.4,1)');
    reframe(false, CLOSE_MS, 'cubic-bezier(.55,0,.8,.4)');
    later(() => {
      group.members.forEach(e => {                          // put everything back exactly
        e.style.transition = '';
        e.style.transform = saved.get(e).inline;
        e.classList.remove('door-member');
      });
      fridge.classList.remove('fridge-open');
      fridge.style.transition = '';
      group = null;
      state = 'closed';
    }, CLOSE_MS);
  }

  handle.addEventListener('click', e => { e.stopPropagation(); open(); });

  // A click anywhere shuts the door: inside it, on the fridge, or on the wall around it.
  // Not a pan-drag, though, and not a click that is opening one of the other magnets.
  let down = null;
  document.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; }, true);
  document.addEventListener('click', e => {
    if (state !== 'open') return;
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
    if (e.target.closest('.item.clickable, #ring-wrap, #os-overlay, a, button')) return;
    close();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !$('os-overlay').classList.contains('open')) close();
  });
})();
