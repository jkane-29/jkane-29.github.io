// ── The orb at the back of the fridge: a gateway to somewhere else ──
// Its light on the fridge is real, in the sense that it is part of the renders
// (fridge/*.webp, from _fridge/render.py, which has a glowing ball in this spot).
// This draws the ball's surface over that spot, live: a slow green vortex with
// another sky showing through the middle. It only runs while the door is open.
(function () {
  const fridge = $('fridge'), openView = fridge.querySelector('.door-open');
  if (!openView) return;                                   // no door (layout editing)

  const IMG  = { w: 1024, h: 1536 };                       // fridge2.jpg
  const ORB  = { x: 511, y: 759.5, r: 64 };                // `render.py --where` gives 62: a hair over, so the render's plain ball never shows
  const HALO = 2.2;                                        // the canvas reaches this many radii out, for the glow
  const STILL = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const canvas = document.createElement('canvas');
  canvas.className = 'door-orb';
  canvas.setAttribute('aria-hidden', 'true');
  const half = ORB.r * HALO;
  Object.assign(canvas.style, {
    left: (ORB.x - half) / IMG.w * 100 + '%', top: (ORB.y - half) / IMG.h * 100 + '%',
    width: 2 * half / IMG.w * 100 + '%', height: 2 * half / IMG.h * 100 + '%' });
  openView.after(canvas);

  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, antialias: false });
  if (!gl) { canvas.remove(); return; }                    // the render's plain glowing ball stays

  // Outside the ball the shader returns colour with no coverage: that adds light (the glow).
  const FRAG = `
precision highp float;
uniform vec2 res; uniform float t;
const float HALO = ${HALO.toFixed(2)};
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
// a field of stars drifting toward the viewer
float stars(vec2 p, float scale, float seed) {
  p = p * scale + seed; vec2 i = floor(p), f = fract(p) - 0.5;
  float h = hash(i + seed);
  vec2 o = (vec2(hash(i + 1.7), hash(i + 9.2)) - 0.5) * 0.7;
  float tw = 0.6 + 0.4 * sin(t * (1.0 + 3.0 * h) + h * 40.0);
  return step(0.72, h) * tw * smoothstep(0.09, 0.0, length(f - o)) ;
}
void main() {
  vec2 p = (gl_FragCoord.xy / res * 2.0 - 1.0) * HALO;
  float r = length(p);
  vec2 dir = p / max(r, 1e-4);
  // the edge breathes: tongues of light lick outward, never inward
  float lick = fbm(dir * 2.2 + vec2(t * 0.35, -t * 0.22)) ;
  float edge = 1.0 + 0.07 * lick * lick;
  float inside = smoothstep(edge, edge - 0.035, r);

  // the vortex: space wound tighter and tighter toward the middle, turning all the time
  float rr = clamp(r, 0.0, 1.0);
  float wind = 2.6 / (rr + 0.28);
  vec2 q1 = rot(wind + t * 0.42) * p, q2 = rot(-wind * 0.6 - t * 0.27) * p;
  float n1 = fbm(q1 * 2.6 + vec2(0.0, t * 0.10));
  float n2 = fbm(q2 * 4.2 - vec2(t * 0.13, 0.0));
  float arms = smoothstep(0.38, 0.78, n1) + 0.55 * smoothstep(0.45, 0.8, n2);
  float veil = n1 * n2;

  vec3 deep = vec3(0.0, 0.035, 0.02), emerald = vec3(0.05, 0.85, 0.32), lime = vec3(0.62, 1.0, 0.55);
  vec3 col = mix(deep, emerald, clamp(0.12 + arms * 0.85 + veil * 0.8, 0.0, 1.0));
  col = mix(col, lime, smoothstep(0.9, 1.5, arms) * 0.8);

  // through the middle: the other side. A dark sky falling toward you, with its own stars
  float hole = smoothstep(0.62, 0.18, rr);
  vec2 s = rot(t * 0.05) * p / (0.25 + rr);                // pulled in, as down a throat
  float zoom = fract(t * 0.06);
  float st = 0.0;
  for (int i = 0; i < 3; i++) {
    float z = fract(zoom + float(i) / 3.0);                // each layer swells past and fades
    st += stars(s, mix(9.0, 2.5, z), float(i) * 17.0) * smoothstep(0.0, 0.2, z) * smoothstep(1.0, 0.7, z);
  }
  vec3 sky = vec3(0.0, 0.012, 0.02) + vec3(0.02, 0.16, 0.12) * fbm(s * 1.3 + t * 0.03) + vec3(0.1, 0.0, 0.16) * fbm(s * 0.9 - t * 0.02 + 4.0);
  sky += st * vec3(0.8, 1.0, 0.9) * 1.4;
  col = mix(col, sky, hole * (1.0 - 0.55 * smoothstep(0.5, 1.0, arms)));

  // a brighter green rim where the two places meet
  float rim = pow(rr, 7.0);
  col += emerald * rim * 1.5;
  col += lime * 0.10 * sin(t * 0.9) * rim;                 // slow pulse

  // the glow around it
  float out_ = max(r - 1.0, 0.0);
  vec3 glow = vec3(0.10, 0.95, 0.38) * (0.26 * exp(-out_ * 4.0) + 0.12 * exp(-out_ * 1.9)) * (0.85 + 0.15 * sin(t * 0.9));
  glow *= smoothstep(HALO, HALO * 0.72, r);                // gone before the canvas ends
  gl_FragColor = vec4(col * inside + glow * (1.0 - inside), inside);
}`;

  const shader = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, 'attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }'));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.remove(); return; }
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);   // one triangle over everything
  gl.enableVertexAttribArray(0); gl.bindAttribLocation(prog, 0, 'a');
  gl.vertexAttribPointer(gl.getAttribLocation(prog, 'a'), 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(prog, 'res'), uT = gl.getUniformLocation(prog, 't');

  // Sharp at whatever size the fridge is zoomed to, without drawing more than is seen
  function fit() {
    const px = Math.round(Math.min(640, Math.max(96, canvas.getBoundingClientRect().width * (devicePixelRatio || 1))));
    if (canvas.width !== px) { canvas.width = canvas.height = px; gl.viewport(0, 0, px, px); }
  }

  let raf = 0, frame = 0;
  const start = performance.now() - 40000;                 // begin mid-swirl, not from a standing start
  function draw(now) {
    if (frame++ % 20 === 0) fit();
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uT, (now - start) / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    raf = STILL ? 0 : requestAnimationFrame(draw);
  }
  const sync = () => {
    const on = fridge.classList.contains('fridge-open') && !document.hidden;
    if (on && !raf) { frame = 0; raf = requestAnimationFrame(draw); }
    else if (!on && raf) { cancelAnimationFrame(raf); raf = 0; }
  };
  new MutationObserver(sync).observe(fridge, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('visibilitychange', sync);
})();
