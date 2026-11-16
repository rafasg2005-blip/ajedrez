// Vista "Aperturas": aprender y practicar líneas principales.
import { Chess, fig, sleep, esc, uciObj, wp } from './util.js';
import { Board } from './board.js';
import { TRAINER_LINES, inBook, openingName } from './book.js';
import { engine } from './engine.js';
import { sfx } from './sound.js';
import { store } from './storage.js';

let app, board;
const O = { line: null, moves: [], chess: new Chess(), idx: 0, errors: 0, busy: false, watching: false, token: 0 };
const $ = (id) => document.getElementById(id);

export function initOpenings(_app) {
  app = _app;
  board = new Board('op-host', 'op-board', { onMove });
  $('op-back').onclick = () => showList();
  $('op-restart').onclick = () => startLine(O.line);
  $('op-watch').onclick = () => watch();
  $('op-play').onclick = () => {
    app.play.newGame({ color: O.line.side, adaptive: true, sans: O.moves.slice(0, O.idx) });
  };
  for (const l of TRAINER_LINES) {
    try {
      const c = new Chess();
      l.moves.split(' ').forEach((m) => c.move(m));
    } catch (e) { console.warn('Línea no válida', l.id, e.message); }
  }
  showList();
  return { onShow: () => board.redraw(), board };
}

function stars(id) {
  const s = store.openings()[id] || { done: 0, clean: 0 };
  const n = Math.min(3, s.clean);
  return `<span class="stars" title="Repeticiones sin fallos: ${s.clean}">${'★'.repeat(n)}${'☆'.repeat(3 - n)}</span>`;
}

function showList() {
  O.token++;
  O.line = null;
  $('op-current').hidden = true;
  const groups = [
    ['Con blancas', TRAINER_LINES.filter((l) => l.side === 'w')],
    ['Con negras contra 1.e4', TRAINER_LINES.filter((l) => l.side === 'b' && l.moves.startsWith('e4'))],
    ['Con negras contra 1.d4', TRAINER_LINES.filter((l) => l.side === 'b' && !l.moves.startsWith('e4'))],
  ];
  $('op-list').innerHTML = `<div class="card"><b>Entrenador de aperturas</b><p class="muted" style="margin:6px 0 0">
    Elige una apertura. El rival juega su parte y tú tienes que encontrar las jugadas de la línea principal.
    Consigue 3 estrellas repitiéndola sin fallos.</p></div>` +
    groups.map(([t, ls]) => `<div class="op-group"><h4>${t}</h4>${ls.map((l) => `
      <button class="op-card" data-id="${l.id}"><div class="t"><b>${esc(l.name)}</b>${stars(l.id)}</div>
      <div class="m">${fig(l.moves.split(' ').slice(0, 6).map((m, i) => (i % 2 ? '' : `${i / 2 + 1}.`) + m).join(' '))}…</div></button>`).join('')}</div>`).join('');
  $('op-list').hidden = false;
  $('op-list').querySelectorAll('.op-card').forEach((b) => (b.onclick = () => startLine(TRAINER_LINES.find((l) => l.id === b.dataset.id))));
  O.chess = new Chess();
  board.orientation('white');
  board.set(O.chess, {});
  $('op-top').innerHTML = '';
  $('op-bottom').innerHTML = '';
}

async function startLine(line) {
  O.token++;
  const tok = O.token;
  O.line = line;
  O.moves = line.moves.split(' ');
  O.chess = new Chess();
  O.idx = 0; O.errors = 0; O.busy = false; O.watched = false;
  $('op-list').hidden = true;
  $('op-current').hidden = false;
  $('op-name').textContent = line.name;
  $('op-side').textContent = line.side === 'w' ? 'Juegas con blancas' : 'Juegas con negras';
  $('op-idea').textContent = line.idea;
  board.orientation(line.side === 'w' ? 'white' : 'black');
  board.clearBadges();
  $('op-top').innerHTML = '<span class="name">Rival</span>';
  $('op-bottom').innerHTML = '<span class="name">Tú</span>';
  msg('Haz las jugadas de la línea. Si no sabes cuál toca, pulsa <b>Ver la línea</b>.', '');
  render();
  await autoOpp(tok);
}

/** El rival juega sus jugadas de la línea. */
async function autoOpp(tok) {
  while (O.idx < O.moves.length && O.chess.turn() !== O.line.side) {
    O.busy = true;
    render();
    await sleep(500);
    if (tok !== O.token) return;
    const mv = O.chess.move(O.moves[O.idx]);
    O.idx++;
    sfx.play(mv, O.chess);
    O.last = [mv.from, mv.to];
  }
  O.busy = false;
  render();
  if (O.idx >= O.moves.length) complete();
}

async function onMove(from, to, promotion) {
  if (O.busy || !O.line || O.idx >= O.moves.length) return render();
  const fen = O.chess.fen();
  let mv;
  try { mv = O.chess.move({ from, to, promotion: promotion || 'q' }); } catch { return render(); }
  const expected = O.moves[O.idx];
  const strip = (s) => s.replace(/[+#]$/, '');
  if (strip(mv.san) === strip(expected)) {
    O.idx++;
    O.last = [mv.from, mv.to];
    sfx.play(mv, O.chess);
    const tips = ['¡Correcto!', '¡Eso es!', '¡Muy bien!', 'Exacto.'];
    msg(`✅ ${tips[Math.floor(Math.random() * tips.length)]} <b>${fig(mv.san)}</b>`, 'ok');
    render();
    await autoOpp(O.token);
    return;
  }
  // jugada distinta: explica si es de libro o si es mala
  O.errors++;
  const sans = [...O.moves.slice(0, O.idx), mv.san];
  const book = inBook(sans);
  O.chess.load(fen);
  render();
  sfx.bad();
  if (book) {
    const n = openingName(sans);
    msg(`📖 <b>${fig(mv.san)}</b> también es teoría${n ? ` (${esc(n.name)})` : ''}, pero en esta línea se juega otra cosa. Inténtalo de nuevo.`, 'info');
  } else {
    msg(`Analizando <b>${fig(mv.san)}</b>…`, 'info');
    const tok = O.token;
    const c2 = new Chess(fen); c2.move(mv.san);
    const [b, a] = await Promise.all([engine.cached(fen, { depth: 12, movetime: 1200 }), engine.analyze(c2.fen(), { depth: 12, movetime: 1200 })]);
    if (tok !== O.token) return;
    const loss = Math.max(0, wp(b.lines[0].score) - (100 - wp(a.lines[0].score)));
    const verdict = loss < 5 ? 'no es mala, pero no es la de esta línea' : loss < 12 ? 'es una imprecisión' : 'es un error: te deja peor';
    msg(`❌ <b>${fig(mv.san)}</b> ${verdict}. Prueba otra vez (pulsa <b>Ver la línea</b> si te atascas).`, 'bad');
  }
  board.shapes([]);
}

function complete() {
  const st = store.openings();
  const s = st[O.line.id] || { done: 0, clean: 0 };
  s.done++;
  if (O.errors === 0 && !O.watched) s.clean++;
  st[O.line.id] = s;
  store.saveOpenings(st);
  sfx.good();
  msg(`🎉 ¡Línea completada${O.errors ? ` con ${O.errors} fallo${O.errors > 1 ? 's' : ''}` : ' sin fallos'}! ${stars(O.line.id)}<br>
    Puedes repetirla o pulsar <b>Jugar desde aquí</b> para seguir la partida contra el entrenador.`, 'ok');
}

async function watch() {
  if (!O.line) return;
  O.token++;
  const tok = O.token;
  O.watched = true;
  O.chess = new Chess();
  O.idx = 0; O.busy = true;
  msg('Mira la línea completa…', 'info');
  for (const m of O.moves) {
    await sleep(800);
    if (tok !== O.token) return;
    const mv = O.chess.move(m);
    O.idx++;
    O.last = [mv.from, mv.to];
    sfx.play(mv, O.chess);
    render();
  }
  O.busy = false;
  msg('Ahora te toca a ti: pulsa <b>Repetir</b> y hazla de memoria.', 'info');
  render();
}

function render() {
  const can = O.line && !O.busy && O.idx < O.moves.length;
  board.set(O.chess, { lastMove: O.idx ? O.last : null, userColor: can ? O.line.side : null });
  if (!O.line) return;
  $('op-progress').style.width = (O.idx / O.moves.length) * 100 + '%';
  $('op-moves').innerHTML = O.moves.map((m, i) => {
    const num = i % 2 === 0 ? `${i / 2 + 1}.` : '';
    const mine = (i % 2 === 0) === (O.line.side === 'w');
    const txt = i < O.idx ? fig(m) : mine ? '?' : '…';
    return `<span class="tok ${i < O.idx ? 'done' : ''} ${i === O.idx ? 'next' : ''}">${num}${txt}</span>`;
  }).join('');
}

function msg(html, kind) {
  const m = $('op-msg');
  m.innerHTML = html;
  m.className = 'bubble ' + (kind || '');
}
