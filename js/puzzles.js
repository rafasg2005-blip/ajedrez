// Vista "Problemas": 34.500 problemas de Lichess (CC0) con ELO adaptativo, modo racha y repaso de tus errores.
import { Chess, uciObj, wp, fig, sleep, toast, sideName, esc } from './util.js';
import { Board } from './board.js';
import { engine } from './engine.js';
import { sfx } from './sound.js';
import { store } from './storage.js';
import { loadPuzzleDb } from './puzzledb.js';

const THEMES = [
  ['', 'Todos los temas'], ['mateIn1', 'Mate en 1'], ['mateIn2', 'Mate en 2'], ['mateIn3', 'Mate en 3'],
  ['mate', 'Cualquier mate'], ['fork', 'Ataque doble'], ['pin', 'Clavada'], ['skewer', 'Enfilada'],
  ['hangingPiece', 'Pieza colgada'], ['discoveredAttack', 'Ataque a la descubierta'], ['sacrifice', 'Sacrificio'],
  ['trappedPiece', 'Pieza atrapada'], ['backRankMate', 'Mate del pasillo'], ['deflection', 'Desviación'],
  ['attraction', 'Atracción'], ['promotion', 'Coronación'], ['defensiveMove', 'Jugada defensiva'],
  ['quietMove', 'Jugada tranquila'], ['endgame', 'Finales'], ['opening', 'Apertura'], ['middlegame', 'Medio juego'],
  ['short', 'Cortos (2 jugadas)'], ['long', 'Largos (3+ jugadas)'],
];
const THEME_ES = {
  ...Object.fromEntries(THEMES.filter((t) => t[0])),
  oneMove: 'Una jugada', advantage: 'Ventaja', crushing: 'Aplastante', equality: 'Igualdad', mateIn4: 'Mate en 4', mateIn5: 'Mate en 5+',
  kingsideAttack: 'Ataque al rey', queensideAttack: 'Ataque en el flanco de dama', xRayAttack: 'Rayos X',
  capturingDefender: 'Captura del defensor', doubleCheck: 'Jaque doble', smotheredMate: 'Mate de la coz', intermezzo: 'Jugada intermedia',
  exposedKing: 'Rey expuesto', interference: 'Interferencia', clearance: 'Despeje', zugzwang: 'Zugzwang',
  rookEndgame: 'Final de torres', pawnEndgame: 'Final de peones', bishopEndgame: 'Final de alfiles', knightEndgame: 'Final de caballos',
  queenEndgame: 'Final de damas', queenRookEndgame: 'Final de dama y torre', underPromotion: 'Subpromoción', enPassant: 'Al paso',
  castling: 'Enroque', veryLong: 'Muy largo', master: 'Partida de maestro', masterVsMaster: 'Maestro contra maestro', superGM: 'Súper GM',
  arabianMate: 'Mate árabe', anastasiaMate: 'Mate de Anastasia', bodenMate: 'Mate de Boden', hookMate: 'Mate del gancho',
  dovetailMate: 'Mate de la cola de golondrina', doubleBishopMate: 'Mate de los dos alfiles', killBoxMate: 'Mate de la caja',
  vukovicMate: 'Mate de Vukovic', balestraMate: 'Mate de ballesta', blindSwineMate: 'Mate de los cerdos ciegos', triangleMate: 'Mate del triángulo',
  cornerMate: 'Mate de la esquina', operaMate: 'Mate de la ópera', pillsburysMate: 'Mate de Pillsbury', morphysMate: 'Mate de Morphy', epauletteMate: 'Mate de las charreteras', swallowstailMate: 'Mate cola de golondrina',
  advancedPawn: 'Peón avanzado', attackingF2F7: 'Ataque a f2/f7', collinearMove: 'Jugada colineal',
};

let app, board, all = null;
const P = { mode: 'rated', theme: '', puz: null, chess: null, idx: 0, failed: false, hinted: 0, done: false, userColor: 'w',
  streak: 0, racha: null, mistake: null, busy: false };
const $ = (id) => document.getElementById(id);

export function initPuzzles(_app) {
  app = _app;
  board = new Board('pz-host', 'pz-board', { onMove });
  const sel = $('pz-theme');
  sel.innerHTML = THEMES.map(([v, t]) => `<option value="${v}">${t}</option>`).join('');
  sel.onchange = () => { P.theme = sel.value; next(); };
  const st = app.profile.settings;
  const diff = $('pz-diff');
  const rng = $('pz-custom-elo');
  diff.value = st.pzDiff ?? '0';
  rng.value = st.pzCustom ?? 1200;
  const syncDiff = () => {
    $('pz-custom').hidden = diff.value !== 'custom';
    $('pz-custom-lbl').textContent = rng.value;
    $('pz-diff-txt').textContent = `Te saldrán problemas de ELO ≈ ${target()}.`;
  };
  diff.onchange = () => { st.pzDiff = diff.value; app.saveProfile(); syncDiff(); if (P.racha) P.racha = null; next(); };
  rng.oninput = () => syncDiff();
  rng.onchange = () => { st.pzCustom = +rng.value; app.saveProfile(); syncDiff(); if (P.racha) P.racha = null; next(); };
  P.syncDiff = syncDiff;
  syncDiff();
  $('pz-mode').querySelectorAll('button').forEach((b) => (b.onclick = () => setMode(b.dataset.mode)));
  $('pz-next').onclick = () => next();
  $('pz-retry').onclick = () => retry();
  $('pz-hint').onclick = () => hint();
  $('pz-solution').onclick = () => solution();
  document.addEventListener('keydown', (e) => {
    if (!$('view-puzzles').classList.contains('active') || e.target.closest('input,select')) return;
    if (e.key === 'Enter' || e.key === 'ArrowRight') { if (P.done) next(); }
  });
  return { onShow, board };
}

async function load() {
  if (all) return all;
  $('pz-title').textContent = 'Cargando problemas…';
  all = await loadPuzzleDb();
  return all;
}

let shown = false;
async function onShow() {
  board.redraw();
  if (!shown) { shown = true; await load(); next(); }
  renderStats();
}

function setMode(m) {
  P.mode = m;
  $('pz-mode').querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.mode === m));
  $('pz-theme').disabled = m === 'mistakes';
  P.racha = null;
  next();
}

/** ELO objetivo de los problemas según la dificultad elegida. */
function target() {
  const st = app.profile.settings;
  if (st.pzDiff === 'custom') return +(st.pzCustom ?? 1200);
  return Math.max(400, Math.min(2700, app.profile.prating + (+(st.pzDiff ?? 0))));
}

function lowerBound(r) {
  let lo = 0, hi = all.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (all[mid].rating < r) lo = mid + 1; else hi = mid; }
  return lo;
}

function pick(target) {
  const seen = new Set(store.seenPuzzles());
  const okTheme = (p) => !P.theme || p.themes.split(' ').includes(P.theme);
  for (let w = 60; w <= 1200; w += 120) {
    const a = lowerBound(target - w), b = lowerBound(target + w);
    const c = [];
    for (let i = a; i < b; i++) if (!seen.has(all[i].id) && okTheme(all[i])) c.push(all[i]);
    if (c.length) return c[Math.floor(Math.random() * c.length)];
  }
  const any = all.filter(okTheme);
  return any[Math.floor(Math.random() * any.length)];
}

/* ------------------------------------------------------------------ */
async function next() {
  if (!all) await load();
  if (P.mode === 'mistakes') return nextMistake();
  if (P.mode === 'streak' && (!P.racha || P.racha.over)) P.racha = { count: 0, rating: Math.max(400, target() - 350), over: false };
  const puz = pick(P.mode === 'streak' ? P.racha.rating : target());
  const seen = store.seenPuzzles();
  seen.push(puz.id);
  store.saveSeenPuzzles(seen);
  start(puz);
}

async function start(puz) {
  P.puz = puz; P.mistake = null;
  P.chess = new Chess(puz.fen);
  P.idx = 0; P.failed = false; P.hinted = 0; P.done = false;
  P.userColor = P.chess.turn() === 'w' ? 'b' : 'w';
  board.orientation(P.userColor === 'w' ? 'white' : 'black');
  board.clearBadges();
  render();
  const hideRating = P.mode === 'streak';
  $('pz-title').textContent = P.mode === 'streak' ? `Racha: ${P.racha.count} ✔` : `Problema · ${hideRating ? '?' : puz.rating}`;
  msg(`Juegan las <b>${sideName(P.userColor)}</b>. Encuentra la mejor jugada.`, 'info');
  $('pz-meta').innerHTML = '';
  setButtons();
  P.busy = true;
  await sleep(550);
  if (P.puz !== puz) return;
  playOpp();
  P.busy = false;
  render();
}

function playOpp() {
  const u = P.puz.moves[P.idx];
  const mv = P.chess.move(uciObj(u));
  P.idx++;
  sfx.play(mv, P.chess);
  render(mv);
}

async function onMove(from, to, promotion) {
  if (P.mistake) return onMistakeMove(from, to, promotion);
  if (P.done || P.busy) return render();
  let mv;
  try { mv = P.chess.move({ from, to, promotion: promotion || 'q' }); } catch { return render(); }
  const expected = P.puz.moves[P.idx];
  const correct = mv.lan === expected || P.chess.isCheckmate();
  if (!correct) {
    P.chess.undo();
    sfx.bad();
    render();
    fail(`❌ <b>${fig(mv.san)}</b> no es la solución. ${P.mode === 'streak' ? '' : '¡Prueba otra vez!'}`);
    return;
  }
  P.idx++;
  sfx.play(mv, P.chess);
  render(mv);
  if (P.idx >= P.puz.moves.length || P.chess.isCheckmate()) return solved();
  msg('✅ ¡Bien! Sigue…', 'ok');
  P.busy = true;
  await sleep(450);
  const cur = P.puz;
  if (P.puz !== cur) return;
  playOpp();
  P.busy = false;
  render();
}

function updatePuzzleRating(score) {
  const p = app.profile;
  const exp = 1 / (1 + Math.pow(10, (P.puz.rating - p.prating) / 400));
  const k = p.pcount < 20 ? 40 : 20;
  const old = p.prating;
  p.prating = Math.round(p.prating + k * (score - exp));
  p.pcount++;
  if (score) p.psolved++;
  p.phistory.push({ t: Date.now(), r: p.prating });
  if (p.phistory.length > 2000) p.phistory = p.phistory.slice(-2000);
  app.saveProfile();
  return p.prating - old;
}

function fail(text) {
  let extra = '';
  if (!P.failed) {
    P.failed = true;
    if (P.mode === 'rated') {
      const d = updatePuzzleRating(0);
      extra = ` <span class="delta-neg">${d}</span>`;
      P.streak = 0;
    }
    if (P.mode === 'streak') {
      P.racha.over = true;
      const p = app.profile;
      const best = p.bestStreak || 0;
      if (P.racha.count > best) { p.bestStreak = P.racha.count; app.saveProfile(); }
      P.done = true;
      text += `<br>Fin de la racha: <b>${P.racha.count}</b> resueltos${P.racha.count > best ? ' — ¡nuevo récord! 🏆' : ''}. Pulsa <b>Siguiente</b> para otra.`;
      showSolutionArrow();
    }
  }
  msg(text + extra, 'bad');
  renderStats();
  setButtons();
}

function solved() {
  P.done = true;
  let extra = '';
  if (P.mode === 'rated' && !P.failed) {
    const d = updatePuzzleRating(1);
    extra = ` <span class="delta-pos">+${d}</span>`;
    P.streak++;
  }
  sfx.good();
  const themes = P.puz.themes.split(' ').map((t) => THEME_ES[t]).filter(Boolean);
  $('pz-meta').innerHTML = `<span class="pill">ELO ${P.puz.rating}</span>` + themes.map((t) => `<span class="pill">${t}</span>`).join('') +
    ` <a class="pill" href="https://lichess.org/training/${P.puz.id}" target="_blank" rel="noopener">ver en Lichess</a>`;
  if (P.mode === 'streak') {
    P.racha.count++;
    P.racha.rating += 60;
    msg(`✅ ¡Correcto! Racha: <b>${P.racha.count}</b>`, 'ok');
    renderStats();
    setTimeout(() => { if (P.done && P.mode === 'streak' && !P.racha.over) next(); }, 900);
    return;
  }
  msg(P.failed ? '✔ Resuelto (después de fallar, no suma puntos).' : `🎉 ¡Resuelto!${extra}`, 'ok');
  renderStats();
  setButtons();
  render();
}

function hint() {
  if (P.done) return;
  if (P.mistake) return mistakeHint();
  if (P.busy || P.idx >= P.puz.moves.length) return;
  const u = P.puz.moves[P.idx];
  P.hinted++;
  if (!P.failed && P.mode !== 'mistakes') fail('💡 Pista usada: este problema ya no suma puntos.');
  if (P.hinted === 1) board.shapes([{ orig: u.slice(0, 2), brush: 'green' }]);
  else board.shapes([{ orig: u.slice(0, 2), dest: u.slice(2, 4), brush: 'green' }]);
}

function showSolutionArrow() {
  const u = P.puz?.moves[P.idx];
  if (u) board.shapes([{ orig: u.slice(0, 2), dest: u.slice(2, 4), brush: 'green' }]);
}

async function solution() {
  if (P.mistake) return mistakeSolution();
  if (P.done || P.busy) return;
  if (!P.failed) fail('👁️ Solución:');
  P.busy = true;
  const cur = P.puz;
  while (P.idx < P.puz.moves.length && P.puz === cur) {
    showSolutionArrow();
    await sleep(700);
    if (P.puz !== cur) return;
    playOpp();
    await sleep(500);
  }
  P.busy = false;
  P.done = true;
  board.shapes([]);
  msg('Esta era la solución. Pulsa <b>Reintentar</b> para hacerlo tú o <b>Siguiente</b> para otro.', 'info');
  render();
  setButtons();
}

function retry() {
  if (P.mistake) return startMistake(P.mistake);
  if (!P.puz || P.mode === 'streak') return;
  const keepFailed = P.failed;
  start(P.puz).then(() => { P.failed = keepFailed || P.failed; });
  P.failed = true; // repetir no vuelve a puntuar
}

/* ------------------------------------------------------------------ */
/* Mis errores                                                         */
/* ------------------------------------------------------------------ */
function nextMistake() {
  const ms = store.mistakes();
  P.puz = null;
  if (!ms.length) {
    P.mistake = null;
    P.chess = new Chess();
    board.orientation('white');
    render();
    $('pz-title').textContent = 'Mis errores';
    msg('Aún no hay errores guardados. Cuando juegues contra el entrenador, las posiciones donde falles aparecerán aquí para que las repases. 💪', 'info');
    $('pz-meta').innerHTML = '';
    return;
  }
  // primero los más antiguos, con algo de azar
  const i = Math.floor(Math.random() * Math.min(ms.length, 5));
  startMistake(ms[i]);
}

function startMistake(m) {
  P.mistake = m;
  P.chess = new Chess(m.fen);
  P.userColor = P.chess.turn();
  P.done = false; P.failed = false; P.hinted = 0; P.busy = false;
  board.orientation(P.userColor === 'w' ? 'white' : 'black');
  board.clearBadges();
  render();
  const left = store.mistakes().length;
  $('pz-title').textContent = `Mis errores · quedan ${left}`;
  msg(`En esta posición jugaste <b>${fig(m.played)}</b> y fue un error. Juegan las <b>${sideName(P.userColor)}</b>: ¿cuál era la buena?`, 'info');
  $('pz-meta').innerHTML = `<span class="pill">De tu partida del ${new Date(m.date).toLocaleDateString('es-ES')}</span>`;
  setButtons();
}

async function onMistakeMove(from, to, promotion) {
  if (P.done || P.busy) return render();
  const m = P.mistake;
  const fen = P.chess.fen();
  let mv;
  try { mv = P.chess.move({ from, to, promotion: promotion || 'q' }); } catch { return render(); }
  render(mv);
  let ok = mv.lan === m.best;
  if (!ok) {
    P.busy = true;
    msg('Comprobando…', 'info');
    const an = await engine.analyze(P.chess.fen(), { depth: 13, movetime: 2000 });
    P.busy = false;
    if (P.mistake !== m) return;
    const wa = an.terminal === 'mate' ? 100 : 100 - wp(an.lines[0].score);
    ok = m.wb - wa < 4;
  }
  if (ok) {
    P.done = true;
    sfx.good();
    if (!P.failed && !P.hinted) {
      store.saveMistakes(store.mistakes().filter((x) => x.k !== m.k));
      msg(`✅ ¡Eso es! <b>${fig(mv.san)}</b>${mv.lan === m.best ? '' : ' también vale'}. Error superado: lo quito de la lista.`, 'ok');
    } else {
      msg(`✔ Correcto. Como has necesitado ayuda, lo dejo en la lista para repasarlo otra vez.`, 'ok');
    }
    renderStats();
    setButtons();
    return;
  }
  P.chess.load(fen);
  sfx.bad();
  P.failed = true;
  msg(`❌ <b>${fig(mv.san)}</b> tampoco es buena. Inténtalo otra vez.`, 'bad');
  render();
}

function mistakeHint() {
  const m = P.mistake;
  P.hinted++;
  if (P.hinted === 1) board.shapes([{ orig: m.best.slice(0, 2), brush: 'green' }]);
  else board.shapes([{ orig: m.best.slice(0, 2), dest: m.best.slice(2, 4), brush: 'green' }]);
}

function mistakeSolution() {
  const m = P.mistake;
  if (P.done) return;
  P.done = true; P.failed = true;
  board.shapes([{ orig: m.best.slice(0, 2), dest: m.best.slice(2, 4), brush: 'green' }]);
  msg(`La buena era <b>${fig(m.bestSan)}</b>.`, 'info');
  setButtons();
}

/* ------------------------------------------------------------------ */
function render(lastMv) {
  const lm = lastMv ? [lastMv.from, lastMv.to] : board.cg.state.lastMove;
  const can = !P.done && !P.busy && (P.mistake || (P.puz && P.idx > 0));
  board.set(P.chess, { lastMove: lm, userColor: can ? P.userColor : null, shapes: [] });
  const tagFor = (c) => (c === P.userColor ? '<span class="name">Tú</span>' : '<span class="name">Rival</span>');
  const top = board.orient === 'white' ? 'b' : 'w';
  $('pz-top').innerHTML = tagFor(top);
  $('pz-bottom').innerHTML = tagFor(top === 'w' ? 'b' : 'w');
}

function msg(html, kind) {
  const m = $('pz-msg');
  m.innerHTML = html;
  m.className = 'bubble ' + (kind || '');
}

function setButtons() {
  $('pz-retry').disabled = P.mode === 'streak';
  $('pz-solution').disabled = P.done;
  $('pz-hint').disabled = P.done || P.mode === 'streak';
}

function renderStats() {
  const p = app.profile;
  $('pz-stats').innerHTML = `
    <div class="stat"><b>${p.prating}</b><span>Tu ELO de problemas</span></div>
    <div class="stat"><b>${p.psolved}/${p.pcount}</b><span>Resueltos</span></div>
    <div class="stat"><b>${P.mode === 'streak' ? P.racha?.count ?? 0 : P.streak}</b><span>Racha · récord ${p.bestStreak || 0}</span></div>`;
  app.refreshHeader();
  P.syncDiff?.();
}
