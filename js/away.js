// ── Through the orb: the fridge, standing on the Moon ─────────
// Click the orb at the back of the open fridge and you come out the other side: the same
// fridge, magnets and all, on the lunar surface, with the Earth in the sky behind it. Click
// the orb again to come home.
//
// The ground is a rendered picture (fridge/moon.webp, from _fridge/moon.py), made with the
// fridge photo's own camera so the regolith meets the fridge's feet. The fridge is the live
// one from the page, with its white studio wall cut away (fridge/fridge-cut.webp).
// The Earth is drawn here, turned as it really is this minute (which side faces the Moon), with
// its daylight leaning the true way. Its map, fridge/earth.jpg, is NASA's Blue Marble (public domain).
(function () {
  const fridge = $('fridge'), orb = fridge.querySelector('.door-orb');
  if (!orb) return;                                        // no door, or no WebGL orb

  const IMG   = { w: 1024, h: 1536 };                      // fridge2.jpg
  const ORB   = { x: 511, y: 759.5, r: 64 };               // as in js/orb.js
  const WORLD = { x: -1500, y: -282, w: 4024, h: 2600 };   // what moon.webp covers, in photo pixels (HXP, HYP in moon.py)
  const DOOR  = { x: 995, y: 1233, w: 1529, h: 256 };  // from moon_publish.py:                            // the open door's shadow: a patch of the same picture
  const EARTH = { x: 952, y: 236, r: 122 };                // a third bigger than life (it is really 1.9° across from the Moon), to be seen properly
  const VIEW  = WORLD;                                     // how much of the picture is laid out: all of it
  const V = '?v=5';
  const STILL = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const el = (tag, cls, style) => { const e = document.createElement(tag); if (cls) e.className = cls; if (style) Object.assign(e.style, style); return e; };
  const within = (r, box) => ({ left: (r.x - box.x) / box.w * 100 + '%', top: (r.y - box.y) / box.h * 100 + '%',
                                width: r.w / box.w * 100 + '%', height: r.h / box.h * 100 + '%' });
  const PHOTO = { x: 0, y: 0, w: IMG.w, h: IMG.h };

  // ── Pieces ──
  const scene  = el('div', 'away-scene door-pan', within(VIEW, PHOTO));
  const ground = el('img', 'away-ground door-pan', within(WORLD, VIEW));
  const shadow = el('img', 'away-door door-pan', within(DOOR, VIEW));
  const earth  = el('canvas', 'away-earth', within({ x: EARTH.x - EARTH.r * 1.25, y: EARTH.y - EARTH.r * 1.25, w: EARTH.r * 2.5, h: EARTH.r * 2.5 }, VIEW));
  const cut    = el('img', 'away-cut');
  ground.style.height = 'auto';                            // by its own proportions: its width is what places it
  [ground, shadow, cut].forEach(i => { i.alt = ''; i.draggable = false; i.decoding = 'async'; });
  scene.append(ground, shadow, earth);
  fridge.querySelector('.fridge-bg').before(scene, cut);

  const way = el('button', 'orb-way', within({ x: ORB.x - ORB.r, y: ORB.y - ORB.r, w: 2 * ORB.r, h: 2 * ORB.r }, PHOTO));
  way.type = 'button';
  way.setAttribute('aria-label', 'Step through the orb');
  orb.after(way);

  const rim = el('div', 'away-rim');                       // the orb's edge, as it grows
  fridge.appendChild(rim);

  // The pictures are fetched the first time the fridge is opened, so they are there by the time the orb is clicked
  let loaded = null;
  const map = new Image();
  const load = () => loaded = loaded || Promise.all([[ground, 'fridge/moon.webp'], [shadow, 'fridge/moon-door.webp'], [cut, 'fridge/fridge-cut.webp'], [map, 'fridge/earth.jpg']]
    .map(([img, src]) => { img.src = src + V; return img.decode().catch(() => {}); }))
    .then(() => { place(); scene.classList.add('ready'); drawEarth(); });   // decoded, laid out (a pin-prick behind the orb) and the Earth drawn, all ahead of time
  new MutationObserver(() => { if (fridge.classList.contains('fridge-open')) load(); })
    .observe(fridge, { attributes: true, attributeFilter: ['class'] });

  // Where the orb is, for the circle that the two views are clipped to (see styles.css)
  function place() {
    const k = fridge.offsetWidth / IMG.w, set = (n, v) => fridge.style.setProperty(n, v + 'px');
    set('--ox', ORB.x * k); set('--oy', ORB.y * k); set('--sx', (ORB.x - VIEW.x) * k); set('--sy', (ORB.y - VIEW.y) * k);
    return k;
  }

  // ── Where the Sun and Moon are over the Earth right now (low-precision almanac; good to a degree or two) ──
  const RAD = Math.PI / 180;
  function overhead(date) {
    const d = date / 86400000 - 10955.5;                   // days since 2000 Jan 0.0 UT
    const ecl = (23.4393 - 3.563e-7 * d) * RAD;
    const kepler = (M, e) => { let E = M; for (let i = 0; i < 6; i++) E = M + e * Math.sin(E); return E; };
    const equatorial = (lon, lat) => {                     // ecliptic → right ascension, declination
      const x = Math.cos(lat) * Math.cos(lon), y = Math.cos(lat) * Math.sin(lon), z = Math.sin(lat);
      const ye = y * Math.cos(ecl) - z * Math.sin(ecl), ze = y * Math.sin(ecl) + z * Math.cos(ecl);
      return { ra: Math.atan2(ye, x), dec: Math.asin(ze) };
    };
    // Sun
    const ws = (282.9404 + 4.70935e-5 * d) * RAD, es = 0.016709 - 1.151e-9 * d, Ms = (356.0470 + 0.9856002585 * d) * RAD;
    const Es = kepler(Ms, es);
    const sunLon = Math.atan2(Math.sqrt(1 - es * es) * Math.sin(Es), Math.cos(Es) - es) + ws;
    // Moon
    const N = (125.1228 - 0.0529538083 * d) * RAD, inc = 5.1454 * RAD, wm = (318.0634 + 0.1643573223 * d) * RAD;
    const em = 0.0549, Mm = (115.3654 + 13.0649929509 * d) * RAD, Em = kepler(Mm, em);
    const u = Math.atan2(Math.sqrt(1 - em * em) * Math.sin(Em), Math.cos(Em) - em) + wm;
    const xh = Math.cos(N) * Math.cos(u) - Math.sin(N) * Math.sin(u) * Math.cos(inc);
    const yh = Math.sin(N) * Math.cos(u) + Math.cos(N) * Math.sin(u) * Math.cos(inc);
    const zh = Math.sin(u) * Math.sin(inc);
    const sun = equatorial(sunLon, 0), moon = equatorial(Math.atan2(yh, xh), Math.asin(zh));
    const gmst = Ms + ws + Math.PI + (date / 86400000 % 1) * 2 * Math.PI;   // sidereal time at Greenwich
    return { sun: { lat: sun.dec, lon: sun.ra - gmst }, moon: { lat: moon.dec, lon: moon.ra - gmst } };   // the points on Earth beneath each
  }

  // ── The Earth, seen from the Moon ──
  let pixels = null;                                       // the map of the Earth, once loaded
  function mapPixels() {
    if (pixels || !map.naturalWidth) return pixels;
    const c = document.createElement('canvas'); c.width = map.naturalWidth; c.height = map.naturalHeight;
    const g = c.getContext('2d'); g.drawImage(map, 0, 0);
    try { pixels = g.getImageData(0, 0, c.width, c.height); } catch (e) {}
    return pixels;
  }
  const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  const noise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), dd = hash(xi + 1, yi + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + dd) * sx * sy;
  };
  const fbm = (x, y) => { let s = 0, a = 0.5; for (let i = 0; i < 6; i++) { s += a * noise(x, y); x = x * 2.03 + 7.1; y = y * 2.03 + 3.3; a *= 0.5; } return s; };

  let drawing = 0, drawn = 0;
  function drawEarth() {
    const shown = fridge.getBoundingClientRect().width * EARTH.r * 2.5 / IMG.w;   // (the canvas itself may not be laid out yet)
    const size = Math.round(Math.min(760, Math.max(200, shown * (devicePixelRatio || 1) * 1.25)));   // drawn a little oversize, so it stays crisp
    const out = new ImageData(size, size), px = out.data, tex = mapPixels(), job = ++drawing;
    const now = Date.now(), { sun, moon } = overhead(now);
    const sv = [Math.cos(sun.lat) * Math.cos(sun.lon), Math.cos(sun.lat) * Math.sin(sun.lon), Math.sin(sun.lat)];
    // Licence: the daylight is pulled round toward the Moon, so the Earth is never thinner than gibbous.
    // It still leans the true way, and turns as it really does.
    const mv = [Math.cos(moon.lat) * Math.cos(moon.lon), Math.cos(moon.lat) * Math.sin(moon.lon), Math.sin(moon.lat)];
    for (let i = 0; i < 3; i++) sv[i] += 1.3 * mv[i];
    const sl = Math.hypot(sv[0], sv[1], sv[2]); sv[0] /= sl; sv[1] /= sl; sv[2] /= sl;
    const s0 = Math.sin(moon.lat), c0 = Math.cos(moon.lat), R = size / 2.5, drift = now / 86400000 * 0.9;
    const srgb = v => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
    const AIR = 1.035;                                     // the atmosphere stands a little proud of the surface
    const row = j => { for (let i = 0; i < size; i++) {
      const x = (i + 0.5 - size / 2) / R, y = (size / 2 - j - 0.5) / R, rr = x * x + y * y, o = (j * size + i) * 4;
      if (rr > AIR * AIR) continue;
      const rad = Math.sqrt(rr);
      if (rad > 1) {                                       // just off the limb: a thin blue line of air, lit on the day side
        const sinL = Math.max(-1, Math.min(1, y / rad * c0)), lo = moon.lon + Math.atan2(x / rad, -y / rad * s0), cL = Math.sqrt(1 - sinL * sinL);
        const d = Math.max(0, cL * Math.cos(lo) * sv[0] + cL * Math.sin(lo) * sv[1] + sinL * sv[2] + 0.25);
        const a = Math.pow(1 - (rad - 1) / (AIR - 1), 2) * Math.min(1, d * 1.6) * 0.75;
        px[o] = 90; px[o + 1] = 160; px[o + 2] = 255; px[o + 3] = 255 * a;
        continue;
      }
      const z = Math.sqrt(1 - rr);
      const sinLat = Math.max(-1, Math.min(1, z * s0 + y * c0)), lat = Math.asin(sinLat);
      const lon = moon.lon + Math.atan2(x, z * c0 - y * s0), cl = Math.cos(lat);
      const nx = cl * Math.cos(lon), ny = cl * Math.sin(lon);
      const day = nx * sv[0] + ny * sv[1] + sinLat * sv[2];
      let r, gg, b;
      if (tex) {                                           // the map, sampled smoothly
        const fu = (((lon / (2 * Math.PI) + 0.5) % 1 + 1) % 1) * tex.width - 0.5, fv = Math.min(tex.height - 1.001, Math.max(0, (0.5 - lat / Math.PI) * tex.height - 0.5));
        const u0 = Math.floor(fu), v0 = Math.floor(fv), du = fu - u0, dv = fv - v0, w = tex.width, d = tex.data;
        const at = (uu, vv, c) => d[(vv * w + ((uu % w) + w) % w) * 4 + c];
        const lerp = c => Math.pow(((at(u0, v0, c) * (1 - du) + at(u0 + 1, v0, c) * du) * (1 - dv) + (at(u0, v0 + 1, c) * (1 - du) + at(u0 + 1, v0 + 1, c) * du) * dv) / 255, 2.2);
        r = lerp(0); gg = lerp(1); b = lerp(2);
        // the map is dark and flat: lift the land, deepen the sea, so the continents read from this far away
        const land = Math.min(1, Math.max(0, (Math.max(r, gg) - b * 0.9) * 9 + 0.15 * (r + gg + b > 0.5)));
        const mean = (r + gg + b) / 3, sat = 1.35;
        r = Math.max(0, mean + (r - mean) * sat) * (1.25 + 0.75 * land); gg = Math.max(0, mean + (gg - mean) * sat) * (1.25 + 0.80 * land); b = Math.max(0, mean + (b - mean) * sat) * (1.5 + 0.5 * land);
      } else { r = 0.010; gg = 0.045; b = 0.16; }           // no map: open ocean everywhere
      // weather: streets and swirls of cloud that drift a little from day to day, thicker in the storm belts
      const cx = lon * 6.4 + drift, cy = lat * 11.0;
      const wx = fbm(cx * 0.45 + 3, cy * 0.45), wy = fbm(cx * 0.45, cy * 0.45 + 5);
      const belt = 0.10 * Math.pow(Math.sin(lat * 2), 2) + 0.07 * Math.exp(-lat * lat * 60);
      const cf = fbm(cx + 3.2 * wx, cy + 3.2 * wy);
      let cloud = (cf - 0.60 + belt) * 4.6;
      cloud = Math.min(1, Math.max(0, cloud)); cloud = cloud * cloud * (3 - 2 * cloud) * (0.62 + 0.38 * fbm(cx * 5, cy * 5));
      cloud = Math.min(1, cloud + 0.30 * Math.min(1, Math.max(0, (cf - 0.47 + belt) * 3.2)));   // thin high cloud around the thick
      r += (0.80 - r) * cloud; gg += (0.82 - gg) * cloud; b += (0.85 - b) * cloud;
      r = Math.min(r, 0.82); gg = Math.min(gg, 0.84); b = Math.min(b, 0.88);                 // the ice caps are not brighter than cloud
      const light = Math.min(1, Math.max(0, day * 3.5 + 0.15)) * (0.35 + 0.65 * Math.max(day, 0)) * 1.25;   // a soft terminator
      const air = Math.pow(1 - z, 2.6) * 0.75;               // blue haze, thickest toward the limb
      r = r * light + 0.18 * air * light + 0.001; gg = gg * light + 0.42 * air * light + 0.002; b = b * light + 0.95 * air * light + 0.005;
      px[o] = srgb(Math.min(1, r)); px[o + 1] = srgb(Math.min(1, gg)); px[o + 2] = srgb(Math.min(1, b)); px[o + 3] = 255;
    } };
    // a few rows at a time, between frames, so nothing on the page ever waits for it
    let next = 0;
    (function some() {
      if (job !== drawing) return;                         // a newer drawing has started
      const t0 = performance.now();
      while (next < size && performance.now() - t0 < 6) row(next++);
      if (next < size) return setTimeout(some, 0);
      earth.width = earth.height = size;
      earth.getContext('2d').putImageData(out, 0, 0);
      drawn = Date.now();
    })();
  }

  // ── Going through, and coming back ──
  // The orb swells until it has passed over the whole screen, and the Moon is what is inside it.
  // Coming home it draws back in. (styles.css clips the two views to the circle --r about the orb.)
  let away = false, busy = false, clock = 0;
  const OUT_MS = 4200, BACK_MS = 2800;
  function settle(to) {
    away = to;
    document.body.classList.toggle('away', away);
    document.body.classList.remove('crossing');
    // on the Moon the view may not be dragged or zoomed past the rendered ground (the sky above is black for as far as you like)
    window.FRIDGE_BOUNDS = away ? { l: WORLD.x + 210, r: WORLD.x + WORLD.w - 210, t: WORLD.y - 260, b: WORLD.y + WORLD.h - 190 } : null;
    if (window.fridgeReframe) window.fridgeReframe();
    way.setAttribute('aria-label', away ? 'Step back through the orb' : 'Step through the orb');
    clearInterval(clock);
    if (away) clock = setInterval(drawEarth, 60000);
    busy = false;
  }
  async function go() {
    if (busy) return;
    busy = true;
    await load();
    const to = !away;
    if (to && Date.now() - drawn > 60000) drawEarth();
    if (STILL) return settle(to);
    const k = place();
    const b = way.getBoundingClientRect(), zoom = b.width / way.offsetWidth, cx = b.left + b.width / 2, cy = b.top + b.height / 2;
    const r0 = ORB.r * k * 0.98, r1 = 1.08 * Math.max(...[[0, 0], [innerWidth, 0], [0, innerHeight], [innerWidth, innerHeight]].map(([x, y]) => Math.hypot(x - cx, y - cy))) / zoom;
    const set = (n, v) => fridge.style.setProperty(n, v + 'px');
    set('--r', to ? r0 : r1);
    document.body.classList.add('crossing');
    const t0 = performance.now(), ms = to ? OUT_MS : BACK_MS;
    (function step(now) {
      let t = Math.min(1, (now - t0) / ms);
      if (!to) t = 1 - t;
      const r = r0 + (r1 - r0) * Math.pow(t, 2.3);                     // creeps out of the orb, then gathers pace
      set('--r', r);
      rim.style.setProperty('--k', r / (512 * 0.909));                  // the ring's bright line sits at 90.9% of its picture
      rim.style.opacity = Math.min(1, t * 8, (1 - t) * 4);
      if ((to ? t : 1 - t) < 1) requestAnimationFrame(step); else settle(to);
    })(t0);
  }
  way.addEventListener('click', e => { e.stopPropagation(); go(); });
})();
