// ── Fridge door: pull the lower handle to open the fridge ─────────────────
// The lower door is cut out of the fridge photo as its own panel. It swings on
// its right-hand hinge together with every magnet that sits on it: each one gets
// the same rotation about the same hinge line, under one shared perspective on
// #fridge, so they move as one door without being re-parented (their links,
// hover labels and edit-mode code all stay exactly as they are).
// Runs after app.js; uses its $, isEditMode and openWindow.
(function () {
  if (isEditMode) return;   // layout editing keeps the plain, closed fridge

  const fridge = $('fridge');
  const IMG = { w: 1024, h: 1536 };                    // fridge2.jpg
  const DOOR   = { x: 250, y: 503,  w: 522, h: 811 };  // lower door, in photo pixels
  const HANDLE = { x: 284, y: 524,  w: 196, h: 46 };   // its chrome handle
  const FLOOR  = { x: 770, y: 1398, w: 380, h: 58 };    // where the open door's shadow falls
  const OPEN_DEG = 115;
  const STILL = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const OPEN_MS = STILL ? 0 : 1200, CLOSE_MS = STILL ? 0 : 560;
  // Phones show the fridge zoomed in (see slide())
  const TOUCH = window.matchMedia('(pointer: coarse), (max-width: 900px)').matches
             && !window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const THICK = 0.13;                                    // door depth, as a share of its width

  const pct = r => ({ left: r.x / IMG.w * 100 + '%', top: r.y / IMG.h * 100 + '%',
                      width: r.w / IMG.w * 100 + '%', height: r.h / IMG.h * 100 + '%' });
  const el = (tag, cls, style) => { const e = document.createElement(tag); if (cls) e.className = cls; if (style) Object.assign(e.style, style); return e; };

  // ── Interior (behind the door) ───────────────────────────────────────────
  // Drawn in one 100×100 box stretched over the cavity: back wall inset 14% / 7%,
  // so the side walls, glass shelves and crisper read in perspective.
  const inside = el('div', '', pct(DOOR)); inside.id = 'fridge-inside';
  const cavity = el('div', 'fi-cavity door-pan');
  // Perspective helpers: a point at height y on the front plane meets the back wall at toBack(y)
  const toBack = y => 7 + y * 0.86;
  const SHELVES = [36, 70];
  // Glass shelf: the pane, then the soft shadow it throws on the back wall just below
  const shelf = f => { const b = toBack(f); return `
      <polygon fill="url(#fi-shadow-down)" points="14,${b} 86,${b} 86,${b + 9} 14,${b + 9}"/>
      <polygon fill="url(#fi-shadow-l)" points="0,${f} 14,${b} 14,${b + 9} 0,${f + 10}"/>
      <polygon fill="url(#fi-shadow-r)" points="100,${f} 86,${b} 86,${b + 9} 100,${f + 10}"/>
      <polygon class="fi-glass" points="0,${f} 100,${f} 86,${b} 14,${b}"/>`; };
  // Moulded shelf runners along both side walls (the shelves are adjustable)
  const rail = y => { const b = toBack(y); return `
      <polygon class="fi-rail" points="0,${y} 14,${b} 14,${b + 0.9} 0,${y + 1.3}"/>
      <polygon class="fi-rail-hi" points="0,${y} 14,${b} 14,${b + 0.25} 0,${y + 0.35}"/>
      <polygon class="fi-rail" points="100,${y} 86,${b} 86,${b + 0.9} 100,${y + 1.3}"/>
      <polygon class="fi-rail-hi" points="100,${y} 86,${b} 86,${b + 0.25} 100,${y + 0.35}"/>`; };
  cavity.innerHTML = `
    <svg class="fi-art" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="fi-side-l" x1="0" x2="1"><stop offset="0" stop-color="#dcdad4"/><stop offset="1" stop-color="#efeeea"/></linearGradient>
        <linearGradient id="fi-side-r" x1="1" x2="0"><stop offset="0" stop-color="#d9d7d1"/><stop offset="1" stop-color="#eceae6"/></linearGradient>
        <linearGradient id="fi-back" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f8f7f3"/><stop offset=".55" stop-color="#f1efeb"/><stop offset="1" stop-color="#e5e3dd"/></linearGradient>
        <linearGradient id="fi-ceil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fcfbf9"/><stop offset="1" stop-color="#f3f1ec"/></linearGradient>
        <linearGradient id="fi-floor" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#e0ddd6"/><stop offset="1" stop-color="#d3d0c9"/></linearGradient>
        <linearGradient id="fi-shadow-down" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3226" stop-opacity=".22"/><stop offset="1" stop-color="#3a3226" stop-opacity="0"/></linearGradient>
        <linearGradient id="fi-shadow-l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3226" stop-opacity=".16"/><stop offset="1" stop-color="#3a3226" stop-opacity="0"/></linearGradient>
        <linearGradient id="fi-shadow-r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3226" stop-opacity=".16"/><stop offset="1" stop-color="#3a3226" stop-opacity="0"/></linearGradient>
      </defs>
      <rect x="14" y="7" width="72" height="86" fill="url(#fi-back)"/>
      <polygon points="0,0 14,7 14,93 0,100" fill="url(#fi-side-l)"/>
      <polygon points="100,0 86,7 86,93 100,100" fill="url(#fi-side-r)"/>
      <polygon points="0,0 100,0 86,7 14,7" fill="url(#fi-ceil)"/>
      <polygon points="0,100 100,100 86,93 14,93" fill="url(#fi-floor)"/>
      <!-- the creases where walls meet catch a little shade -->
      <path class="fi-crease" d="M14,7 L14,93 M86,7 L86,93 M14,7 L86,7 M14,93 L86,93"/>
      ${[20, 53, 86].map(rail).join('')}
      ${SHELVES.map(rail).join('')}
      <!-- behind the crisper drawers: deep shade under the lowest shelf -->
      <polygon fill="url(#fi-shadow-down)" points="14,${toBack(70) + 6} 86,${toBack(70) + 6} 86,93 14,93" opacity=".45"/>
      ${SHELVES.map(shelf).join('')}
    </svg>`;
  // Front layer: thick glass edges, the frosted crisper drawers, their handles
  const lip = f => `
      <rect class="fi-lip-body" x="0" y="${f - 0.7}" width="100" height="1.6"/>
      <rect class="fi-lip-hi" x="0" y="${f - 0.7}" width="100" height="0.35"/>
      <rect class="fi-lip-lo" x="0" y="${f + 0.75}" width="100" height="0.25"/>
      <rect fill="url(#fi-lip-shade)" x="0" y="${f + 1}" width="100" height="2.2"/>`;
  const drawer = x => `
      <rect fill="url(#fi-drawer-shadow)" x="${x - 0.6}" y="96.6" width="47.7" height="3.2" rx="1.5"/>
      <rect class="fi-drawer" x="${x}" y="74" width="46.5" height="24.5" rx="2" fill="url(#fi-drawer-face)"/>
      <rect class="fi-drawer-inner" x="${x + 2.2}" y="79" width="42.1" height="17.5" rx="1.4"/>
      <rect class="fi-drawer-rim" x="${x + 0.6}" y="74.4" width="45.3" height="0.5" rx="0.25"/>
      <rect fill="url(#fi-drawer-top-shade)" x="${x}" y="74" width="46.5" height="5" rx="2"/>
      <rect class="fi-pull" x="${x + 14}" y="75.4" width="18.5" height="1.3" rx="0.6"/>
      <rect class="fi-pull-hi" x="${x + 14}" y="76.5" width="18.5" height="0.3" rx="0.15"/>`;
  const art2 = el('div', 'fi-layer');
  art2.innerHTML = `
    <svg class="fi-art" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="fi-lip-shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2d3a30" stop-opacity=".18"/><stop offset="1" stop-color="#2d3a30" stop-opacity="0"/></linearGradient>
        <linearGradient id="fi-drawer-face" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".7"/><stop offset=".5" stop-color="#f8f6f1" stop-opacity=".62"/><stop offset="1" stop-color="#ebe8e0" stop-opacity=".72"/></linearGradient>
        <linearGradient id="fi-drawer-top-shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3226" stop-opacity=".14"/><stop offset="1" stop-color="#3a3226" stop-opacity="0"/></linearGradient>
        <radialGradient id="fi-drawer-shadow" cx=".5" cy=".5" r=".5"><stop offset=".55" stop-color="#2a241b" stop-opacity=".22"/><stop offset="1" stop-color="#2a241b" stop-opacity="0"/></radialGradient>
      </defs>
      ${drawer(3)}${drawer(50.5)}
      ${SHELVES.map(lip).join('')}
    </svg>`;
  // Lighting on top of everything: falloff away from the lamp, shade in the corners,
  // the lamp itself (real proportions, so it isn't stretched with the SVG), film grain
  cavity.append(art2, el('div', 'fi-shade'), el('div', 'fi-lamp'), el('div', 'fi-grain'), el('div', 'fi-light'), el('div', 'fi-mist'));
  inside.appendChild(cavity);

  // ── The door: front panel (photo crop), back liner, handle ────────────────
  const panel = el('div', 'door-panel door-pan', pct(DOOR)); panel.id = 'door-panel';
  const crop = el('img', '', {
    left: -DOOR.x / DOOR.w * 100 + '%', top: -DOOR.y / DOOR.h * 100 + '%', width: IMG.w / DOOR.w * 100 + '%',
  });
  crop.src = 'fridge2.jpg'; crop.alt = ''; crop.draggable = false;
  panel.appendChild(crop);

  const back = el('div', 'door-back', pct(DOOR)); back.id = 'door-back';
  back.innerHTML = `
    <i class="db-well"></i>
    <i class="db-ridge l"></i><i class="db-ridge r"></i>
    <i class="db-dairy" style="--look: 1.2cqw"><b class="db-lid"></b><b class="db-cap l"></b><b class="db-cap r"></b></i>
    <i class="db-shelf" style="top:33%; --look: 0.7cqw"><b class="db-cap l"></b><b class="db-cap r"></b></i>
    <i class="db-shelf" style="top:56%; --look: 1.4cqw"><b class="db-cap l"></b><b class="db-cap r"></b></i>
    <i class="db-shelf tall" style="top:79%; --look: 2.1cqw"><b class="db-cap l"></b><b class="db-cap r"></b></i>
    <i class="db-sheen"></i>
    <i class="db-shade"></i><i class="db-glow"></i>
    <i class="db-gasket"></i>`;

  // The door's free edge: a strip turned 90° that gives the door its depth.
  // The liner sits THICK behind the front, the strip spans the gap between them.
  const edge = el('div', 'door-edge'); edge.id = 'door-edge';

  const handle = el('button', 'item door-handle', pct(HANDLE));
  handle.type = 'button';
  handle.setAttribute('aria-label', 'Open the fridge');
  handle.setAttribute('aria-expanded', 'false');
  const hl = el('span', 'item-hover-label'); hl.textContent = 'Open'; handle.appendChild(hl);

  // Soft shadow the open door casts on the floor
  const floor = el('div', 'door-floor', pct(FLOOR));

  // Interior sits just above the photo, the door panel above that, then the magnets
  fridge.querySelector('.fridge-bg').after(floor, inside, panel, back, edge, handle);

  // ── Swing ────────────────────────────────────────────────────────────────
  let state = 'closed', group = [], saved = new Map(), timer = null;

  function doorGroup() {
    const fw = fridge.offsetWidth, fh = fridge.offsetHeight;
    const r = { l: DOOR.x / IMG.w * fw, t: DOOR.y / IMG.h * fh, w: DOOR.w / IMG.w * fw, h: DOOR.h / IMG.h * fh };
    const onDoor = e => {
      if (e.hidden || !e.offsetWidth) return false;
      const cx = e.offsetLeft + e.offsetWidth / 2, cy = e.offsetTop + e.offsetHeight / 2;
      return cx > r.l && cx < r.l + r.w && cy > r.t && cy < r.t + r.h;
    };
    const magnets = [...fridge.querySelectorAll('.item'), $('views-magnet'), $('ring-wrap')]
      .filter(e => e && e !== handle && onDoor(e));
    fridge.style.perspective = Math.round(fw * 2.4) + 'px';
    fridge.style.perspectiveOrigin = '50% 45%';
    // Size the edge strip to the door's height, centred on its free (left) edge
    const t = r.w * THICK;
    Object.assign(edge.style, { left: r.l - t / 2 + 'px', top: r.t + 'px', width: t + 'px', height: r.h + 'px' });
    return { hingeX: r.l + r.w, thick: t, members: [panel, back, edge, handle, ...magnets] };
  }

  // Every member turns about the hinge: translate to it, rotate, translate back,
  // then its own transform (e.g. the sticky note's tilt) — so they stay one door.
  function setAngle(deg, ms, ease) {
    group.members.forEach(e => {
      const H = group.hingeX - (e.offsetLeft + e.offsetWidth / 2);
      const base = e === back ? `translateZ(${-group.thick}px) rotateY(180deg)`
                 : e === edge ? `translateZ(${-group.thick / 2}px) rotateY(-90deg)`
                 : saved.get(e).base;
      e.style.transition = ms ? `transform ${ms}ms ${ease}` : 'none';
      // Pivot on the hinge pin at the back of the door, so the thick door clears the opening
      const Z = group.thick;
      e.style.transform = `translateX(${H}px) translateZ(${-Z}px) rotateY(${deg}deg) translateZ(${Z}px) translateX(${-H}px) ${base}`;
    });
  }

  // Cross-origin iframes (the webring) are their own compositor surface and ignore
  // backface-visibility, so hide a door's iframes only while it is turned past 90°.
  let raf = 0;
  function trackFacing() {
    cancelAnimationFrame(raf);
    const frames = group.members.flatMap(e => [...e.querySelectorAll('iframe')]);
    const tick = () => {
      const away = new DOMMatrixReadOnly(getComputedStyle(panel).transform).m11 < 0;  // cos θ < 0
      frames.forEach(f => { f.style.visibility = away ? 'hidden' : ''; });
      if (state === 'opening' || state === 'closing') raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  // On a phone the fridge fills the screen and the hinge sits at its edge, so the
  // view pulls back and slides over until the opening and the swung-out door
  // (together about 1.8 door-widths) fit on screen. Transforms, not scrolling:
  // mobile browsers disagree on whether a zoomed-in page can be scrolled from script.
  const OPEN_SPAN = 1.8;
  function slide(on, ms, ease) {
    let x = 0, k = 1;
    if (on) {
      const r = panel.getBoundingClientRect(), f = fridge.getBoundingClientRect(), vv = window.visualViewport;
      const viewL = vv ? vv.offsetLeft : 0, viewW = vv ? vv.width : window.innerWidth;
      k = Math.min(1, (viewW - 16) / (r.width * OPEN_SPAN));
      const ox = f.left + f.width / 2;                      // scale() works about the top centre (below)
      const doorL = ox + (r.left - ox) * k;
      x = viewL + (viewW - r.width * k * OPEN_SPAN) / 2 - doorL;
    }
    fridge.style.transformOrigin = '50% 0';               // pull back toward the top, keeping the door's foot on screen
    fridge.style.transition = ms ? `translate ${ms}ms ${ease}, scale ${ms}ms ${ease}` : '';
    fridge.style.translate = on ? `${x}px 0` : '';
    fridge.style.scale = on ? String(k) : '';
  }

  function open() {
    if (state !== 'closed') return;
    state = 'opening';
    clearTimeout(timer);
    group = doorGroup();
    saved = new Map(group.members.map(e => {
      const inline = e.style.transform;
      const computed = getComputedStyle(e).transform;
      return [e, { inline, base: inline || (computed === 'none' ? '' : computed) }];
    }));
    group.members.forEach(e => { if (e !== back && e !== edge) e.classList.add('door-member'); });
    fridge.classList.add('fridge-open');
    handle.setAttribute('aria-expanded', 'true');
    setAngle(0, 0);
    void fridge.offsetWidth;                                // start from closed
    requestAnimationFrame(() => {
      fridge.classList.add('door-ajar');
      // A slow first few degrees while the seal lets go, then it swings
      setAngle(OPEN_DEG, OPEN_MS, 'cubic-bezier(.5,.03,.24,1.08)');   // swings a hair past, then settles
      trackFacing();
      if (TOUCH) slide(true, OPEN_MS, 'cubic-bezier(.45,.05,.25,1)');
    });
    timer = setTimeout(() => { state = 'open'; }, OPEN_MS);
  }

  function close() {
    if (state !== 'open' && state !== 'opening') return;
    state = 'closing';
    clearTimeout(timer);
    fridge.classList.remove('door-ajar');
    handle.setAttribute('aria-expanded', 'false');
    setAngle(0, CLOSE_MS, 'cubic-bezier(.6,0,.9,.35)');
    trackFacing();
    if (TOUCH) slide(false, CLOSE_MS, 'cubic-bezier(.55,0,.8,.4)');
    timer = setTimeout(() => {
      // The seal catches: the whole fridge gives a small shudder
      if (!STILL && fridge.animate) fridge.animate(
        [{ transform: 'none' }, { transform: 'translateX(0.25%) rotate(0.08deg)' },
         { transform: 'translateX(-0.15%)' }, { transform: 'translateX(0.06%)' }, { transform: 'none' }],
        { duration: 260, easing: 'ease-out' });
      group.members.forEach(e => {                          // put everything back exactly
        e.style.transition = '';
        e.style.transform = e === back || e === edge ? '' : saved.get(e).inline;
        e.classList.remove('door-member');
        e.querySelectorAll('iframe').forEach(f => { f.style.visibility = ''; });
      });
      fridge.classList.remove('fridge-open');
      fridge.style.transition = '';
      state = 'closed';
    }, CLOSE_MS);
  }

  handle.addEventListener('click', e => { e.stopPropagation(); open(); });
  back.addEventListener('click', close);
  edge.addEventListener('click', close);

  // Clicking the inside shuts the door, unless that click was really a pan-drag
  let down = null;
  cavity.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
  cavity.addEventListener('click', e => {
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
    close();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !$('os-overlay').classList.contains('open')) close();
  });

  // Keep the hinge right if the fridge resizes while open (mobile rotation etc.)
  if (window.ResizeObserver) new ResizeObserver(() => {
    if (state !== 'open') return;
    const { hingeX, thick } = doorGroup();
    Object.assign(group, { hingeX, thick });
    setAngle(OPEN_DEG, 0);
  }).observe(fridge);
})();
