// Persistencia en localStorage (todo queda en este navegador).
const P = 'ajz.';

function get(k, def) {
  try {
    const v = localStorage.getItem(P + k);
    return v == null ? def : JSON.parse(v);
  } catch {
    return def;
  }
}
function set(k, v) {
  try {
    localStorage.setItem(P + k, JSON.stringify(v));
    return true;
  } catch (e) {
    console.warn('No se pudo guardar', k, e);
    return false;
  }
}

const DEFAULT_PROFILE = {
  rating: 650,
  games: 0,
  prating: 900,
  pcount: 0,
  psolved: 0,
  bestStreak: 0,
  history: [],   // [{t, r}]
  phistory: [],  // [{t, r}]
  settings: {
    coach: true,
    pauseOnError: true,
    warnOpp: true,
    evalBar: true,
    sound: true,
    theme: 'green',
    adaptive: true,
    fixedElo: 800,
    color: 'w',
  },
};

export const store = {
  isNew() { return get('profile', null) === null; },
  profile() {
    const p = get('profile', null);
    if (!p) return structuredClone(DEFAULT_PROFILE);
    return { ...structuredClone(DEFAULT_PROFILE), ...p, settings: { ...DEFAULT_PROFILE.settings, ...p.settings } };
  },
  saveProfile(p) { set('profile', p); },
  games() { return get('games', []); },
  saveGames(g) {
    // si no cabe, recorta las partidas más antiguas
    while (!set('games', g) && g.length > 10) g = g.slice(0, Math.floor(g.length * 0.8));
  },
  mistakes() { return get('mistakes', []); },
  saveMistakes(m) { set('mistakes', m.slice(-400)); },
  openings() { return get('openings', {}); },
  saveOpenings(o) { set('openings', o); },
  learn() { return get('learn', null); },
  saveLearn(l) { set('learn', l); },
  seenPuzzles() { return get('seen', []); },
  saveSeenPuzzles(s) { set('seen', s.slice(-3000)); },
  exportAll() {
    const out = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith(P)) out[k] = localStorage.getItem(k);
    }
    return out;
  },
  importAll(obj) {
    for (const [k, v] of Object.entries(obj)) if (k.startsWith(P)) localStorage.setItem(k, v);
  },
  clearAll() {
    const ks = [];
    for (let i = 0; i < localStorage.length; i++) if (localStorage.key(i).startsWith(P)) ks.push(localStorage.key(i));
    ks.forEach((k) => localStorage.removeItem(k));
  },
};
