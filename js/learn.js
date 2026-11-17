// Vista "Aprender": recorrido de lecciones desde cero, con progreso guardado.
import { Chess, uciObj, fig, sleep, esc, toast, modal } from './util.js';
import { Board } from './board.js';
import { UNITS, LESSONS, startUnitFor } from './lessons.js';
import { samplePuzzles } from './puzzledb.js';
import { engine } from './engine.js';
import { sfx } from './sound.js';
import { store } from './storage.js';

let app, board;
const $ = (id) => document.getElementById(id);
const L = { k: -1, lesson: null, steps: [], i: 0, errors: 0, st: {}, done: false, busy: false, token: 0 };
const EMPTY = '8/8/8/8/8/8/8/8';
const STAR = '<polygon points="50,10 61,37 90,38 67,56 76,85 50,68 24,85 33,56 10,38 39,37" fill="#f5c518" stroke="#8a6a00" stroke-width="3"/>';
const PRAISE = ['¡Muy bien!', '¡Perfecto!', '¡Eso es!', '¡Genial!', '¡Bravo!'];

export function initLearn(_app) {
  app = _app;
  board = new Board('ln-host', 'ln-board', { onMove });
  $('ln-back').onclick = () => showMap();
  $('ln-next').onclick = () => next();
  $('ln-retry').onclick = () => runStep();
  $('ln-hint').onclick = () => hint();
  document.addEventListener('keydown', (e) => {
    if (!$('view-learn').classList.contains('active') || $('ln-lesson').hidden) return;
    if (e.key === 'Enter' && !$('ln-next').disabled) next();
  });
  return { onShow, board };
}

function onShow() {
  if ($('ln-lesson').hidden) showMap();
  else board.redraw();
}

/* ------------------------------------------------------------------ */
/* Progreso                                                            */
/* ------------------------------------------------------------------ */
function prog() {
  let p = store.learn();
  if (!p) {
    p = { start: startUnitFor(app.profile.rating), done: {} };
    store.saveLearn(p);
  }
  return p;
}

export function setLearnStart(rating) {
  const p = store.learn() || { done: {} };
  p.start = startUnitFor(rating);
  store.saveLearn(p);
}

/** Estado de una lección: done | skipped | next | locked */
function status(k) {
  const p = prog();
  const l = LESSONS[k];
  if (p.done[l.id]) return 'done';
  if (l.unitIndex < p.start) return 'skipped';
  const prev = LESSONS[k - 1];
  const prevOk = !prev || p.done[prev.id] || prev.unitIndex < p.start;
  return prevOk ? 'next' : 'locked';
}

export function learnUnfinished() {
  return LESSONS.some((_, k) => status(k) === 'next');
}

/* ------------------------------------------------------------------ */
/* Mapa del recorrido                                                  */
/* ------------------------------------------------------------------ */
function showMap() {
  L.token++;
  $('ln-lesson').hidden = true;
  $('ln-map').hidden = false;
  const p = prog();
  const total = LESSONS.length;
  const done = LESSONS.filter((l) => p.done[l.id]).length;
  const skipped = LESSONS.filter((l, k) => status(k) === 'skipped').length;
  const nextK = LESSONS.findIndex((_, k) => status(k) === 'next');
  const stars = LESSONS.reduce((s, l) => s + (p.done[l.id]?.stars || 0), 0);
  let html = `<div class="card ln-hero">
    <div><h2>Tu recorrido de ajedrez</h2>
      <p class="muted">${done} de ${total} lecciones completadas${skipped ? ` · ${skipped} convalidadas por tu nivel` : ''} · ⭐ ${stars}/${total * 3}</p>
      <div class="progress big"><div style="width:${((done + skipped) / total) * 100}%"></div><div class="done" style="width:${(done / total) * 100}%"></div></div>
    </div>
    <div class="toolbar">
      ${nextK >= 0 ? `<button class="primary" id="ln-continue">▶ ${done || skipped ? 'Continuar' : 'Empezar'}: ${esc(LESSONS[nextK].title)}</button>` : '<span class="pill">🏆 ¡Recorrido completado!</span>'}
      <button id="ln-level">Cambiar punto de partida</button>
    </div></div>`;
  UNITS.forEach((u, ui) => {
    const ls = LESSONS.map((l, k) => ({ l, k })).filter((x) => x.l.unitIndex === ui);
    const uDone = ls.filter((x) => p.done[x.l.id]).length;
    html += `<div class="card ln-unit ${ui < p.start ? 'skipped' : ''}">
      <div class="ln-unit-head"><b>Unidad ${ui + 1} · ${esc(u.title)}</b><span class="pill">${u.level}</span><span class="muted sm">${uDone}/${ls.length}</span></div>
      <p class="muted sm">${esc(u.desc)}</p>
      <div class="ln-lessons">${ls.map(({ l, k }) => lessonBtn(l, k)).join('')}</div></div>`;
  });
  $('ln-map').innerHTML = html;
  $('ln-map').querySelectorAll('.ln-lesson').forEach((b) => (b.onclick = () => {
    const k = +b.dataset.k;
    if (status(k) === 'locked') return toast('🔒 Termina la lección anterior para desbloquear esta.');
    openLesson(k);
  }));
  $('ln-continue')?.addEventListener('click', () => openLesson(nextK));
  $('ln-level').onclick = changeLevel;
}

function lessonBtn(l, k) {
  const s = status(k);
  const p = prog();
  const sub = s === 'done' ? `<span class="stars">${'★'.repeat(p.done[l.id].stars)}${'☆'.repeat(3 - p.done[l.id].stars)}</span>`
    : s === 'skipped' ? '<span class="muted">Convalidada · repasar</span>'
    : s === 'next' ? '<span class="go">¡Siguiente!</span>' : '<span class="muted">🔒 Bloqueada</span>';
  return `<button class="ln-lesson ${s}" data-k="${k}"><span class="ic">${l.icon}</span><span class="tt">${esc(l.title)}</span>${sub}</button>`;
}

async function changeLevel() {
  const p = prog();
  const act = await modal(`<h2>¿Dónde quieres empezar?</h2>
    <p class="muted">Las unidades anteriores quedan convalidadas (puedes repasarlas cuando quieras). Tu progreso no se borra.</p>
    <div style="display:flex;flex-direction:column;gap:6px">${UNITS.map((u, i) => `<button class="op-card" data-act="${i}">
      <div class="t"><b>Unidad ${i + 1} · ${esc(u.title)}</b><span class="muted">${u.level}</span></div><div class="m">${esc(u.desc)}${i === p.start ? ' · <b>(actual)</b>' : ''}</div></button>`).join('')}</div>
    <div class="toolbar"><button data-act="cancel">Cancelar</button></div>`);
  if (act === null || act === 'cancel') return;
  p.start = +act;
  store.saveLearn(p);
  showMap();
}

/* ------------------------------------------------------------------ */
/* Lección                                                             */
/* ------------------------------------------------------------------ */
async function openLesson(k) {
  L.token++;
  const tok = L.token;
  L.k = k;
  L.lesson = LESSONS[k];
  L.errors = 0;
  $('ln-map').hidden = true;
  $('ln-lesson').hidden = false;
  $('ln-unit').textContent = `Unidad ${L.lesson.unitIndex + 1} · ${L.lesson.unit.title}`;
  $('ln-title').textContent = `${L.lesson.icon} ${L.lesson.title}`;
  board.redraw();
  setText('Preparando la lección…');
  feedback('');
  $('ln-options').innerHTML = '';
  const steps = [];
  for (const s of L.lesson.steps) {
    if (s.t === 'lichess') {
      const ps = await samplePuzzles(s.themes, s.min, s.max, s.count);
      ps.forEach((puz, j) => steps.push({ t: 'puzzle', puz, text: `${s.text} <span class="sm muted">(${j + 1}/${ps.length})</span>` }));
    } else steps.push(s);
  }
  if (tok !== L.token) return;
  L.steps = steps;
  L.i = 0;
  runStep();
  window.scrollTo({ top: 0 });
}

function runStep() {
  L.token++;
  const s = L.steps[L.i];
  L.st = {};
  L.done = false;
  L.busy = false;
  $('ln-progress').style.width = (L.i / L.steps.length) * 100 + '%';
  $('ln-options').innerHTML = '';
  feedback('');
  board.clearBadges();
  board.shapes([]);
  setText(s.text || '');
  const interactive = s.t !== 'info';
  $('ln-hint').hidden = !interactive || s.t === 'quiz';
  $('ln-retry').hidden = !interactive || s.t === 'quiz';
  $('ln-next').disabled = interactive;
  $('ln-next').textContent = L.i === L.steps.length - 1 ? 'Terminar ✔' : 'Siguiente ▶';
  ({ info: runInfo, quiz: runQuiz, stars: runStars, goal: runGoal, line: runLine, puzzle: runLine, playout: runPlayout })[s.t](s);
}

function next() {
  if (L.i < L.steps.length - 1) { L.i++; runStep(); }
  else finishLesson();
}

function success(msg) {
  L.done = true;
  L.busy = false;
  sfx.good();
  feedback(`✅ ${msg || PRAISE[Math.floor(Math.random() * PRAISE.length)]}`, 'ok');
  $('ln-next').disabled = false;
  $('ln-progress').style.width = ((L.i + 1) / L.steps.length) * 100 + '%';
}

function fail(msg) {
  L.errors++;
  sfx.bad();
  feedback(`❌ ${msg}`, 'bad');
}

function finishLesson() {
  const p = prog();
  const stars = L.errors === 0 ? 3 : L.errors <= 2 ? 2 : 1;
  const prev = p.done[L.lesson.id]?.stars || 0;
  p.done[L.lesson.id] = { stars: Math.max(prev, stars), date: Date.now() };
  store.saveLearn(p);
  sfx.win();
  const nextK = L.k + 1 < LESSONS.length ? L.k + 1 : -1;
  const unitDone = LESSONS.filter((l) => l.unitIndex === L.lesson.unitIndex).every((l) => p.done[l.id]);
  $('ln-progress').style.width = '100%';
  setText(`<div class="big-result">🎉 ¡Lección completada!</div>
    <p style="text-align:center;font-size:28px" class="stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</p>
    <p style="text-align:center" class="muted">${L.errors === 0 ? 'Sin ningún fallo. ¡Impecable!' : `${L.errors} fallo${L.errors > 1 ? 's' : ''} o pista${L.errors > 1 ? 's' : ''}. Repítela si quieres las 3 estrellas.`}</p>
    ${unitDone ? `<p style="text-align:center">🏅 ¡Has terminado la unidad <b>${esc(L.lesson.unit.title)}</b>!</p>` : ''}`);
  feedback('');
  $('ln-hint').hidden = true;
  $('ln-retry').hidden = true;
  $('ln-next').disabled = true;
  const box = $('ln-options');
  box.innerHTML = '';
  const add = (label, fn, primary) => {
    const b = document.createElement('button');
    b.textContent = label;
    if (primary) b.className = 'primary';
    b.onclick = fn;
    box.appendChild(b);
  };
  if (nextK >= 0) add(`▶ Siguiente: ${LESSONS[nextK].title}`, () => openLesson(nextK), true);
  add('↻ Repetir lección', () => openLesson(L.k));
  add('🗺️ Volver al recorrido', () => showMap());
  if (L.lesson.unitIndex >= 2) add('♟ Practicar jugando', () => app.show('play'));
}

/* ------------------------------------------------------------------ */
/* Tipos de paso                                                       */
/* ------------------------------------------------------------------ */
function staticBoard(fen, shapes, orientation = 'white') {
  board.orientation(orientation);
  board.cg.set({ fen: (fen || EMPTY).split(' ')[0], lastMove: undefined, check: false, turnColor: 'white', movable: { color: undefined, dests: new Map() } });
  board.shapes(shapes || []);
}

function runInfo(s) {
  staticBoard(s.fen, s.shapes, s.fen && s.fen.split(' ')[1] === 'b' && s.orient === 'b' ? 'black' : 'white');
  $('ln-next').disabled = false;
}

function runQuiz(s) {
  if (s.fen) staticBoard(s.fen, s.shapes);
  const box = $('ln-options');
  box.innerHTML = s.options.map((o, i) => `<button class="opt" data-i="${i}">${o}</button>`).join('');
  box.querySelectorAll('.opt').forEach((b) => (b.onclick = () => {
    if (L.done) return;
    if (+b.dataset.i === s.answer) {
      b.classList.add('ok');
      success(s.explain);
    } else {
      b.classList.add('bad');
      b.disabled = true;
      fail('No es esa. Prueba otra vez.');
    }
  }));
}

/* ---- estrellas: una pieza sola ---- */
function runStars(s) {
  L.st = { kind: 'stars', piece: s.piece, pos: s.from, stars: new Set(s.stars || []), enemies: new Map(Object.entries(s.enemies || {})), moves: 0, last: null };
  board.orientation('white');
  renderStars();
}

function boardFen(pieces) {
  let fen = '';
  for (let r = 8; r >= 1; r--) {
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      const p = pieces.get(String.fromCharCode(97 + f) + r);
      if (p) { if (empty) fen += empty; empty = 0; fen += p; } else empty++;
    }
    if (empty) fen += empty;
    if (r > 1) fen += '/';
  }
  return fen;
}

function pieceDests(piece, from, enemies) {
  const f = from.charCodeAt(0) - 97, r = +from[1] - 1;
  const sq = (x, y) => String.fromCharCode(97 + x) + (y + 1);
  const inb = (x, y) => x >= 0 && x < 8 && y >= 0 && y < 8;
  const out = [];
  const ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  const slide = (dirs) => {
    for (const [dx, dy] of dirs) {
      let x = f + dx, y = r + dy;
      while (inb(x, y)) {
        out.push(sq(x, y));
        if (enemies.has(sq(x, y))) break;
        x += dx; y += dy;
      }
    }
  };
  const step = (dirs) => { for (const [dx, dy] of dirs) if (inb(f + dx, r + dy)) out.push(sq(f + dx, r + dy)); };
  if (piece === 'R') slide(ORTH);
  if (piece === 'B') slide(DIAG);
  if (piece === 'Q') slide([...ORTH, ...DIAG]);
  if (piece === 'K') step([...ORTH, ...DIAG]);
  if (piece === 'N') step([[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]);
  if (piece === 'P') {
    if (inb(f, r + 1) && !enemies.has(sq(f, r + 1))) {
      out.push(sq(f, r + 1));
      if (r === 1 && !enemies.has(sq(f, 3))) out.push(sq(f, 3));
    }
    for (const dx of [-1, 1]) if (inb(f + dx, r + 1) && enemies.has(sq(f + dx, r + 1))) out.push(sq(f + dx, r + 1));
  }
  return out;
}

function renderStars() {
  const st = L.st;
  const pieces = new Map([[st.pos, st.piece]]);
  for (const [s, t] of st.enemies) pieces.set(s, t);
  board.cg.set({
    fen: boardFen(pieces), turnColor: 'white', check: false, lastMove: st.last || undefined,
    movable: { color: L.done ? undefined : 'white', dests: L.done ? new Map() : new Map([[st.pos, pieceDests(st.piece, st.pos, st.enemies)]]) },
  });
  board.shapes([...st.stars].map((s) => ({ orig: s, customSvg: { html: STAR } })));
}

function onStarsMove(orig, dest) {
  const st = L.st;
  st.pos = dest;
  st.moves++;
  st.last = [orig, dest];
  if (st.enemies.has(dest)) { st.enemies.delete(dest); sfx.capture(); } else sfx.move();
  st.stars.delete(dest);
  if (!st.stars.size && !st.enemies.size) {
    L.done = true;
    renderStars();
    success(`${PRAISE[Math.floor(Math.random() * PRAISE.length)]} Hecho en ${st.moves} jugada${st.moves > 1 ? 's' : ''}.`);
    return;
  }
  renderStars();
}

/* ---- objetivo en una posición real ---- */
function runGoal(s) {
  const c = new Chess(s.fen);
  L.st = { kind: 'goal', chess: c, color: c.turn(), last: null };
  board.orientation(c.turn() === 'w' ? 'white' : 'black');
  renderChess();
}

function renderChess() {
  const st = L.st;
  board.set(st.chess, { lastMove: st.last, userColor: L.done || L.busy ? null : st.color, shapes: board.cg.state.drawable.autoShapes });
}

function meets(s, mv, c) {
  const acc = s.accept ? s.accept.some((a) => mv.lan.startsWith(a)) : true;
  const ok = {
    mate: () => c.isCheckmate(), check: () => c.inCheck(), promote: () => !!mv.promotion,
    castle: () => mv.flags.includes('k') || mv.flags.includes('q'), capture: () => !!mv.captured, any: () => true, moves: () => true,
  }[s.goal]();
  return ok && acc;
}

function onGoalMove(orig, dest, promotion) {
  const s = L.steps[L.i];
  const st = L.st;
  const before = st.chess.fen();
  let mv;
  try { mv = st.chess.move({ from: orig, to: dest, promotion: promotion || 'q' }); } catch { return renderChess(); }
  st.last = [mv.from, mv.to];
  sfx.play(mv, st.chess);
  if (meets(s, mv, st.chess)) {
    L.done = true;
    renderChess();
    return success();
  }
  let why = s.wrong || 'Esa no es. Inténtalo otra vez.';
  if (st.chess.isStalemate()) why = '¡Ahogado! El rival no puede mover y no está en jaque: eso serían <b>tablas</b>.';
  else if (s.goal === 'mate' && st.chess.inCheck()) why = 'Es jaque, pero el rey todavía puede escapar o defenderse.';
  else if (s.goal === 'check' && !st.chess.inCheck()) why = 'Eso no ataca al rey. Busca una casilla desde la que tu pieza ataque al rey.';
  fail(why);
  L.busy = true;
  renderChess();
  const tok = L.token;
  setTimeout(() => {
    if (tok !== L.token) return;
    st.chess.load(before);
    st.last = null;
    L.busy = false;
    renderChess();
  }, 1100);
}

/* ---- secuencia fija / problema de Lichess ---- */
async function runLine(s) {
  const fen = s.puz ? s.puz.fen : s.fen;
  const c = new Chess(fen);
  const oppFirst = !!(s.puz || s.oppFirst);
  L.st = { kind: 'line', chess: c, moves: s.puz ? s.puz.moves : s.moves, idx: 0, color: oppFirst ? (c.turn() === 'w' ? 'b' : 'w') : c.turn(), last: null, puzzle: !!s.puz };
  board.orientation(L.st.color === 'w' ? 'white' : 'black');
  if (oppFirst) {
    L.busy = true;
    renderChess();
    const tok = L.token;
    await sleep(650);
    if (tok !== L.token) return;
    playLineOpp();
    L.busy = false;
  }
  renderChess();
  if (s.puz) setText(`${s.text}<div class="sm muted" style="margin-top:4px">Juegan las <b>${L.st.color === 'w' ? 'blancas' : 'negras'}</b>.</div>`);
}

function playLineOpp() {
  const st = L.st;
  const mv = st.chess.move(uciObj(st.moves[st.idx]));
  st.idx++;
  st.last = [mv.from, mv.to];
  sfx.play(mv, st.chess);
}

async function onLineMove(orig, dest, promotion) {
  const st = L.st;
  let mv;
  try { mv = st.chess.move({ from: orig, to: dest, promotion: promotion || 'q' }); } catch { return renderChess(); }
  const expected = st.moves[st.idx];
  if (mv.lan === expected || mv.lan.startsWith(expected) || (st.puzzle && st.chess.isCheckmate())) {
    st.idx++;
    st.last = [mv.from, mv.to];
    sfx.play(mv, st.chess);
    if (st.idx >= st.moves.length || st.chess.isCheckmate()) {
      L.done = true;
      renderChess();
      return success();
    }
    feedback('✅ ¡Bien! Sigue…', 'ok');
    L.busy = true;
    renderChess();
    const tok = L.token;
    await sleep(500);
    if (tok !== L.token) return;
    playLineOpp();
    L.busy = false;
    renderChess();
    return;
  }
  st.chess.undo();
  renderChess();
  fail(`<b>${fig(mv.san)}</b> no es la jugada. Inténtalo otra vez.`);
}

/* ---- jugar contra el motor ---- */
function runPlayout(s) {
  const c = new Chess(s.fen);
  L.st = { kind: 'playout', chess: c, color: c.turn(), count: 0, last: null, max: s.maxMoves };
  board.orientation(c.turn() === 'w' ? 'white' : 'black');
  renderChess();
  counter();
}

function counter() {
  const st = L.st;
  $('ln-options').innerHTML = `<span class="pill">Jugadas: ${st.count}/${st.max}</span>`;
}

async function onPlayoutMove(orig, dest, promotion) {
  const s = L.steps[L.i];
  const st = L.st;
  let mv;
  try { mv = st.chess.move({ from: orig, to: dest, promotion: promotion || 'q' }); } catch { return renderChess(); }
  st.count++;
  st.last = [mv.from, mv.to];
  sfx.play(mv, st.chess);
  board.shapes([]);
  counter();
  if ((s.goal === 'mate' && st.chess.isCheckmate()) || (s.goal === 'promote' && mv.promotion)) {
    L.done = true;
    renderChess();
    return success(`¡Conseguido en ${st.count} jugadas!`);
  }
  if (st.chess.isStalemate()) return playoutFail('¡Ahogado! El rey rival no puede mover: tablas. Pulsa <b>Reintentar</b>.');
  if (st.chess.isDraw()) return playoutFail('La partida ha acabado en tablas. Pulsa <b>Reintentar</b>.');
  if (st.count >= st.max) return playoutFail(`Se acabaron las ${st.max} jugadas. Pulsa <b>Reintentar</b>.`);
  L.busy = true;
  renderChess();
  const tok = L.token;
  const an = await engine.analyze(st.chess.fen(), { depth: 12, movetime: 900 });
  if (tok !== L.token || !an?.lines?.[0]?.pv?.[0]) return;
  await sleep(250);
  const r = st.chess.move(uciObj(an.lines[0].pv[0]));
  st.last = [r.from, r.to];
  sfx.play(r, st.chess);
  L.busy = false;
  if (s.goal === 'promote' && !st.chess.board().flat().some((p) => p && p.type === 'p' && p.color === st.color)) {
    return playoutFail('Te han comido el peón. Pulsa <b>Reintentar</b>.');
  }
  if (st.chess.isDraw()) return playoutFail('Tablas. Pulsa <b>Reintentar</b>.');
  renderChess();
}

function playoutFail(msg) {
  L.done = true;
  L.busy = false;
  renderChess();
  fail(msg);
}

/* ------------------------------------------------------------------ */
function onMove(orig, dest, promotion) {
  if (L.done || L.busy) return;
  const k = L.st.kind;
  if (k === 'stars') return onStarsMove(orig, dest);
  if (k === 'goal') return onGoalMove(orig, dest, promotion);
  if (k === 'line') return onLineMove(orig, dest, promotion);
  if (k === 'playout') return onPlayoutMove(orig, dest, promotion);
}

async function hint() {
  if (L.done || L.busy) return;
  const s = L.steps[L.i];
  const st = L.st;
  L.errors++;
  let uci = null;
  if (st.kind === 'stars') {
    const d = pieceDests(st.piece, st.pos, st.enemies);
    const t = d.find((x) => st.stars.has(x) || st.enemies.has(x));
    if (t) uci = st.pos + t;
    else { board.shapes([...board.cg.state.drawable.autoShapes, { orig: st.pos, brush: 'green' }]); feedback('💡 Ninguna estrella está a tu alcance todavía: acércate en dos jugadas.', 'info'); return; }
  } else if (st.kind === 'goal') {
    uci = s.accept?.[0] || st.chess.moves({ verbose: true }).find((m) => {
      const c = new Chess(st.chess.fen());
      return meets(s, c.move({ from: m.from, to: m.to, promotion: m.promotion }), c);
    })?.lan;
  } else if (st.kind === 'line') {
    uci = st.moves[st.idx];
  } else if (st.kind === 'playout') {
    feedback('💡 Pensando…', 'info');
    const an = await engine.analyze(st.chess.fen(), { depth: 14, movetime: 1500 });
    uci = an?.lines?.[0]?.pv?.[0];
  }
  if (!uci) return;
  const shapes = st.kind === 'stars' ? board.cg.state.drawable.autoShapes : [];
  board.shapes([...shapes, { orig: uci.slice(0, 2), dest: uci.slice(2, 4), brush: 'green' }]);
  feedback('💡 Mira la flecha verde. (Las pistas cuentan como fallo para las estrellas.)', 'info');
}

function setText(html) { $('ln-text').innerHTML = html; }

function feedback(html, kind = '') {
  const f = $('ln-feedback');
  f.hidden = !html;
  f.innerHTML = html;
  f.className = 'bubble ' + kind;
}

/** Comprueba todas las posiciones y soluciones del temario (para desarrollo: __validateLessons()). */
export function validateLessons() {
  const errs = [];
  for (const l of LESSONS) {
    l.steps.forEach((s, i) => {
      const where = `${l.id}#${i + 1}`;
      try {
        if (s.t === 'goal') {
          const c = new Chess(s.fen);
          const moves = c.moves({ verbose: true });
          const good = moves.filter((m) => { const c2 = new Chess(s.fen); return meets(s, c2.move({ from: m.from, to: m.to, promotion: m.promotion }), c2); });
          if (!good.length) errs.push(`${where}: ninguna jugada cumple el objetivo`);
          if (s.accept) for (const a of s.accept) if (!moves.some((m) => m.lan.startsWith(a))) errs.push(`${where}: ${a} no es legal`);
        }
        if (s.t === 'line') {
          const c = new Chess(s.fen);
          for (const u of s.moves) c.move(uciObj(u));
        }
        if (s.t === 'playout') new Chess(s.fen);
        if (s.t === 'stars') {
          const targets = [...(s.stars || []), ...Object.keys(s.enemies || {})];
          // búsqueda en anchura para comprobar que todas se pueden alcanzar
          const enemies = new Map(Object.entries(s.enemies || {}));
          const seen = new Set([s.from]);
          const q = [s.from];
          while (q.length) { const p = q.shift(); for (const d of pieceDests(s.piece, p, enemies)) if (!seen.has(d)) { seen.add(d); q.push(d); } }
          for (const t of targets) if (!seen.has(t)) errs.push(`${where}: ${t} inalcanzable`);
        }
      } catch (e) { errs.push(`${where}: ${e.message}`); }
    });
  }
  return errs;
}
