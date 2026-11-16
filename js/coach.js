// El "entrenador": clasifica jugadas y explica errores.
import { Chess, VAL, NAME, art, pron, fig, uciObj, matDiff, wp, fmtScore, clamp } from './util.js';

export const CLS = {
  brilliant:  { label: 'Brillante',          sym: '!!', color: '#1bada6' },
  great:      { label: 'Genial',             sym: '!',  color: '#5b8bb0' },
  best:       { label: 'La mejor',           sym: '★',  color: '#81b64c' },
  excellent:  { label: 'Excelente',          sym: '✓',  color: '#81b64c' },
  good:       { label: 'Buena',              sym: '✓',  color: '#77915f' },
  book:       { label: 'De libro',           sym: '📖', color: '#a88865' },
  inaccuracy: { label: 'Imprecisión',        sym: '?!', color: '#e6b533' },
  mistake:    { label: 'Error',              sym: '?',  color: '#e58f2a' },
  miss:       { label: 'Oportunidad perdida', sym: '✗', color: '#ee6b55' },
  blunder:    { label: 'Error grave',        sym: '??', color: '#ca3431' },
};
export const CLS_ORDER = ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'miss', 'blunder'];
export const BAD = new Set(['inaccuracy', 'mistake', 'miss', 'blunder']);

export const COACH_DEPTH = { depth: 13, movetime: 1500 };

/** Precisión de una jugada a partir de la pérdida de probabilidad de ganar (fórmula de lichess). */
export const moveAccuracy = (loss) => clamp(103.1668 * Math.exp(-0.04354 * loss) - 3.1669, 0, 100);

function linesWp(analysis, i = 0) {
  const l = analysis?.lines?.[i];
  return l ? wp(l.score) : null;
}

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

/**
 * Clasifica una jugada.
 * ctx = { fenBefore, uci, before (análisis multipv>=2 de la posición previa), after (análisis de la posición resultante),
 *         isBook, openingName, prevMove (jugada verbose anterior del rival), prevOppLoss, you (true si es el usuario) }
 */
export function classify(ctx) {
  const { fenBefore, uci, before, after, isBook, you = true } = ctx;
  const chess = new Chess(fenBefore);
  const me = chess.turn();
  const legalCount = chess.moves().length;
  const mv = chess.move(uciObj(uci));
  const best = before.lines[0];
  const bestUci = best?.pv[0];
  const bestSan = bestUci ? sanAt(fenBefore, bestUci) : null;
  const wb = wp(best?.score);
  const wa = 100 - linesWp(after);
  let loss = uci === bestUci ? 0 : Math.max(0, wb - wa);
  if (after.terminal === 'mate') loss = 0; // has dado mate

  let cls;
  const forced = legalCount === 1;
  if (isBook && loss < 8) cls = 'book';
  else if (loss < 2) {
    const sac = isSacrifice(fenBefore, uci, after.lines[0]?.pv || []);
    const second = before.lines[1] ? wp(before.lines[1].score) : null;
    const recapture = ctx.prevMove?.captured && ctx.prevMove.to === mv.to;
    if (sac && wa >= 50 && wb < 97 && !forced) cls = 'brilliant';
    else if (uci === bestUci && second !== null && wb - second >= 15 && !forced && !recapture && wa >= 30) cls = 'great';
    else cls = uci === bestUci ? 'best' : 'excellent';
  } else if (loss < 5) cls = 'good';
  else if (loss < 10) cls = 'inaccuracy';
  else if (loss < 20) cls = 'mistake';
  else cls = 'blunder';

  if ((cls === 'inaccuracy' || cls === 'mistake' || cls === 'blunder') && (ctx.prevOppLoss ?? 0) >= 15 && loss >= 10 && wa >= 35) {
    cls = 'miss';
  }

  const res = { cls, loss, wb, wa, bestUci, bestSan, san: mv.san, uci, you };
  res.comment = comment(res, ctx, mv);
  res.arrows = arrowsFor(res, ctx);
  return res;
}

function sanAt(fen, uci) {
  try { return new Chess(fen).move(uciObj(uci)).san; } catch { return uci; }
}

/** ¿La jugada entrega material (pieza colgada o que se pierde en la línea principal)? */
export function isSacrifice(fenBefore, uci, afterPv) {
  const c = new Chess(fenBefore);
  const me = c.turn();
  const m0 = matDiff(c, me);
  let mv;
  try { mv = c.move(uciObj(uci)); } catch { return false; }
  if (mv.promotion) return false;
  const opp = c.turn();
  const pv = VAL[mv.piece];
  const cap = mv.captured ? VAL[mv.captured] : 0;
  // 1) pieza colgada en la casilla de destino
  if (pv >= 3 && pv - cap >= 2) {
    const att = c.attackers(mv.to, opp);
    if (att.length) {
      const def = c.attackers(mv.to, me);
      const minAtt = Math.min(...att.map((s) => (c.get(s).type === 'k' ? 100 : VAL[c.get(s).type])));
      if ((!def.length && minAtt < 100) || minAtt < pv) return true;
    }
  }
  // 2) la línea principal del motor: el rival captura en la casilla y quedamos con material de menos
  let ply = 0;
  let firstCapOnTo = false;
  let minD = Infinity;
  for (const u of afterPv.slice(0, 6)) {
    let m;
    try { m = c.move(uciObj(u)); } catch { break; }
    ply++;
    if (ply === 1) firstCapOnTo = !!m.captured && m.to === mv.to;
    if (ply % 2 === 0) minD = Math.min(minD, matDiff(c, me));
  }
  return firstCapOnTo && minD <= m0 - 2;
}

/** Material ganado/perdido (desde `me`) siguiendo una línea, medido tras jugadas propias. */
function materialAlong(fen, firstUci, pv, me, plies = 4) {
  const c = new Chess(fen);
  const m0 = matDiff(c, me);
  const seq = firstUci ? [firstUci, ...pv] : pv;
  let last = m0;
  let n = 0;
  for (const u of seq.slice(0, plies + (firstUci ? 1 : 0))) {
    let m;
    try { m = c.move(uciObj(u)); } catch { break; }
    n++;
    if (c.turn() !== me || n === seq.length) last = matDiff(c, me);
  }
  return last - m0;
}

function comment(r, ctx, mv) {
  const Y = r.you;
  const C = CLS[r.cls];
  const tag = `<span class="cls" style="color:${C.color}">${C.label}.</span> `;
  const bestTxt = r.bestSan && r.bestUci !== r.uci ? ` Mejor era <b>${fig(r.bestSan)}</b>.` : '';
  const chessAfter = new Chess(ctx.fenBefore);
  chessAfter.move(uciObj(r.uci));
  if (chessAfter.isCheckmate()) return tag + (Y ? '¡Jaque mate! 🎉' : 'Jaque mate.');

  switch (r.cls) {
    case 'book':
      return tag + `Jugada teórica${ctx.openingName ? ` de la <b>${ctx.openingName}</b>` : ''}.`;
    case 'brilliant':
      return tag + (Y ? `¡Sacrificas ${art(mv.piece, 'tu')} y la posición sigue siendo excelente! Pocas personas ven algo así.`
        : `Sacrifica ${art(mv.piece)} con muy buena compensación.`);
    case 'great':
      return tag + (Y ? '¡Era la única jugada buena! Todo lo demás empeoraba mucho tu posición.' : 'Era la única jugada buena.');
    case 'best': {
      if (ctx.prevOppLoss >= 15 && Y) return tag + '¡Bien visto! Aprovechas el error del rival.';
      if (mv.captured && Y) return tag + pickRandom([`Capturas ${art(mv.captured)} justo como debías.`, 'Exacto, lo que habría jugado el motor.']);
      return tag + (Y ? pickRandom(['Exacto, lo que habría jugado el motor.', 'Perfecto, la mejor jugada.', 'Muy bien, jugada precisa.']) : 'La jugada del motor.');
    }
    case 'excellent':
      return tag + (Y ? 'Casi tan buena como la mejor.' : 'Muy buena jugada.') + bestTxt;
    case 'good':
      return tag + 'Jugada razonable, aunque había algo mejor.' + bestTxt;
    default:
      return tag + explainBad(r, ctx, mv) + bestTxt;
  }
}

function explainBad(r, ctx, mv) {
  const Y = r.you;
  const before = ctx.before.lines[0];
  const reply = ctx.after.lines[0];
  const c = new Chess(ctx.fenBefore);
  const me = c.turn();
  c.move(uciObj(r.uci));

  if (reply?.score.mate > 0) {
    const replySan = sanAt(c.fen(), reply.pv[0]);
    return Y ? `¡Cuidado! Permites mate en ${reply.score.mate} (empieza con <b>${fig(replySan)}</b>).`
      : `Permite mate en ${reply.score.mate}.`;
  }
  if (before?.score.mate > 0) {
    return Y ? `¡Tenías mate en ${before.score.mate}!` : `Tenía mate en ${before.score.mate}.`;
  }
  if (r.cls === 'miss') {
    const gain = materialAlong(ctx.fenBefore, r.bestUci, before.pv.slice(1), me);
    return (Y ? 'El rival se había equivocado y no lo aprovechas' : 'No aprovecha el error') + (gain >= 2 ? ': se podía ganar material.' : '.');
  }
  // ¿pierde material?
  if (reply) {
    const lost = -materialAlong(c.fen(), null, reply.pv, me, 4);
    const replyMv = (() => { try { return new Chess(c.fen()).move(uciObj(reply.pv[0])); } catch { return null; } })();
    if (replyMv && (lost >= 2 || (lost >= 1 && replyMv.captured))) {
      const rs = fig(replyMv.san);
      if (replyMv.captured && replyMv.to === mv.to) {
        return Y ? `${capital(art(mv.piece, 'tu'))} en ${mv.to} queda sin defensa: el rival ${pron(mv.piece)} captura con <b>${rs}</b>.`
          : `Deja ${art(mv.piece)} de ${mv.to} sin defensa.`;
      }
      if (replyMv.captured) {
        return Y ? `Dejas ${art(replyMv.captured)} de ${replyMv.to} sin defensa: <b>${rs}</b> ${pron(replyMv.captured)} gana.`
          : `Deja ${art(replyMv.captured)} de ${replyMv.to} sin defensa.`;
      }
      const c2 = new Chess(c.fen());
      c2.move(uciObj(reply.pv[0]));
      const targets = [];
      for (const row of c2.board()) for (const p of row) {
        if (p && p.color === me && (VAL[p.type] >= 3 || p.type === 'k') && c2.attackers(p.square, oppOf(me)).includes(replyMv.to)) targets.push(p);
      }
      if (targets.length >= 2) {
        return Y ? `El rival responde <b>${rs}</b>: ¡ataque doble a ${targets.map((t) => art(t.type, 'tu')).join(' y ')}! Pierdes material.`
          : `Permite un ataque doble con ${rs}.`;
      }
      return Y ? `Tras <b>${rs}</b> el rival gana material.` : `Permite ganar material con ${rs}.`;
    }
  }
  // ¿se le escapó ganar material?
  if (before && r.bestUci) {
    const gain = materialAlong(ctx.fenBefore, r.bestUci, before.pv.slice(1), me);
    if (gain >= 2) {
      const bm = new Chess(ctx.fenBefore).move(uciObj(r.bestUci));
      if (bm.captured) return Y ? `Se te escapa capturar ${art(bm.captured)} de ${bm.to}.` : `Podía capturar ${art(bm.captured)}.`;
      return Y ? 'Se te escapa una jugada que ganaba material.' : 'Había una jugada que ganaba material.';
    }
  }
  const evB = fmtScore(before?.score, 1);
  const evA = fmtScore(reply?.score, -1);
  return Y ? `Tu posición empeora (de ${evB} a ${evA}).` : `Su posición empeora (de ${evB} a ${evA}).`;
}

const oppOf = (c) => (c === 'w' ? 'b' : 'w');
const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function arrowsFor(r, ctx) {
  const shapes = [];
  if (!BAD.has(r.cls) && r.cls !== 'good' && r.cls !== 'excellent') return shapes;
  if (r.bestUci && r.bestUci !== r.uci) shapes.push({ orig: r.bestUci.slice(0, 2), dest: r.bestUci.slice(2, 4), brush: 'green' });
  const reply = ctx.after.lines[0]?.pv[0];
  if (reply && BAD.has(r.cls)) shapes.push({ orig: reply.slice(0, 2), dest: reply.slice(2, 4), brush: 'red' });
  return shapes;
}

/** Explica la amenaza del rival (análisis de "jugada nula"). */
export async function findThreat(engine, fen) {
  const c = new Chess(fen);
  if (c.inCheck()) return { text: 'Estás en jaque: primero tienes que salir del jaque.', shapes: [] };
  const parts = fen.split(' ');
  parts[1] = parts[1] === 'w' ? 'b' : 'w';
  parts[3] = '-';
  const nullFen = parts.join(' ');
  let nc;
  try { nc = new Chess(nullFen); } catch { return { text: 'No se puede calcular la amenaza aquí.', shapes: [] }; }
  const [now, threat] = await Promise.all([
    engine.cached(fen, { ...COACH_DEPTH, multipv: 2 }),
    engine.analyze(nullFen, { depth: 11, movetime: 1500 }),
  ]);
  const t = threat?.lines[0];
  if (!t || !t.pv.length) return { text: 'No veo amenazas.', shapes: [] };
  const oppNow = 100 - wp(now.lines[0].score);
  const oppThreat = wp(t.score);
  const mv = nc.move(uciObj(t.pv[0]));
  const shape = [{ orig: mv.from, dest: mv.to, brush: 'red' }];
  if (t.score.mate > 0) return { text: `⚠️ El rival amenaza <b>mate en ${t.score.mate}</b>, empezando por <b>${fig(mv.san)}</b>.`, shapes: shape };
  if (oppThreat - oppNow >= 8) {
    if (mv.captured) return { text: `⚠️ El rival amenaza capturar ${art(mv.captured, 'tu')} de ${mv.to} con <b>${fig(mv.san)}</b>.`, shapes: shape };
    return { text: `⚠️ El rival amenaza <b>${fig(mv.san)}</b>, que le daría ventaja.`, shapes: shape };
  }
  return { text: 'Ahora mismo no hay amenazas serias. Puedes centrarte en tu plan.', shapes: [] };
}

/** Resumen de clasificaciones y precisión para un bando. */
export function summarize(infos) {
  const counts = Object.fromEntries(CLS_ORDER.map((k) => [k, 0]));
  let accSum = 0, n = 0;
  for (const i of infos) {
    if (!i) continue;
    counts[i.cls]++;
    accSum += moveAccuracy(i.loss);
    n++;
  }
  return { counts, accuracy: n ? accSum / n : null };
}
