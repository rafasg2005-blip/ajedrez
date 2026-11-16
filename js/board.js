// Tablero: Chessground + chess.js, con insignias de clasificación y elección de coronación.
import { Chessground } from '../vendor/chessground/chessground.js';
import { Chess } from './util.js';
import { CLS } from './coach.js';

export const toColor = (c) => (c === 'w' ? 'white' : 'black');

export function dests(chess) {
  const m = new Map();
  for (const mv of chess.moves({ verbose: true })) {
    if (!m.has(mv.from)) m.set(mv.from, []);
    m.get(mv.from).push(mv.to);
  }
  return m;
}

export class Board {
  constructor(hostId, boardId, { onMove } = {}) {
    this.host = document.getElementById(hostId);
    this.onMove = onMove;
    this.orient = 'white';
    this.chess = new Chess();
    this.badgeLayer = document.createElement('div');
    this.badgeLayer.className = 'badge-layer';
    this.host.appendChild(this.badgeLayer);
    this.cg = Chessground(document.getElementById(boardId), {
      orientation: 'white',
      coordinates: true,
      animation: { enabled: true, duration: 220 },
      highlight: { lastMove: true, check: true },
      movable: { free: false, showDests: true, events: { after: (o, d) => this._after(o, d) } },
      premovable: { enabled: false },
      draggable: { enabled: true, showGhost: true },
      drawable: { enabled: true, eraseOnClick: true },
    });
  }

  /** Pinta la posición. userColor: 'w'|'b'|null (null = nadie puede mover). */
  set(chess, { lastMove, userColor = null, shapes } = {}) {
    this.chess = chess;
    const turn = toColor(chess.turn());
    const canMove = userColor && chess.turn() === userColor && !chess.isGameOver();
    this.cg.set({
      fen: chess.fen(),
      turnColor: turn,
      lastMove: lastMove || undefined,
      check: chess.inCheck() ? turn : false,
      movable: { color: canMove ? turn : undefined, dests: canMove ? dests(chess) : new Map() },
    });
    if (!lastMove) this.cg.set({ lastMove: undefined });
    this.cg.setAutoShapes(shapes || []);
  }

  shapes(s) { this.cg.setAutoShapes(s || []); }

  orientation(o) {
    this.orient = o;
    this.cg.set({ orientation: o });
    this.clearBadges();
  }

  flip() { this.orientation(this.orient === 'white' ? 'black' : 'white'); }

  redraw() { this.cg.redrawAll(); }

  async _after(orig, dest) {
    const piece = this.chess.get(orig);
    let promotion;
    if (piece?.type === 'p' && (dest[1] === '8' || dest[1] === '1')) {
      promotion = await this.askPromotion(piece.color);
    }
    this.onMove?.(orig, dest, promotion);
  }

  askPromotion(color) {
    return new Promise((res) => {
      const glyph = color === 'w' ? { q: '♕', r: '♖', b: '♗', n: '♘' } : { q: '♛', r: '♜', b: '♝', n: '♞' };
      const ov = document.createElement('div');
      ov.className = 'promo';
      ov.innerHTML = `<div class="choices">${['q', 'r', 'b', 'n'].map((p) => `<button data-p="${p}">${glyph[p]}</button>`).join('')}</div>`;
      ov.onclick = (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        ov.remove();
        res(b.dataset.p);
      };
      this.host.appendChild(ov);
    });
  }

  clearBadges() { this.badgeLayer.innerHTML = ''; }

  /** Insignia de clasificación en la esquina de una casilla. */
  badge(square, cls) {
    this.clearBadges();
    if (!square || !CLS[cls]) return;
    const f = square.charCodeAt(0) - 97;
    const r = +square[1] - 1;
    const x = this.orient === 'white' ? f : 7 - f;
    const y = this.orient === 'white' ? 7 - r : r;
    const b = document.createElement('div');
    b.className = 'badge';
    b.style.left = ((x + 1) / 8) * 100 + '%';
    b.style.top = (y / 8) * 100 + '%';
    b.style.background = CLS[cls].color;
    b.textContent = CLS[cls].sym;
    b.title = CLS[cls].label;
    this.badgeLayer.appendChild(b);
  }
}

/** Barra de evaluación. winWhite: 0-100. */
export function setEvalBar(elId, winWhite, label, orientation = 'white') {
  const bar = document.getElementById(elId);
  if (!bar) return;
  const fill = bar.querySelector('.fill');
  const lbl = bar.querySelector('.lbl');
  bar.classList.toggle('flipped', orientation === 'black');
  fill.style.height = winWhite + '%';
  lbl.textContent = label || '';
  // etiqueta en el lado del bando que va mejor
  const whiteBetter = winWhite >= 50;
  const atBottom = orientation === 'white' ? whiteBetter : !whiteBetter;
  lbl.classList.toggle('top', !atBottom);
  lbl.style.color = whiteBetter ? '#333' : '#eee';
}
