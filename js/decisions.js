// ── Decisions: a terminal game for picking between options as a group ──
// Port of decisions/decisions.py. Loaded by js/window.js the first time the
// Decisions window opens; runs inside its terminal markup (#terminal-output,
// #terminal-input, #input-line). Returns a function that stops the game.
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
