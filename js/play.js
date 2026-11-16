// Vista "Jugar": partida contra el entrenador con comentarios en vivo.
import { Chess, uciObj, wp, fmtScore, fig, sleep, captured, modal, toast, fenKey, sideName, esc } from './util.js';
import { engine } from './engine.js';
import { Board, setEvalBar } from './board.js';
import { classify, CLS, BAD, COACH_DEPTH, findThreat, summarize } from './coach.js';
import { botParams, pickMove, updateRating } from './bot.js';
import { inBook, openingName, TRAINER_LINES } from './book.js';
import { sfx } from './sound.js';
import { store } from './storage.js';

const A = { ...COACH_DEPTH, multipv: 2 };
const strip = (s) => s.replace(/[+#]$/, '');

let app, board;
const S = {
  chess: new Chess(), userColor: 'w', botElo: 650, adaptive: true,
  token: 0, moves: [], sans: [], fens: [new Chess().fen()], infos: [], analyses: [],
  over: true, paused: false, botThinking: false, hint: 0, takebacks: 0, hints: 0,
  fromPosition: false, line: null, lineName: '', lineBroken: false, oppWarning: '', viewing: null,
};

const $ = (id) => document.getElementById(id);
const settings = () => app.profile.settings;

export function initPlay(_app) {
  app = _app;
  board = new Board('play-host', 'play-board', { onMove: onUserMove });
  $('play-new').onclick = () => newGameDialog();
  $('play-undo').onclick = () => undo();
  $('play-hint').onclick = () => hint();
  $('play-threat').onclick = () => threat();
  $('play-flip').onclick = () => { board.flip(); renderAll(); };
  $('play-resign').onclick = () => resign();
  renderAll();
  return { newGame, board, isActive: () => !S.over };
}

/* ------------------------------------------------------------------ */
/* Nueva partida                                                       */
/* ------------------------------------------------------------------ */
async function newGameDialog() {
  const st = settings();
  const r = app.profile.rating;
  const opts = TRAINER_LINES.map((l) => `<option value="${l.id}">${esc(l.name)} (${l.side === 'w' ? 'con blancas' : 'con negras'})</option>`).join('');
  const act = await modal(`
    <h2>Nueva partida</h2>
    <div class="field"><span>Tu color</span>
      <div class="seg" id="ng-color">
        <button data-c="w">♔ Blancas</button><button data-c="r">🎲 Aleatorio</button><button data-c="b">♚ Negras</button>
      </div></div>
    <div class="field"><span>Nivel del rival</span>
      <div class="seg" id="ng-mode">
        <button data-m="adaptive">Adaptativo (${r})</button><button data-m="fixed">Fijo</button>
      </div>
      <div id="ng-fixed">
        <input type="range" id="ng-elo" min="250" max="2500" step="50" value="${st.fixedElo}">
        <div class="muted">ELO del rival: <b id="ng-elo-lbl">${st.fixedElo}</b></div>
      </div>
      <p class="muted" id="ng-adapt-txt">El rival juega a tu nivel y se ajusta después de cada partida: si ganas sube, si pierdes baja.</p>
    </div>
    <div class="field"><span>Apertura (opcional)</span>
      <select id="ng-line" style="width:100%"><option value="">La que salga</option>${opts}</select>
    </div>
    <div class="toolbar"><button data-act="cancel">Cancelar</button><button class="primary" data-act="go">¡A jugar!</button></div>
  `, {
    onOpen(body) {
      const seg = (id, key, val) => {
        body.querySelectorAll(`#${id} button`).forEach((b) => {
          b.classList.toggle('active', b.dataset[key] === val);
          b.onclick = () => { body.querySelectorAll(`#${id} button`).forEach((x) => x.classList.remove('active')); b.classList.add('active'); sync(); };
        });
      };
      const sync = () => {
        const adaptive = body.querySelector('#ng-mode .active').dataset.m === 'adaptive';
        body.querySelector('#ng-fixed').hidden = adaptive;
        body.querySelector('#ng-adapt-txt').hidden = !adaptive;
      };
      seg('ng-color', 'c', st.color || 'w');
      seg('ng-mode', 'm', st.adaptive ? 'adaptive' : 'fixed');
      const rng = body.querySelector('#ng-elo');
      rng.oninput = () => (body.querySelector('#ng-elo-lbl').textContent = rng.value);
      sync();
      body.dataset.ready = '1';
    },
  });
  if (act !== 'go') return;
  const body = $('modal-body');
  st.color = body.querySelector('#ng-color .active').dataset.c;
  st.adaptive = body.querySelector('#ng-mode .active').dataset.m === 'adaptive';
  st.fixedElo = +body.querySelector('#ng-elo').value;
  const lineId = body.querySelector('#ng-line').value;
  app.saveProfile();
  let color = st.color === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : st.color;
  const line = TRAINER_LINES.find((l) => l.id === lineId);
  if (line && st.color === 'r') color = line.side;
  newGame({ color, adaptive: st.adaptive, elo: st.fixedElo, line });
}

/**
 * opts: {color, adaptive, elo, line, sans (jugadas iniciales para "jugar desde aquí")}
 */
export function newGame(opts = {}) {
  engine.cancel('bot');
  S.token++;
  S.chess = new Chess();
  S.moves = []; S.sans = []; S.fens = [S.chess.fen()]; S.infos = []; S.analyses = [];
  S.userColor = opts.color || 'w';
  S.adaptive = opts.adaptive ?? true;
  S.botElo = S.adaptive ? app.profile.rating : opts.elo || 800;
  S.over = false; S.paused = false; S.botThinking = false; S.hint = 0; S.takebacks = 0; S.hints = 0;
  S.line = opts.line ? opts.line.moves.split(' ') : null;
  S.lineName = opts.line?.name || '';
  S.lineBroken = false; S.oppWarning = ''; S.viewing = null;
  S.fromPosition = !!(opts.sans && opts.sans.length);
  S.id = Date.now().toString(36);
  for (const san of opts.sans || []) {
    const fb = S.chess.fen();
    const mv = S.chess.move(san);
    pushMove(mv, fb);
  }
  board.orientation(S.userColor === 'w' ? 'white' : 'black');
  board.clearBadges();
  app.show('play');
  const lvl = S.adaptive ? `de tu nivel (ELO ${S.botElo})` : `de ELO ${S.botElo}`;
  setBubble(`¡Vamos! Juegas con <b>${sideName(S.userColor)}</b> contra un rival ${lvl}.` +
    (S.line ? ` Practicamos la <b>${esc(S.lineName)}</b>.` : '') +
    (settings().coach ? ' Te comentaré cada jugada.' : ''), null);
  setActions([]);
  renderAll();
  if (S.chess.turn() !== S.userColor) botTurn(S.token);
  else preAnalyze();
}

function pushMove(mv, fenBefore) {
  S.moves.push(mv);
  S.sans.push(mv.san);
  S.fens.push(S.chess.fen());
}

/* ------------------------------------------------------------------ */
/* Jugadas                                                             */
/* ------------------------------------------------------------------ */
async function onUserMove(from, to, promotion) {
  if (S.over || S.paused || S.botThinking || S.chess.turn() !== S.userColor) return renderBoard();
  const fenBefore = S.chess.fen();
  let mv;
  try { mv = S.chess.move({ from, to, promotion: promotion || 'q' }); } catch { return renderBoard(); }
  pushMove(mv, fenBefore);
  const ply = S.moves.length - 1;
  sfx.play(mv, S.chess);
  S.hint = 0; S.oppWarning = ''; S.viewing = null;
  board.clearBadges();
  board.shapes([]);
  // ¿sale de la línea de apertura elegida?
  let lineNote = '';
  if (S.line && !S.lineBroken && ply < S.line.length && strip(mv.san) !== strip(S.line[ply])) {
    S.lineBroken = true;
    lineNote = ` <span class="sm">📖 Te sales de la línea de la ${esc(S.lineName)}: lo teórico era <b>${fig(S.line[ply])}</b>.</span>`;
  }
  renderAll();
  const tok = S.token;
  const ended = checkEnd();
  const evalP = evaluateUserMove(ply, tok, lineNote);
  if (ended) return;
  if (settings().coach && settings().pauseOnError) {
    await evalP;
    if (tok !== S.token) return;
    const info = S.infos[ply];
    if (info && (info.cls === 'mistake' || info.cls === 'blunder' || info.cls === 'miss')) {
      S.paused = true;
      setActions([
        { label: '↶ Reintentar', primary: true, fn: () => undo(true) },
        { label: '▶ Seguir así', fn: () => continueAfterPause() },
      ]);
      renderBoard();
      return;
    }
  }
  botTurn(tok);
}

function continueAfterPause() {
  S.paused = false;
  setActions([]);
  board.shapes([]);
  botTurn(S.token);
}

async function evaluateUserMove(ply, tok, lineNote = '') {
  showThinking(true);
  const [before, after] = await Promise.all([engine.cached(S.fens[ply], A), engine.cached(S.fens[ply + 1], A)]);
  showThinking(S.botThinking);
  if (tok !== S.token || !before || !after) return;
  S.analyses[ply] = before; S.analyses[ply + 1] = after;
  const sans = S.sans.slice(0, ply + 1);
  const info = classify({
    fenBefore: S.fens[ply], uci: S.moves[ply].lan, before, after,
    isBook: inBook(sans), openingName: openingName(sans)?.name,
    prevMove: S.moves[ply - 1], prevOppLoss: S.infos[ply - 1]?.loss ?? 0, you: true,
  });
  info.comment += lineNote;
  S.infos[ply] = info;
  const stillHere = S.moves.length === ply + 1;
  if (stillHere) updateEval(after, S.fens[ply + 1]);
  if (settings().coach) {
    setBubble(info.comment, info.cls);
    board.badge(S.moves[ply].to, info.cls);
    if (stillHere || S.paused) board.shapes(info.arrows);
    if (info.cls === 'brilliant' || info.cls === 'great') sfx.good();
    else if (info.cls === 'blunder' || info.cls === 'miss') sfx.bad();
    if (BAD.has(info.cls) && info.arrows.length) {
      $('play-bubble').insertAdjacentHTML('beforeend', '<div class="sm" style="margin-top:6px">Flecha verde: lo que convenía. Flecha roja: la respuesta del rival.</div>');
    }
  }
  renderMoves();
  if (S.over) finishLater();
}

async function botTurn(tok) {
  if (S.over || tok !== S.token) return;
  S.botThinking = true;
  showThinking(true);
  renderBoard();
  const t0 = performance.now();
  const fen = S.chess.fen();
  let uci = null;
  const ply = S.moves.length;
  if (S.line && !S.lineBroken && ply < S.line.length) {
    try { uci = new Chess(fen).move(S.line[ply]).lan; } catch { uci = null; }
  }
  if (!uci) {
    const p = botParams(S.botElo);
    const an = await engine.analyze(fen, { depth: p.depth, multipv: p.multipv, movetime: 2500, tag: 'bot' });
    if (tok !== S.token || !an) return;
    uci = pickMove(fen, an, S.botElo, S.sans);
  }
  const wait = 450 + Math.random() * 500 - (performance.now() - t0);
  if (wait > 0) await sleep(wait);
  if (tok !== S.token) return;
  const mv = S.chess.move(uciObj(uci));
  pushMove(mv, fen);
  S.botThinking = false;
  showThinking(false);
  sfx.play(mv, S.chess);
  board.shapes([]);
  renderAll();
  if (checkEnd()) return;
  evaluateBotMove(ply, tok);
}

/** Analiza la posición actual (para pistas y para clasificar tu próxima jugada). */
function preAnalyze() {
  const fen = S.chess.fen();
  const tok = S.token;
  engine.cached(fen, A).then((an) => {
    if (an && tok === S.token && S.chess.fen() === fen) updateEval(an, fen);
  });
}

async function evaluateBotMove(ply, tok) {
  const [before, after] = await Promise.all([engine.cached(S.fens[ply], A), engine.cached(S.fens[ply + 1], A)]);
  if (tok !== S.token || !before || !after) return;
  S.analyses[ply] = before; S.analyses[ply + 1] = after;
  const sans = S.sans.slice(0, ply + 1);
  const info = classify({
    fenBefore: S.fens[ply], uci: S.moves[ply].lan, before, after,
    isBook: inBook(sans), openingName: openingName(sans)?.name,
    prevMove: S.moves[ply - 1], prevOppLoss: S.infos[ply - 1]?.loss ?? 0, you: false,
  });
  S.infos[ply] = info;
  if (S.moves.length === ply + 1) {
    updateEval(after, S.fens[ply + 1]);
    if (settings().coach && settings().warnOpp && (info.cls === 'blunder' || info.cls === 'mistake') && !S.over) {
      S.oppWarning = info.cls === 'blunder'
        ? '😮 ¡El rival acaba de cometer un <b>error grave</b>! Busca cómo aprovecharlo.'
        : '👀 El rival no ha jugado lo mejor. Quizá haya algo bueno para ti.';
      $('play-bubble').insertAdjacentHTML('beforeend', `<div style="margin-top:8px">${S.oppWarning}</div>`);
    }
  }
  renderMoves();
  if (S.over) finishLater();
}

/* ------------------------------------------------------------------ */
/* Ayudas                                                              */
/* ------------------------------------------------------------------ */
function canAct() { return !S.over && !S.botThinking && !S.paused && S.chess.turn() === S.userColor; }

async function hint() {
  if (!canAct()) return;
  const fen = S.chess.fen();
  showThinking(true);
  const an = await engine.cached(fen, A);
  showThinking(false);
  if (!an || S.chess.fen() !== fen) return;
  const best = an.lines[0].pv[0];
  const mv = new Chess(fen).move(uciObj(best));
  S.hint++; S.hints++;
  if (S.hint === 1) {
    board.shapes([{ orig: mv.from, brush: 'green' }]);
    setBubble(`💡 Fíjate en tu <b>${{ p: 'peón', n: 'caballo', b: 'alfil', r: 'torre', q: 'dama', k: 'rey' }[mv.piece]}</b> de ${mv.from}. (Pulsa otra vez para ver la jugada.)`, null);
  } else {
    board.shapes([{ orig: mv.from, dest: mv.to, brush: 'green' }]);
    setBubble(`💡 La mejor jugada es <b>${fig(mv.san)}</b>.`, null);
  }
}

async function threat() {
  if (S.over) return;
  if (S.chess.turn() !== S.userColor) return toast('Espera a que sea tu turno.');
  showThinking(true);
  const fen = S.chess.fen();
  const t = await findThreat(engine, fen);
  showThinking(false);
  if (S.chess.fen() !== fen) return;
  board.shapes(t.shapes);
  setBubble(t.text, null);
}

function undo(fromPause = false) {
  if (S.over) return toast('La partida ha terminado.');
  if (!S.moves.length) return;
  const last = S.moves[S.moves.length - 1];
  const lastIsUser = last.color === S.userColor;
  const n = lastIsUser ? 1 : 2;
  if (S.moves.length < n) return;
  engine.cancel('bot');
  S.token++;
  for (let i = 0; i < n; i++) {
    S.chess.undo(); S.moves.pop(); S.sans.pop(); S.fens.pop();
  }
  S.infos.length = S.moves.length;
  S.botThinking = false; S.paused = false; S.hint = 0; S.oppWarning = '';
  S.takebacks++;
  if (S.line && S.lineBroken) {
    // si volvemos a estar dentro de la línea, se puede retomar
    S.lineBroken = S.sans.some((s, i) => i < S.line.length && strip(s) !== strip(S.line[i]));
  }
  board.clearBadges();
  board.shapes([]);
  setActions([]);
  setBubble(fromPause ? 'Venga, piénsalo otra vez. 🙂 Busca jaques, capturas y amenazas.' : 'Jugada deshecha.', null);
  showThinking(false);
  renderAll();
  preAnalyze();
}

async function resign() {
  if (S.over) return;
  const a = await modal(`<h2>¿Rendirse?</h2><p>La partida contará como derrota.</p>
    <div class="toolbar"><button data-act="no">Seguir jugando</button><button class="danger" data-act="yes">Rendirme</button></div>`);
  if (a === 'yes') endGame(S.userColor === 'w' ? 'b' : 'w', 'abandono');
}

/* ------------------------------------------------------------------ */
/* Fin de partida                                                      */
/* ------------------------------------------------------------------ */
function checkEnd() {
  const c = S.chess;
  if (!c.isGameOver()) return false;
  let winner = null, reason;
  if (c.isCheckmate()) { winner = c.turn() === 'w' ? 'b' : 'w'; reason = 'jaque mate'; }
  else if (c.isStalemate()) reason = 'rey ahogado';
  else if (c.isThreefoldRepetition()) reason = 'triple repetición';
  else if (c.isInsufficientMaterial()) reason = 'material insuficiente';
  else reason = 'regla de las 50 jugadas';
  endGame(winner, reason);
  return true;
}

let lastRecord = null;

function endGame(winner, reason) {
  S.over = true; S.paused = false; S.botThinking = false;
  engine.cancel('bot');
  showThinking(false);
  setActions([]);
  renderAll();
  const score = winner === null ? 0.5 : winner === S.userColor ? 1 : 0;
  const p = app.profile;
  const rated = !S.fromPosition && S.moves.length >= 2;
  const old = p.rating;
  if (rated) {
    p.rating = updateRating(old, S.botElo, score, p.games, S.takebacks > 0);
    p.games++;
    p.history.push({ t: Date.now(), r: p.rating });
    app.saveProfile();
  }
  const delta = p.rating - old;
  const result = winner === 'w' ? '1-0' : winner === 'b' ? '0-1' : '½-½';
  lastRecord = {
    id: S.id, date: Date.now(), userColor: S.userColor, botElo: S.botElo, adaptive: S.adaptive,
    result, score, reason, delta, rated, ratingAfter: p.rating, takebacks: S.takebacks, hints: S.hints,
    sans: [...S.sans], ucis: S.moves.map((m) => m.lan), opening: openingName(S.sans)?.name || '',
    an: [], infos: [],
  };
  saveRecord();
  if (score === 1) sfx.win();
  const { counts, accuracy } = summarize(S.infos.filter((x, i) => S.moves[i]?.color === S.userColor));
  const title = score === 1 ? '¡Has ganado! 🎉' : score === 0 ? 'Has perdido' : 'Tablas';
  const dTxt = rated ? `<span class="${delta >= 0 ? 'delta-pos' : 'delta-neg'}">${delta >= 0 ? '+' : ''}${delta}</span>` : '';
  const mini = ['brilliant', 'great', 'best', 'mistake', 'blunder']
    .filter((k) => counts[k]).map((k) => `<span class="pill" style="color:${CLS[k].color}">${CLS[k].sym} ${CLS[k].label}: ${counts[k]}</span>`).join(' ');
  modal(`
    <div class="big-result">${title}</div>
    <p style="text-align:center" class="muted">Por ${reason}</p>
    <p style="text-align:center">${rated ? `Tu ELO: <b>${p.rating}</b> ${dTxt}` : 'Partida sin puntuar (empezó desde una posición).'}
      ${S.takebacks && rated ? '<br><span class="sm muted">Has deshecho jugadas: el ELO cambia la mitad.</span>' : ''}</p>
    ${accuracy !== null ? `<p style="text-align:center">Precisión aproximada: <b>${accuracy.toFixed(0)}%</b></p>` : ''}
    <div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center">${mini}</div>
    <div class="toolbar">
      <button data-act="close">Cerrar</button>
      <button data-act="rematch">Revancha</button>
      <button class="primary" data-act="review">Revisión completa</button>
    </div>`).then((a) => {
    if (a === 'review') app.openReview(lastRecord.id);
    else if (a === 'rematch') newGame({ color: S.userColor === 'w' ? 'b' : 'w', adaptive: S.adaptive, elo: S.botElo });
  });
  setBubble(`${title} (${reason}). Pulsa <b>Revisión completa</b> en el historial para repasar la partida con calma.`, null);
}

function saveRecord() {
  if (!lastRecord) return;
  lastRecord.an = S.analyses.map(compactAnalysis);
  lastRecord.infos = S.infos.map((i) => (i ? { c: i.cls, l: Math.round(i.loss * 10) / 10 } : null));
  const games = store.games().filter((g) => g.id !== lastRecord.id);
  games.unshift(lastRecord);
  store.saveGames(games);
  // errores para repasar como problemas
  const ms = store.mistakes();
  const seen = new Set(ms.map((m) => m.k));
  S.infos.forEach((info, i) => {
    if (!info || !info.you || !['mistake', 'blunder', 'miss'].includes(info.cls) || !info.bestUci) return;
    const k = fenKey(S.fens[i]);
    if (seen.has(k)) return;
    seen.add(k);
    ms.push({ k, fen: S.fens[i], best: info.bestUci, bestSan: info.bestSan, played: info.san, wb: info.wb, cls: info.cls, game: lastRecord.id, date: Date.now() });
  });
  store.saveMistakes(ms);
}

let finishTimer;
/** Las evaluaciones pueden terminar después del final: vuelve a guardar el registro. */
function finishLater() {
  clearTimeout(finishTimer);
  finishTimer = setTimeout(saveRecord, 300);
}

export function compactAnalysis(a) {
  if (!a) return null;
  return { t: a.terminal || undefined, l: a.lines.slice(0, 2).map((l) => ({ s: l.score, pv: l.pv.slice(0, 8) })) };
}

/* ------------------------------------------------------------------ */
/* Pintado                                                             */
/* ------------------------------------------------------------------ */
function renderAll() {
  renderBoard();
  renderTags();
  renderMoves();
  const op = openingName(S.sans);
  $('play-opening').textContent = S.over && !S.moves.length ? 'Partida nueva' : op ? `${op.eco} · ${op.name}` : S.moves.length ? 'Fuera de libro' : `Rival: ELO ${S.botElo}`;
}

function renderBoard() {
  const last = S.moves[S.moves.length - 1];
  const userCan = !S.over && !S.paused && !S.botThinking;
  board.set(S.chess, { lastMove: last ? [last.from, last.to] : null, userColor: userCan ? S.userColor : null, shapes: board.cg.state.drawable.autoShapes });
}

function renderTags() {
  const cap = captured(S.chess);
  const tag = (color) => {
    const isUser = color === S.userColor;
    const caps = color === 'w' ? cap.byWhite : cap.byBlack;
    const adv = color === 'w' ? cap.diff : -cap.diff;
    const name = isUser ? `Tú <span class="elo">(${app.profile.rating})</span>` : `🤖 Entrenador <span class="elo">(ELO ${S.botElo}${S.adaptive ? ', adaptativo' : ''})</span>`;
    return `<span class="name">${name}</span><span class="cap">${caps}</span>${adv > 0 ? `<span>+${adv}</span>` : ''}`;
  };
  const top = board.orient === 'white' ? 'b' : 'w';
  $('play-top').innerHTML = tag(top);
  $('play-bottom').innerHTML = tag(top === 'w' ? 'b' : 'w');
}

function renderMoves() {
  const box = $('play-moves');
  let html = '';
  for (let i = 0; i < S.moves.length; i += 2) {
    html += `<div class="mrow"><span class="mnum">${i / 2 + 1}.</span>${cell(i)}${cell(i + 1)}</div>`;
  }
  box.innerHTML = html;
  box.scrollTop = box.scrollHeight;
  box.querySelectorAll('.mv[data-i]').forEach((e) => (e.onclick = () => showMoveComment(+e.dataset.i)));
}

function cell(i) {
  const m = S.moves[i];
  if (!m) return '<span></span>';
  const info = S.infos[i];
  const showBadge = info && settings().coach && (info.you || BAD.has(info.cls) || info.cls === 'brilliant' || info.cls === 'great');
  const b = showBadge ? `<span class="mini" style="background:${CLS[info.cls].color}" title="${CLS[info.cls].label}">${CLS[info.cls].sym}</span>` : '';
  return `<span class="mv ${S.viewing === i ? 'cur' : ''}" data-i="${i}">${b}${fig(m.san)}</span>`;
}

function showMoveComment(i) {
  const info = S.infos[i];
  if (!info) return;
  S.viewing = i;
  setBubble(`<b>${Math.floor(i / 2) + 1}${i % 2 ? '…' : '.'} ${fig(info.san)}</b> — ${info.comment}`, info.cls);
  renderMoves();
}

function updateEval(an, fen) {
  if (!an?.lines?.length) return;
  const turn = fen.split(' ')[1];
  const s = an.lines[0].score;
  let w = wp(s);
  if (an.terminal === 'mate') w = 0;
  if (an.terminal === 'draw') w = 50;
  const winWhite = turn === 'w' ? w : 100 - w;
  let lbl = an.terminal === 'mate' ? '#' : fmtScore(s, turn === 'w' ? 1 : -1).replace('+', '');
  if (lbl.startsWith('-')) lbl = lbl.slice(1);
  setEvalBar('play-evalbar', winWhite, lbl, board.orient);
}

function setBubble(html, cls) {
  const b = $('play-bubble');
  b.innerHTML = html;
  b.style.borderLeftColor = cls ? CLS[cls].color : '';
}

function setActions(list) {
  const box = $('play-actions');
  box.innerHTML = '';
  for (const a of list) {
    const btn = document.createElement('button');
    btn.textContent = a.label;
    if (a.primary) btn.className = 'primary';
    btn.onclick = a.fn;
    box.appendChild(btn);
  }
}

function showThinking(on) { $('play-thinking').hidden = !on; }
