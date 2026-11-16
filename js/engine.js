// Envoltorio de Stockfish (WebAssembly, un hilo) con cola de peticiones.
import { Chess, fenKey } from './util.js';

class Engine {
  constructor() {
    this.worker = new Worker('vendor/stockfish/stockfish.js');
    this.handlers = [];
    this.queue = [];
    this.current = null;
    this.cache = new Map();
    this.worker.onmessage = (e) => {
      const line = String(e.data);
      for (const h of [...this.handlers]) h(line);
    };
    this.worker.onerror = (e) => console.error('Stockfish error', e);
    this.ready = this._init();
  }

  send(cmd) { this.worker.postMessage(cmd); }

  _waitFor(prefix) {
    return new Promise((res) => {
      const h = (l) => {
        if (l.startsWith(prefix)) {
          this.handlers.splice(this.handlers.indexOf(h), 1);
          res(l);
        }
      };
      this.handlers.push(h);
    });
  }

  async _init() {
    this.send('uci');
    await this._waitFor('uciok');
    this.send('setoption name Hash value 32');
    this.send('isready');
    await this._waitFor('readyok');
  }

  /**
   * Analiza una posición. opts: {depth, multipv, movetime, tag}
   * Devuelve {fen, lines:[{score:{cp|mate}, pv:[uci], depth}], bestmove, terminal?}
   * Las puntuaciones son desde el punto de vista del bando que mueve.
   */
  analyze(fen, opts = {}) {
    const terminal = terminalInfo(fen);
    if (terminal) return Promise.resolve(terminal);
    return new Promise((resolve) => {
      this.queue.push({ fen, opts, resolve });
      this._pump();
    });
  }

  /** Igual que analyze pero cachea por posición y parámetros (comparte la promesa). */
  cached(fen, opts = {}) {
    const k = `${fenKey(fen)}|${opts.depth}|${opts.multipv || 1}`;
    // si hay un análisis igual o más profundo con al menos las mismas líneas, reutilízalo
    if (this.cache.has(k)) return this.cache.get(k);
    const p = this.analyze(fen, opts);
    this.cache.set(k, p);
    p.then((r) => { if (!r) this.cache.delete(k); });
    if (this.cache.size > 3000) this.cache.delete(this.cache.keys().next().value);
    return p;
  }

  /** Cancela trabajos con esa etiqueta (los pendientes se resuelven con null). */
  cancel(tag) {
    this.queue = this.queue.filter((j) => {
      if (j.opts.tag === tag) { j.resolve(null); return false; }
      return true;
    });
    if (this.current && this.current.opts.tag === tag) {
      this.current.cancelled = true;
      this.send('stop');
    }
  }

  async _pump() {
    if (this.current || !this.queue.length) return;
    const job = this.queue.shift();
    this.current = job;
    await this.ready;
    const res = await this._run(job);
    this.current = null;
    job.resolve(job.cancelled ? null : res);
    this._pump();
  }

  _run(job) {
    const { fen, opts } = job;
    const depth = opts.depth ?? 12;
    const multipv = opts.multipv ?? 1;
    const movetime = opts.movetime ?? 4000;
    const lines = [];
    this.send(`setoption name MultiPV value ${multipv}`);
    this.send(`position fen ${fen}`);
    return new Promise((res) => {
      const h = (l) => {
        if (l.startsWith('info') && l.includes(' pv ')) {
          const t = l.split(' ');
          const si = t.indexOf('score');
          if (si < 0) return;
          if (t[si + 3] === 'lowerbound' || t[si + 3] === 'upperbound') return;
          const mi = t.indexOf('multipv');
          const n = mi >= 0 ? +t[mi + 1] : 1;
          const d = +t[t.indexOf('depth') + 1];
          const score = t[si + 1] === 'cp' ? { cp: +t[si + 2] } : { mate: +t[si + 2] };
          const pv = t.slice(t.indexOf('pv') + 1);
          lines[n - 1] = { score, pv, depth: d };
        } else if (l.startsWith('bestmove')) {
          this.handlers.splice(this.handlers.indexOf(h), 1);
          const bm = l.split(' ')[1];
          const out = lines.filter(Boolean);
          if (!out.length && bm && bm !== '(none)') out.push({ score: { cp: 0 }, pv: [bm], depth: 0 });
          res({ fen, lines: out, bestmove: bm });
        }
      };
      this.handlers.push(h);
      this.send(`go depth ${depth} movetime ${movetime}`);
    });
  }
}

/** Si la posición ya terminó (mate/ahogado), devuelve un análisis sintético. */
function terminalInfo(fen) {
  const c = new Chess(fen);
  if (c.isCheckmate()) return { fen, terminal: 'mate', lines: [{ score: { mate: 0 }, pv: [], depth: 99 }] };
  if (c.isStalemate() || c.isInsufficientMaterial()) return { fen, terminal: 'draw', lines: [{ score: { cp: 0 }, pv: [], depth: 99 }] };
  return null;
}

export const engine = new Engine();
