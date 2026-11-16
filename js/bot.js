// Rival con fuerza ajustable: Stockfish + elección "humana" entre varias candidatas.
import { Chess, wp, clamp, uciObj, matDiff } from './util.js';
import { bookChildren } from './book.js';

/** Parámetros de juego según el ELO objetivo (calibración aproximada). */
export function botParams(elo) {
  const depth = elo < 700 ? 6 : elo < 1000 ? 8 : elo < 1300 ? 10 : elo < 1600 ? 12 : elo < 2000 ? 14 : 16;
  // "temperatura" en puntos de % de victoria: cuanto más alta, más se aleja de la mejor jugada
  const temp = Math.max(0.3, 14 * Math.pow(2, -(elo - 400) / 380));
  // probabilidad de un despiste (un error "humano", no una jugada al azar)
  const blunder = clamp(0.07 - (elo - 400) * 0.00007, 0, 0.07);
  // probabilidad de ver lo evidente: comer una pieza regalada o dar mate en 1
  const punish = clamp(0.84 + (elo - 400) / 1100, 0.84, 1);
  return { depth, temp, blunder, punish, multipv: elo >= 2300 ? 3 : 8 };
}

/** Material que gana (desde quien mueve) la línea `pv`, medido tras la respuesta del rival. */
function gainAlong(fen, pv) {
  const c = new Chess(fen);
  const me = c.turn();
  const m0 = matDiff(c, me);
  for (const u of pv.slice(0, 4)) {
    try { c.move(uciObj(u)); } catch { break; }
  }
  return matDiff(c, me) - m0;
}

/**
 * Elige la jugada del bot.
 * analysis: resultado de engine.analyze con multipv; sans: historial SAN (para el libro).
 */
export function pickMove(fen, analysis, elo, sans) {
  const chess = new Chess(fen);
  const legal = chess.moves({ verbose: true });
  if (legal.length === 1) return legal[0].lan;
  const p = botParams(elo);
  const lines = analysis.lines.filter((l) => l.pv.length);
  const top = lines[0];
  const best = wp(top.score);

  // Lo evidente: mate en 1, o capturar material que se gana limpiamente
  const topMove = legal.find((m) => m.lan === top.pv[0]);
  const mateIn1 = top.score.mate === 1;
  const freeMaterial = topMove?.captured && gainAlong(fen, top.pv) >= 2;
  if ((mateIn1 || freeMaterial) && Math.random() < p.punish) return top.pv[0];

  // Apertura: si hay jugadas de libro razonables, elige una (da variedad)
  if (sans.length < 16) {
    const book = bookChildren(sans);
    if (book.length) {
      const cands = [];
      for (const b of book) {
        const mv = legal.find((m) => m.san.replace(/[+#]$/, '') === b.san.replace(/[+#]$/, ''));
        if (!mv) continue;
        const line = lines.find((l) => l.pv[0] === mv.lan);
        const loss = line ? best - wp(line.score) : null;
        if (loss !== null ? loss < 6 : b.popular) cands.push({ lan: mv.lan, w: b.popular ? 4 : 1 });
      }
      if (cands.length && Math.random() < 0.85) return weighted(cands);
    }
  }

  // Despiste humano: una jugada mediocre o mala de entre las que "se ven", nunca un disparate al azar
  if (Math.random() < p.blunder) {
    const meh = lines.filter((l) => { const loss = best - wp(l.score); return loss >= 8 && loss <= 45; });
    if (meh.length) return meh[Math.floor(Math.random() * meh.length)].pv[0];
  }

  const cands = lines.map((l) => ({ lan: l.pv[0], w: Math.exp(-(best - wp(l.score)) / p.temp) }));
  return weighted(cands);
}

function weighted(cands) {
  const total = cands.reduce((s, c) => s + c.w, 0);
  let r = Math.random() * total;
  for (const c of cands) {
    r -= c.w;
    if (r <= 0) return c.lan;
  }
  return cands[0].lan;
}

/** Actualización de ELO tras una partida (score: 1, 0.5, 0). */
export function updateRating(rating, opp, score, games, assisted) {
  const exp = 1 / (1 + Math.pow(10, (opp - rating) / 400));
  let k = games < 10 ? 48 : games < 30 ? 32 : 24;
  if (assisted) k /= 2;
  return Math.round(rating + k * (score - exp));
}
