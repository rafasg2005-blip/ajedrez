// Vista "Revisión": análisis completo de una partida, jugada a jugada.
import { Chess, uciObj, wp, fmtScore, fig, pvToSan, fenKey, esc, toast } from './util.js';
import { engine } from './engine.js';
import { Board, setEvalBar } from './board.js';
import { classify, CLS, CLS_ORDER, BAD, COACH_DEPTH, summarize, moveAccuracy } from './coach.js';
import { inBook, openingName } from './book.js';
import { store } from './storage.js';
import { compactAnalysis } from './play.js';
import { sfx } from './sound.js';

const A = { ...COACH_DEPTH, multipv: 2 };
let app, board;
const R = { rec: null, fens: [], moves: [], an: [], infos: [], cur: -1, token: 0, retry: null };
const $ = (id) => document.getElementById(id);

export function initReview(_app) {
  app = _app;
  board = new Board('rv-host', 'rv-board', { onMove: onRetryMove });
  $('rv-first').onclick = () => go(-1);
  $('rv-prev').onclick = () => go(R.cur - 1);
  $('rv-next').onclick = () => go(R.cur + 1);
  $('rv-last').onclick = () => go(R.moves.length - 1);
  $('rv-flip').onclick = () => { board.flip(); render(); };
  document.addEventListener('keydown', (e) => {
    if (!$('view-review').classList.contains('active') || e.target.closest('input,select')) return;
    if (e.key === 'ArrowLeft') { go(R.cur - 1); e.preventDefault(); }
    if (e.key === 'ArrowRight') { go(R.cur + 1); e.preventDefault(); }
    if (e.key === 'Home') go(-1);
    if (e.key === 'End') go(R.moves.length - 1);
  });
  return { open, onShow: () => board.redraw(), board };
}

const expand = (c) => (c ? { terminal: c.t, lines: c.l.map((x) => ({ score: x.s, pv: x.pv })) } : null);

async function open(id) {
  const rec = store.games().find((g) => g.id === id);
  if (!rec) return toast('No encuentro esa partida.');
  R.token++;
  const tok = R.token;
  R.rec = rec;
  R.retry = null;
  const c = new Chess();
  R.fens = [c.fen()];
  R.moves = [];
  for (const u of rec.ucis) { R.moves.push(c.move(uciObj(u))); R.fens.push(c.fen()); }
  R.an = R.fens.map((_, i) => expand(rec.an?.[i]));
  R.infos = [];
  R.cur = -1;
  board.orientation(rec.userColor === 'w' ? 'white' : 'black');
  app.show('review');
  board.redraw();
  renderTags();
  $('rv-summary').innerHTML = '<span class="muted">Preparando…</span>';
  $('rv-graph').innerHTML = '';
  $('rv-moves').innerHTML = '';
  setComment('Analizando la partida con el motor. Puedes ir mirando las jugadas mientras tanto.');
  render();

  // analiza las posiciones que falten
  const missing = R.an.map((a, i) => (a ? -1 : i)).filter((i) => i >= 0);
  if (missing.length) {
    $('rv-progress-card').hidden = false;
    let done = 0;
    $('rv-progress').style.width = '0%';
    await Promise.all(missing.map((i) => engine.cached(R.fens[i], { ...A, tag: 'review' }).then((a) => {
      if (tok !== R.token) return;
      R.an[i] = a;
      done++;
      $('rv-progress').style.width = (done / missing.length) * 100 + '%';
    })));
    if (tok !== R.token) return;
    $('rv-progress-card').hidden = true;
  }
  // clasifica todas las jugadas
  for (let i = 0; i < R.moves.length; i++) {
    const sans = rec.sans.slice(0, i + 1);
    R.infos[i] = classify({
      fenBefore: R.fens[i], uci: R.moves[i].lan, before: R.an[i], after: R.an[i + 1],
      isBook: inBook(sans), openingName: openingName(sans)?.name,
      prevMove: R.moves[i - 1], prevOppLoss: R.infos[i - 1]?.loss ?? 0, you: R.moves[i].color === rec.userColor,
    });
  }
  // guarda
  const you = summarize(R.infos.filter((x) => x.you));
  const opp = summarize(R.infos.filter((x) => !x.you));
  rec.an = R.an.map(compactAnalysis);
  rec.infos = R.infos.map((i) => ({ c: i.cls, l: Math.round(i.loss * 10) / 10 }));
  rec.acc = you.accuracy;
  rec.accOpp = opp.accuracy;
  rec.reviewed = true;
  const games = store.games().map((g) => (g.id === rec.id ? rec : g));
  store.saveGames(games);
  saveMistakes();
  renderSummary(you, opp);
  renderGraph();
  renderMoves();
  render();
  // empieza en el primer error tuyo, si lo hay
  const firstBad = R.infos.findIndex((x) => x.you && (x.cls === 'blunder' || x.cls === 'mistake' || x.cls === 'miss'));
  setComment(firstBad >= 0
    ? `Análisis listo. Tu primer error importante fue en la jugada ${Math.floor(firstBad / 2) + 1}. Usa ◀ ▶ (o las flechas del teclado) para recorrer la partida.`
    : 'Análisis listo. ¡Ningún error grave! Usa ◀ ▶ (o las flechas del teclado) para recorrer la partida.');
}

function saveMistakes() {
  const ms = store.mistakes();
  const seen = new Set(ms.map((m) => m.k));
  R.infos.forEach((info, i) => {
    if (!info.you || !['mistake', 'blunder', 'miss'].includes(info.cls) || !info.bestUci) return;
    const k = fenKey(R.fens[i]);
    if (seen.has(k)) return;
    seen.add(k);
    ms.push({ k, fen: R.fens[i], best: info.bestUci, bestSan: info.bestSan, played: info.san, wb: info.wb, cls: info.cls, game: R.rec.id, date: R.rec.date });
  });
  store.saveMistakes(ms);
}

function go(i) {
  if (!R.rec) return;
  R.cur = Math.max(-1, Math.min(R.moves.length - 1, i));
  R.retry = null;
  const m = R.moves[R.cur];
  if (m) sfx.play(m, new Chess(R.fens[R.cur + 1]));
  render();
}

function render() {
  if (!R.rec) return;
  const fen = R.fens[R.cur + 1];
  const chess = new Chess(fen);
  const m = R.moves[R.cur];
  const info = R.infos[R.cur];
  const shapes = [];
  if (info && info.bestUci && info.bestUci !== info.uci && !['book', 'best', 'brilliant', 'great'].includes(info.cls)) {
    shapes.push({ orig: info.bestUci.slice(0, 2), dest: info.bestUci.slice(2, 4), brush: 'green' });
  }
  board.set(chess, { lastMove: m ? [m.from, m.to] : null, userColor: null, shapes });
  if (m && info) board.badge(m.to, info.cls); else board.clearBadges();
  // barra de evaluación
  const an = R.an[R.cur + 1];
  if (an?.lines?.length) {
    const turn = fen.split(' ')[1];
    let w = wp(an.lines[0].score);
    if (an.terminal === 'mate') w = 0;
    if (an.terminal === 'draw') w = 50;
    let lbl = an.terminal === 'mate' ? '#' : fmtScore(an.lines[0].score, turn === 'w' ? 1 : -1).replace(/^[+-]/, '');
    setEvalBar('rv-evalbar', turn === 'w' ? w : 100 - w, lbl, board.orient);
  }
  // comentario y acciones
  const actions = $('rv-actions');
  actions.innerHTML = '';
  if (m && info) {
    const num = `${Math.floor(R.cur / 2) + 1}${R.cur % 2 ? '…' : '.'}`;
    let html = `<b>${num} ${fig(m.san)}</b> — ${info.comment}`;
    const before = R.an[R.cur];
    if (before?.lines?.[0] && !['best', 'book', 'brilliant', 'great'].includes(info.cls)) {
      const line = pvToSan(R.fens[R.cur], before.lines[0].pv, 6);
      html += `<div class="sm" style="margin-top:6px">Línea del motor: ${fig(line.join(' '))}</div>`;
    }
    setComment(html, info.cls);
    if (info.you && (BAD.has(info.cls) || info.cls === 'good')) {
      addAction('🔁 Reintentar esta jugada', () => startRetry(), true);
    }
    addAction('♟ Jugar desde aquí', () => {
      app.play.newGame({ color: R.rec.userColor, adaptive: true, sans: R.rec.sans.slice(0, info.you ? R.cur : R.cur + 1) });
    });
  } else if (R.cur === -1 && R.infos.length) {
    setComment('Posición inicial. Pulsa ▶ para avanzar.');
  }
  renderMoves();
  renderGraph();
}

function addAction(label, fn, primary) {
  const b = document.createElement('button');
  b.textContent = label;
  if (primary) b.className = 'primary';
  b.onclick = fn;
  $('rv-actions').appendChild(b);
}

function startRetry() {
  const i = R.cur;
  R.retry = { ply: i, tries: 0 };
  const chess = new Chess(R.fens[i]);
  const prev = R.moves[i - 1];
  board.set(chess, { lastMove: prev ? [prev.from, prev.to] : null, userColor: chess.turn(), shapes: [] });
  board.clearBadges();
  setComment(`Vuelve a intentarlo: en la partida jugaste <b>${fig(R.moves[i].san)}</b>. ¿Qué jugarías ahora?`, null);
  $('rv-actions').innerHTML = '';
  addAction('Ver la solución', () => {
    const info = R.infos[i];
    board.shapes([{ orig: info.bestUci.slice(0, 2), dest: info.bestUci.slice(2, 4), brush: 'green' }]);
    setComment(`La mejor era <b>${fig(info.bestSan)}</b>.`, null);
  });
  addAction('Volver', () => { R.retry = null; render(); });
}

async function onRetryMove(from, to, promotion) {
  if (!R.retry) return;
  const i = R.retry.ply;
  const fen = R.fens[i];
  const chess = new Chess(fen);
  let mv;
  try { mv = chess.move({ from, to, promotion: promotion || 'q' }); } catch { return startRetry(); }
  board.set(chess, { lastMove: [mv.from, mv.to], userColor: null });
  setComment('Comprobando…', null);
  const after = await engine.cached(chess.fen(), A);
  if (!R.retry || R.retry.ply !== i) return;
  const info = classify({ fenBefore: fen, uci: mv.lan, before: R.an[i], after, isBook: false, prevMove: R.moves[i - 1], prevOppLoss: R.infos[i - 1]?.loss ?? 0, you: true });
  board.badge(mv.to, info.cls);
  if (info.loss < 5) {
    sfx.good();
    setComment(`✅ ¡Mucho mejor! ${info.comment}`, info.cls);
    R.retry = null;
    $('rv-actions').innerHTML = '';
    addAction('Seguir revisando', () => render(), true);
  } else {
    sfx.bad();
    R.retry.tries++;
    setComment(`${info.comment}<div class="sm" style="margin-top:6px">Prueba otra vez.</div>`, info.cls);
    setTimeout(() => { if (R.retry && R.retry.ply === i) { const c = new Chess(fen); board.set(c, { userColor: c.turn() }); } }, 1400);
  }
}

function setComment(html, cls) {
  const b = $('rv-comment');
  b.innerHTML = html;
  b.style.borderLeftColor = cls ? CLS[cls].color : '';
}

function renderTags() {
  const rec = R.rec;
  const top = board.orient === 'white' ? 'b' : 'w';
  const tag = (c) => (c === rec.userColor ? '<span class="name">Tú</span>' : `<span class="name">🤖 Entrenador</span> <span class="elo">(ELO ${rec.botElo})</span>`);
  $('rv-top').innerHTML = tag(top);
  $('rv-bottom').innerHTML = tag(top === 'w' ? 'b' : 'w');
}

function renderSummary(you, opp) {
  const rec = R.rec;
  const res = rec.score === 1 ? 'Victoria' : rec.score === 0 ? 'Derrota' : 'Tablas';
  const rows = CLS_ORDER.map((k) => {
    const a = you.counts[k], b = opp.counts[k];
    return `<tr class="${a + b ? '' : 'zero'}"><td class="n">${a}</td><td><span class="mini" style="background:${CLS[k].color}">${CLS[k].sym}</span> ${CLS[k].label}</td><td class="n">${b}</td></tr>`;
  }).join('');
  $('rv-summary').innerHTML = `
    <div style="margin-bottom:8px"><b>${res}</b> por ${esc(rec.reason)} · <span class="muted">${esc(rec.opening || 'Apertura desconocida')}</span></div>
    <div class="acc">
      <div><b>${you.accuracy?.toFixed(1) ?? '–'}</b><span>Tu precisión</span></div>
      <div><b>${opp.accuracy?.toFixed(1) ?? '–'}</b><span>Rival (ELO ${rec.botElo})</span></div>
    </div>
    <table class="counts"><tr><td class="n muted">Tú</td><td></td><td class="n muted">Rival</td></tr>${rows}</table>`;
}

function renderGraph() {
  if (!R.infos.length) return;
  const n = R.an.length;
  const W = 400, H = 90;
  const pts = R.an.map((a, i) => {
    let w = 50;
    if (a?.lines?.length) {
      w = wp(a.lines[0].score);
      if (a.terminal === 'mate') w = 0;
      if (a.terminal === 'draw') w = 50;
      if (R.fens[i].split(' ')[1] === 'b') w = 100 - w;
    }
    return [(i / Math.max(1, n - 1)) * W, H - (w / 100) * H];
  });
  const area = `M0,${H} ` + pts.map((p) => `L${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') + ` L${W},${H} Z`;
  const dots = R.infos.map((info, i) => {
    if (!['blunder', 'mistake', 'miss', 'brilliant', 'great'].includes(info.cls)) return '';
    const p = pts[i + 1];
    return `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="${CLS[info.cls].color}" stroke="#222" stroke-width="1"/>`;
  }).join('');
  const cx = ((R.cur + 1) / Math.max(1, n - 1)) * W;
  $('rv-graph').innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <rect width="${W}" height="${H}" fill="#403d39"/>
    <path d="${area}" fill="#f2f0ec"/>
    <line x1="0" x2="${W}" y1="${H / 2}" y2="${H / 2}" stroke="#888" stroke-dasharray="3 3" stroke-width=".7"/>
    <line x1="${cx}" x2="${cx}" y1="0" y2="${H}" stroke="#81b64c" stroke-width="2"/>
    ${dots}</svg>`;
  const svg = $('rv-graph').querySelector('svg');
  svg.onclick = (e) => {
    const r = svg.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left) / r.width) * (n - 1)) - 1;
    go(i);
  };
}

function renderMoves() {
  const box = $('rv-moves');
  let html = '';
  for (let i = 0; i < R.moves.length; i += 2) {
    html += `<div class="mrow"><span class="mnum">${i / 2 + 1}.</span>${cell(i)}${cell(i + 1)}</div>`;
  }
  box.innerHTML = html;
  box.querySelectorAll('.mv[data-i]').forEach((e) => (e.onclick = () => go(+e.dataset.i)));
  const cur = box.querySelector('.mv.cur');
  if (cur) {
    const top = cur.offsetTop - box.offsetTop;
    if (top < box.scrollTop || top > box.scrollTop + box.clientHeight - 30) box.scrollTop = top - box.clientHeight / 2;
  }
}

function cell(i) {
  const m = R.moves[i];
  if (!m) return '<span></span>';
  const info = R.infos[i];
  const b = info ? `<span class="mini" style="background:${CLS[info.cls].color}" title="${CLS[info.cls].label}">${CLS[info.cls].sym}</span>` : '';
  return `<span class="mv ${R.cur === i ? 'cur' : ''}" data-i="${i}">${b}${fig(m.san)}</span>`;
}
