// ── Fridge OS window ──────────────────────────────────────────
// Clicking a magnet opens its page in a Mac-style window over the fridge.
// Plain pages (about, writing, rides…) are fetched and inlined; whole apps
// (the Amtrak map) get their own iframe. A few pages get special treatment:
// woodshop → slideshow, postcard → sized to the card, decisions → terminal game.
// Exposes openWindow / openEmbedWindow / closeWindow (about.html calls them too).
(function () {
  const TITLEBAR = 38;
  const injectedSheets = new Set();
  let cleanup = null;   // stops whatever the open window started (timers, key handlers)

  const pageType = href => {
    const h = href.toLowerCase();
    return h.includes('decisions') ? 'decisions'
         : h.includes('woodshop') || h.includes('bethtrain') ? 'woodshop'
         : h.includes('postcard')  ? 'postcard'
         : 'generic';
  };

  // Phones never zoom, on the fridge or in a window (the viewport meta asks for
  // that, and CSS touch-action blocks pinch and double-tap). iOS Safari ignores
  // user-scalable=no, so its pinch gesture events are blocked here too.
  if (IS_TOUCH) for (const ev of ['gesturestart', 'gesturechange'])
    document.addEventListener(ev, e => e.preventDefault(), { passive: false });

  // Phones: Safari's toolbars are see-through and take their tint from the
  // page beneath them. A window runs under them in its page colour, and the
  // page behind (seen when overscrolling) takes that colour too. Safari only
  // re-reads the tint on scroll, and opening a window doesn't scroll the page,
  // so nudge it by a pixel and back.
  let chromeColour = '';
  function syncChrome() {
    const open = IS_TOUCH && $('os-overlay').classList.contains('open');
    const colour = open ? getComputedStyle($('os-overlay')).backgroundColor : '';
    if (colour === chromeColour) return;
    chromeColour = colour;
    document.documentElement.style.backgroundColor = colour;
    document.body.style.backgroundColor = colour;
    // Re-read once the window has finished fading in (0.2s), so Safari sees
    // the page, not the fridge behind a still-transparent window.
    setTimeout(() => {
      const x = scrollX, y = scrollY;
      scrollTo(x, y > 0 ? y - 1 : y + 1);
      requestAnimationFrame(() => scrollTo(x, y));
    }, 260);
  }
  if (IS_TOUCH) new MutationObserver(syncChrome).observe($('os-content-inner'), { childList: true });

  // Shared start for both kinds of window
  function showWindow(title) {
    if (cleanup) { cleanup(); cleanup = null; }
    // On touch: push history state so the back button closes the window
    if (IS_TOUCH) { history.pushState({ fridgeWindow: true }, '', ''); }
    $('os-window-title').textContent = title || 'Jack Kane';
    // Reset any inline sizing left by a previous window; each window type sizes itself
    $('os-window').style.width = '';
    $('os-window').style.height = '';
    $('os-injected-style').textContent = '';
    $('os-overlay').classList.add('open');
    syncChrome();
    document.body.style.overflow = 'hidden';   // lock background scroll while open
  }

  // Size the window so its content area has the given aspect ratio, as large as
  // fits in 90% of the screen (capped at maxW). padW/padH: fixed chrome inside
  // the content (padding, a footer) that doesn't scale with the aspect.
  function fitWindow(aspect, maxW, { padW = 0, padH = 0, clip = true } = {}) {
    const win = $('os-window');
    let w = Math.min(innerWidth * 0.9, maxW);
    let h = (w - padW) / aspect + padH;
    const maxH = innerHeight * 0.9 - TITLEBAR;
    if (h > maxH) { h = maxH; w = (h - padH) * aspect + padW; }   // short screen: fit to height
    win.style.width  = Math.round(w) + 'px';
    win.style.height = Math.round(h + TITLEBAR) + 'px';
    if (clip) $('os-content').style.overflow = 'hidden';
  }

  async function openWindow(href, title) {
    if (href.startsWith('http')) { window.open(href, '_blank', 'noopener,noreferrer'); return; }
    showWindow(title);
    const contentEl = $('os-content-inner');
    contentEl.innerHTML = '<div style="padding:48px 56px;color:#aaa;font-family:-apple-system,sans-serif;font-size:14px;">Loading…</div>';
    const type = pageType(href);

    try {
      const resp = await fetch(encodeURI(href), { cache: 'no-store' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const doc = new DOMParser().parseFromString(await resp.text(), 'text/html');

      // Drop the page's own sidebar nav — irrelevant inside the OS window
      doc.querySelectorAll('.sidebar, aside').forEach(el => el.remove());

      // Fix relative image paths (a folder URL like "woodshop/" is its own base)
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
        if (fh && !injectedSheets.has(fh)) {
          const l = document.createElement('link');
          l.rel = 'stylesheet'; l.href = fh;
          document.head.appendChild(l);
          injectedSheets.add(fh);
        }
      });

      // Extract and scope page styles (rewrite body{} → #os-content-inner{})
      let css = '';
      doc.querySelectorAll('style').forEach(s => { css += s.textContent; });
      $('os-injected-style').textContent = css.replace(/\bbody\s*{/g, '#os-content-inner {');

      // Snapshot scripts before any adoption (adoptNode moves nodes out of doc)
      const docScripts = Array.from(doc.querySelectorAll('script'));
      const adoptAll = into => Array.from(doc.body.childNodes).forEach(n => into.appendChild(document.adoptNode(n)));

      if (type === 'decisions') {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'padding:20px;box-sizing:border-box;';
        const terminal = doc.querySelector('.terminal-container');
        terminal ? wrap.appendChild(document.adoptNode(terminal)) : adoptAll(wrap);
        contentEl.innerHTML = '';
        contentEl.appendChild(wrap);
        await loadScript('js/decisions.js?v=0d210145');
        if (contentEl.contains(wrap)) cleanup = startDecisionsGame();   // unless closed meanwhile
        return;   // the game replaces the page's own script
      }

      if (type === 'woodshop') {
        const srcs = Array.from(doc.querySelectorAll('img.project-image')).map(img => img.getAttribute('src'));
        contentEl.innerHTML = `<div id="ws-slide">
  <div id="ws-backdrop"></div>
  <img id="ws-img" src="${srcs[0]}">
  <div id="ws-counter">1 / ${srcs.length}</div>
  <button id="ws-prev" class="ws-nav prev" title="Previous">◀</button>
  <button id="ws-next" class="ws-nav next" title="Next">▶</button>
</div>`;
        cleanup = slideshow(contentEl, srcs);
      } else {
        contentEl.innerHTML = '';
        adoptAll(contentEl);
      }

      // Postcard: window matches the card's aspect (1568×1003), no letterbox
      if (type === 'postcard' && !IS_TOUCH) requestAnimationFrame(() => fitWindow(1568 / 1003, 960));

      // Re-execute the page's scripts
      docScripts.forEach(old => {
        const s = document.createElement('script');
        if (old.src) s.src = old.src;
        else s.textContent = old.textContent;
        document.body.appendChild(s);
        document.body.removeChild(s);
      });
    } catch (err) {
      contentEl.innerHTML = `<div style="padding:48px 56px;color:#e63946;font-family:-apple-system,sans-serif;font-size:13px;">Could not load page.<br><br><code>${err.message}</code></div>`;
      console.error('openWindow:', err);
    }
  }

  // Some pages are whole self-contained apps (the Amtrak map: its own pixel
  // font, canvas and 60s data loop). Those open in their own document instead
  // of being inlined like the essay pages — no id or style collisions with the
  // fridge, and re-opening costs nothing because the file is already cached.
  function openEmbedWindow(src, title, aspect) {
    showWindow(title);
    const frame = document.createElement('iframe');
    frame.className = 'os-embed-frame';
    frame.src = src;
    const inner = $('os-content-inner');
    inner.innerHTML = '';
    inner.appendChild(frame);
    // Wrap the app tightly (desktop): its map at `aspect`, plus a fixed allowance
    // for the page's padding and slim 2-line footer. Measuring the footer inside
    // the frame raced the map's own script, so this is a constant.
    if (aspect && !matchMedia('(pointer: coarse)').matches) {
      const [aw, ah] = aspect.split('/').map(parseFloat);
      requestAnimationFrame(() => fitWindow(aw / ah, 900, { padW: 8, padH: 53 }));
    }
    cleanup = () => { frame.src = 'about:blank'; };   // stop its timers on close
  }

  // Woodshop: the window stays one fixed 4:3 size for the whole slideshow; each
  // photo fits inside it, over a blurred copy of itself, so nothing jumps.
  function slideshow(contentEl, srcs) {
    if (!srcs.length) return null;
    const img  = contentEl.querySelector('#ws-img');
    const back = contentEl.querySelector('#ws-backdrop');
    const ctr  = contentEl.querySelector('#ws-counter');
    if (!IS_TOUCH) fitWindow(4 / 3, 1100, { clip: false });   // on touch, CSS makes it full-screen
    srcs.forEach(s => { new Image().src = s; });             // preload so slides swap instantly
    back.style.backgroundImage = `url("${srcs[0]}")`;
    let i = 0, token = 0;
    const show = n => {
      i = (n + srcs.length) % srcs.length;
      ctr.textContent = (i + 1) + ' / ' + srcs.length;
      const t = ++token, next = new Image();
      next.onload = next.onerror = () => {
        if (t !== token) return;   // a newer click won
        img.style.opacity = 0;
        setTimeout(() => {
          if (t !== token) return;
          img.src = srcs[i];
          back.style.backgroundImage = `url("${srcs[i]}")`;
          img.style.opacity = 1;
        }, 150);
      };
      next.src = srcs[i];
    };
    contentEl.querySelector('#ws-next').onclick = e => { e.stopPropagation(); show(i + 1); };
    contentEl.querySelector('#ws-prev').onclick = e => { e.stopPropagation(); show(i - 1); };
    contentEl.querySelector('#ws-slide').onclick = () => show(i + 1);
    const onKey = e => {
      if (e.key === 'ArrowRight') show(i + 1);
      else if (e.key === 'ArrowLeft') show(i - 1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }

  function closeWindow() {
    if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    if (cleanup) { cleanup(); cleanup = null; }
    $('os-overlay').classList.remove('open');
    syncChrome();
    document.body.style.overflow = '';   // restore background scroll
    const win = $('os-window');
    setTimeout(() => {
      $('os-content-inner').innerHTML = '';
      $('os-injected-style').textContent = '';
      win.style.width = ''; win.style.height = '';
      $('os-content').style.overflow = '';
    }, 250);
  }

  // ── Traffic lights, as on a Mac ──
  // Green: real full screen (the Fullscreen API on the window itself), green
  // again or Esc to come back. Yellow: minimise, which tucks the window away
  // toward the bottom of the screen. Double-clicking the title bar zooms too.
  const win = $('os-window');
  const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
  function toggleFullscreen() {
    if (fsEl()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else (win.requestFullscreen || win.webkitRequestFullscreen || (() => {})).call(win);
  }
  const syncFull = () => {
    const full = fsEl() === win;
    if (!full && win.classList.contains('is-full')) return collapse();
    win.classList.toggle('is-full', full);
  };
  // Leaving full screen (Esc, green, the browser's own controls) jumps straight
  // back to the window size; animate that like macOS does instead. The window
  // itself shrinks from filling the screen back into its frame (its real size,
  // so text re-wraps rather than being squashed by a scale), staying centred,
  // corners rounding as it lands.
  function collapse() {
    const from = win.getBoundingClientRect();
    win.classList.remove('is-full');
    const to = win.getBoundingClientRect();
    if (!to.width || !win.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timing = { duration: 380, easing: 'cubic-bezier(0.22, 0.9, 0.3, 1)' };
    win.animate([
      { width: from.width + 'px', height: from.height + 'px', borderRadius: '0px' },
      { width: to.width + 'px', height: to.height + 'px', borderRadius: '12px' },
    ], timing);
  }
  document.addEventListener('fullscreenchange', syncFull);
  document.addEventListener('webkitfullscreenchange', syncFull);
  function minimiseWindow() {
    if (fsEl()) { toggleFullscreen(); return; }   // like macOS: leave full screen first
    win.classList.add('minimising');
    setTimeout(() => { closeWindow(); win.classList.remove('minimising'); }, 260);
  }
  $('tl-max').addEventListener('click', toggleFullscreen);
  $('tl-min').addEventListener('click', minimiseWindow);
  $('os-titlebar').addEventListener('dblclick', e => { if (!e.target.closest('.tl-btn')) toggleFullscreen(); });

  $('tl-close').addEventListener('click', closeWindow);
  $('os-overlay').addEventListener('click', e => { if (e.target === $('os-overlay')) closeWindow(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !fsEl()) closeWindow(); });
  // Back button closes the window on mobile
  addEventListener('popstate', () => { if ($('os-overlay').classList.contains('open')) closeWindow(); });

  // ── Resizable window (desktop) ──
  const MIN_W = 320, MIN_H = 200;
  let resize = null;
  document.querySelectorAll('#os-window .resize-handle').forEach(handle => {
    handle.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      const win = $('os-window'), rect = win.getBoundingClientRect();
      win.style.width  = rect.width  + 'px';
      win.style.height = rect.height + 'px';
      resize = { dir: handle.dataset.dir, startX: e.clientX, startY: e.clientY, origW: rect.width, origH: rect.height };
    });
  });
  document.addEventListener('mousemove', e => {
    if (!resize) return;
    const win = $('os-window');
    const dx = e.clientX - resize.startX, dy = e.clientY - resize.startY;
    const { dir, origW, origH } = resize;
    if (dir === 'e' || dir === 'se') win.style.width = Math.max(MIN_W, origW + dx) + 'px';
    if (dir === 'w' || dir === 'sw') win.style.width = Math.max(MIN_W, origW - dx) + 'px';
    if (dir === 's' || dir === 'se' || dir === 'sw') {
      win.style.height = Math.max(MIN_H, origH + dy) + 'px';
      $('os-content').style.overflow = 'auto';
    }
  });
  document.addEventListener('mouseup', () => { resize = null; });

  Object.assign(window, { openWindow, openEmbedWindow, closeWindow });
})();
