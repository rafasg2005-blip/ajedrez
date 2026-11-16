// Vista "Historial": evolución de ELO, partidas y copia de seguridad.
import { esc, modal, toast } from './util.js';
import { store } from './storage.js';
import { TRAINER_LINES } from './book.js';

let app;
const $ = (id) => document.getElementById(id);

export function initHistory(_app) {
  app = _app;
  $('hs-export').onclick = exportData;
  $('hs-import').onchange = importData;
  $('hs-reset').onclick = resetAll;
  return { onShow: render };
}

function chart(points, emptyMsg) {
  if (points.length < 2) return `<p class="muted">${emptyMsg}</p>`;
  const W = 400, H = 150, pad = 28;
  const ys = points.map((p) => p.r);
  let lo = Math.min(...ys), hi = Math.max(...ys);
  if (hi - lo < 50) { lo -= 25; hi += 25; }
  const x = (i) => pad + (i / (points.length - 1)) * (W - pad - 6);
  const y = (r) => 8 + (1 - (r - lo) / (hi - lo)) * (H - 26);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.r).toFixed(1)}`).join(' ');
  const last = points[points.length - 1];
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}">
    <text x="2" y="${y(hi) + 4}" fill="#a8a49d" font-size="10">${Math.round(hi)}</text>
    <text x="2" y="${y(lo) + 4}" fill="#a8a49d" font-size="10">${Math.round(lo)}</text>
    <line x1="${pad}" x2="${W}" y1="${y(hi)}" y2="${y(hi)}" stroke="#4a4640" stroke-width=".6"/>
    <line x1="${pad}" x2="${W}" y1="${y(lo)}" y2="${y(lo)}" stroke="#4a4640" stroke-width=".6"/>
    <path d="${d}" fill="none" stroke="#81b64c" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="${x(points.length - 1)}" cy="${y(last.r)}" r="3.5" fill="#81b64c"/>
  </svg></div>`;
}

function render() {
  const p = app.profile;
  const games = store.games();
  $('hs-chart').innerHTML = chart([{ r: 650 }, ...p.history].slice(-300), 'Juega partidas para ver tu evolución.');
  $('hs-pchart').innerHTML = chart(p.phistory.slice(-500), 'Resuelve problemas para ver tu evolución.');
  const w = games.filter((g) => g.score === 1).length;
  const l = games.filter((g) => g.score === 0).length;
  const d = games.length - w - l;
  const reviewed = games.filter((g) => g.acc != null).slice(0, 10);
  const acc = reviewed.length ? reviewed.reduce((s, g) => s + g.acc, 0) / reviewed.length : null;
  const ops = store.openings();
  const starsTotal = TRAINER_LINES.reduce((s, l) => s + Math.min(3, ops[l.id]?.clean || 0), 0);
  $('hs-stats').innerHTML = `
    <table class="counts">
      <tr><td>Partidas</td><td class="n">${games.length}</td></tr>
      <tr><td>Victorias / tablas / derrotas</td><td class="n">${w}/${d}/${l}</td></tr>
      <tr><td>Precisión media (últimas revisadas)</td><td class="n">${acc != null ? acc.toFixed(0) + '%' : '–'}</td></tr>
      <tr><td>Problemas resueltos</td><td class="n">${p.psolved}/${p.pcount}</td></tr>
      <tr><td>Mejor racha de problemas</td><td class="n">${p.bestStreak || 0}</td></tr>
      <tr><td>Errores pendientes de repasar</td><td class="n">${store.mistakes().length}</td></tr>
      <tr><td>Estrellas de aperturas</td><td class="n">${starsTotal}/${TRAINER_LINES.length * 3}</td></tr>
    </table>`;
  if (!games.length) {
    $('hs-list').innerHTML = '<p class="muted">Todavía no has jugado ninguna partida.</p>';
    return;
  }
  $('hs-list').innerHTML = `<div class="glist">${games.map((g) => {
    const res = g.score === 1 ? ['Victoria', 'res-w'] : g.score === 0 ? ['Derrota', 'res-l'] : ['Tablas', 'res-d'];
    const dt = new Date(g.date);
    const delta = g.rated ? `<span class="${g.delta >= 0 ? 'delta-pos' : 'delta-neg'}">${g.delta >= 0 ? '+' : ''}${g.delta}</span>` : '<span class="muted">sin puntuar</span>';
    return `<div class="grow" data-id="${g.id}">
      <span>${dt.toLocaleDateString('es-ES')} ${dt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
      <span title="${g.userColor === 'w' ? 'Blancas' : 'Negras'}">${g.userColor === 'w' ? '♔' : '♚'}</span>
      <span>${esc(g.opening || '—')} <span class="muted">· ${Math.ceil(g.sans.length / 2)} jug.</span></span>
      <span class="${res[1]}">${res[0]}</span>
      <span class="hide-m">vs ${g.botElo} ${delta}</span>
      <span class="hide-m">${g.acc != null ? `🎯 ${g.acc.toFixed(0)}%` : '<span class="muted">sin revisar</span>'}</span>
    </div>`;
  }).join('')}</div>`;
  $('hs-list').querySelectorAll('.grow').forEach((r) => (r.onclick = () => app.openReview(r.dataset.id)));
}

function exportData() {
  const blob = new Blob([JSON.stringify(store.exportAll())], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ajedrez-copia-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function importData(e) {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const obj = JSON.parse(await f.text());
    const ok = await modal(`<h2>Importar datos</h2><p>Se reemplazarán tus datos actuales por los de la copia. ¿Seguir?</p>
      <div class="toolbar"><button data-act="no">Cancelar</button><button class="primary" data-act="yes">Importar</button></div>`);
    if (ok !== 'yes') return;
    store.importAll(obj);
    location.reload();
  } catch {
    toast('Ese archivo no es una copia válida.');
  }
  e.target.value = '';
}

async function resetAll() {
  const ok = await modal(`<h2>Borrar todo</h2><p>Se borrarán tu ELO, partidas, problemas y progreso de aperturas de este navegador. No se puede deshacer.</p>
    <div class="toolbar"><button data-act="no">Cancelar</button><button class="danger" data-act="yes">Borrar todo</button></div>`);
  if (ok !== 'yes') return;
  store.clearAll();
  location.reload();
}
