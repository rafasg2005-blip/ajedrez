import { Chess } from '../vendor/chess.js';

export { Chess };

export const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
export const NAME = { p: 'peón', n: 'caballo', b: 'alfil', r: 'torre', q: 'dama', k: 'rey' };
const FEM = { r: true, q: true };
/** "tu caballo" / "tu dama" */
export const art = (t, det = 'el') => {
  if (det === 'el') return (FEM[t] ? 'la ' : 'el ') + NAME[t];
  if (det === 'tu') return 'tu ' + NAME[t];
  if (det === 'un') return (FEM[t] ? 'una ' : 'un ') + NAME[t];
  return NAME[t];
};
export const pron = (t) => (FEM[t] ? 'la' : 'lo');

const FIG = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞' };
/** SAN con figuras: Nf3 -> ♞f3 */
export const fig = (san) => (san || '').replace(/[KQRBN]/g, (c) => FIG[c]);

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export const uciObj = (u) => ({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || undefined });

/** Diferencia de material (puntos) desde el punto de vista de `color`. */
export function matDiff(chess, color) {
  let d = 0;
  for (const row of chess.board()) for (const p of row) if (p) d += (p.color === color ? 1 : -1) * VAL[p.type];
  return d;
}

/** Piezas capturadas por cada bando (para mostrar junto al nombre). */
export function captured(chess) {
  const start = { p: 8, n: 2, b: 2, r: 2, q: 1 };
  const have = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } };
  for (const row of chess.board()) for (const p of row) if (p && p.type !== 'k') have[p.color][p.type]++;
  const lost = (c) => {
    let s = '';
    for (const t of ['q', 'r', 'b', 'n', 'p']) {
      const n = Math.max(0, start[t] - have[c][t]);
      s += { q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }[t].repeat(n);
    }
    return s;
  };
  const md = matDiff(chess, 'w');
  return { byWhite: lost('b'), byBlack: lost('w'), diff: md };
}

/** UCI -> SAN en una posición dada. */
export function uciToSan(fen, uci) {
  try {
    const c = new Chess(fen);
    return c.move(uciObj(uci)).san;
  } catch {
    return uci;
  }
}

export function pvToSan(fen, pv, n = 6) {
  const c = new Chess(fen);
  const out = [];
  for (const u of pv.slice(0, n)) {
    try { out.push(c.move(uciObj(u)).san); } catch { break; }
  }
  return out;
}

/** Probabilidad de ganar (0-100) para el bando que mueve, a partir de la puntuación del motor. */
export function wp(score) {
  if (!score) return 50;
  if (score.mate !== undefined) return score.mate > 0 ? 100 : 0;
  const cp = clamp(score.cp, -1500, 1500);
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

/** Texto de evaluación desde el punto de vista de quien mueve. */
export function fmtScore(score, sign = 1) {
  if (!score) return '0.0';
  if (score.mate !== undefined) {
    const m = score.mate * sign;
    return (m > 0 ? '+M' : '-M') + Math.abs(m);
  }
  const v = (score.cp * sign) / 100;
  return (v > 0 ? '+' : '') + v.toFixed(1);
}

export function negate(score) {
  if (!score) return score;
  return score.mate !== undefined ? { mate: -score.mate } : { cp: -score.cp };
}

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

let toastTimer;
export function toast(msg, ms = 2200) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), ms);
}

/** Modal sencillo. `html` puede contener botones con data-act. Devuelve una promesa con el data-act pulsado. */
export function modal(html, { onOpen, dismissable = true } = {}) {
  const bg = document.getElementById('modal');
  const body = document.getElementById('modal-body');
  body.innerHTML = html;
  bg.hidden = false;
  return new Promise((resolve) => {
    const close = (v) => {
      bg.hidden = true;
      bg.onclick = null;
      body.onclick = null;
      resolve(v);
    };
    body.onclick = (e) => {
      const b = e.target.closest('[data-act]');
      if (b) close(b.dataset.act);
    };
    bg.onclick = (e) => { if (e.target === bg && dismissable) close(null); };
    onOpen?.(body, close);
  });
}

export const fenKey = (fen) => fen.split(' ').slice(0, 4).join(' ');

export function sideName(c) { return c === 'w' ? 'blancas' : 'negras'; }
