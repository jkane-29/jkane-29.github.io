// ── Shared basics for the fridge scripts ──────────────────────
// Loaded first. Everything here is used by more than one file in js/.
// Load order (index.html): core → layout → window → fridge → live.
// js/editor.js loads on its own, only with ?edit.

// Kill native browser drag-ghost on any image (capture phase, all elements)
document.addEventListener('dragstart', e => e.preventDefault(), true);
document.addEventListener('drag',      e => e.preventDefault(), true);

const $ = id => document.getElementById(id);

// Phones/tablets (and narrow windows) get the zoomed-in fridge and full-screen windows
const IS_TOUCH = matchMedia('(pointer: coarse), (max-width: 900px)').matches;
// A real mouse/trackpad: desktop zoom + pan
const FINE_POINTER = matchMedia('(hover: hover) and (pointer: fine)').matches;

// ?edit turns on the layout editor (drag magnets, then "Copy layout")
const isEditMode = new URLSearchParams(location.search).has('edit');
if (isEditMode) document.body.classList.add('edit-mode');

// Load a script once, on demand (the editor, the Decisions game)
const _loaded = {};
function loadScript(src) {
  return _loaded[src] = _loaded[src] || new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

// Run when the browser is idle (Safari has no requestIdleCallback)
const whenIdle = (fn, timeout = 1500) =>
  'requestIdleCallback' in window ? requestIdleCallback(fn, { timeout }) : setTimeout(fn, 600);
