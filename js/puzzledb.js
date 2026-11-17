// Base de problemas de Lichess (CC0), compartida entre "Problemas" y "Aprender".
let promise = null;

/** Devuelve todos los problemas ordenados por ELO: [{id, fen, moves[], rating, themes}] */
export function loadPuzzleDb() {
  promise ||= fetch('data/puzzles.json')
    .then((r) => r.json())
    .then((data) => {
      const all = data.map(([id, fen, moves, rating, themes]) => ({ id, fen, moves: moves.split(' '), rating, themes }));
      all.sort((a, b) => a.rating - b.rating);
      return all;
    });
  return promise;
}

/** Elige `count` problemas al azar con alguno de los temas y dentro del rango de ELO. */
export async function samplePuzzles(themes, min, max, count) {
  const all = await loadPuzzleDb();
  const pool = all.filter((p) => p.rating >= min && p.rating <= max && themes.some((t) => p.themes.split(' ').includes(t)));
  const out = [];
  const used = new Set();
  while (out.length < count && used.size < pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    if (used.has(i)) continue;
    used.add(i);
    out.push(pool[i]);
  }
  return out;
}
