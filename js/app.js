// Punto de entrada: navegación, perfil y ajustes.
import { store } from './storage.js';
import { modal } from './util.js';
import { loadBook } from './book.js';
import { sound } from './sound.js';
import { initPlay } from './play.js';
import { initPuzzles } from './puzzles.js';
import { initOpenings } from './openings.js';
import { initReview } from './review.js';
import { initHistory } from './history.js';

const $ = (id) => document.getElementById(id);

const app = {
  profile: store.profile(),
  saveProfile() { store.saveProfile(app.profile); app.refreshHeader(); },
  refreshHeader() {
    $('hdr-rating').textContent = app.profile.rating;
    $('hdr-prating').textContent = app.profile.prating;
  },
  views: {},
  show(name) {
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + name));
    document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
    app.current = name;
    requestAnimationFrame(() => {
      app.views[name]?.onShow?.();
      app.views[name]?.board?.redraw();
    });
  },
  openReview(id) { app.review.open(id); },
};

function applySettings() {
  const s = app.profile.settings;
  document.body.classList.remove('theme-green', 'theme-brown', 'theme-blue');
  document.body.classList.add('theme-' + s.theme);
  document.body.classList.toggle('no-evalbar', !s.evalBar);
  sound.enabled = s.sound;
}

function bindSettings() {
  document.querySelectorAll('[data-setting]').forEach((el) => {
    const k = el.dataset.setting;
    if (el.type === 'checkbox') el.checked = !!app.profile.settings[k];
    else el.value = app.profile.settings[k];
    el.onchange = () => {
      app.profile.settings[k] = el.type === 'checkbox' ? el.checked : el.value;
      app.saveProfile();
      applySettings();
    };
  });
}

async function main() {
  applySettings();
  bindSettings();
  app.refreshHeader();
  await loadBook();
  app.play = initPlay(app);
  app.review = initReview(app);
  app.views = {
    play: app.play,
    puzzles: initPuzzles(app),
    openings: initOpenings(app),
    review: app.review,
    history: initHistory(app),
  };
  document.querySelectorAll('#nav button').forEach((b) => (b.onclick = () => app.show(b.dataset.view)));
  window.addEventListener('resize', () => document.body.dispatchEvent(new Event('chessground.resize')));
  app.show('play');
  window.__app = app; // para depurar desde la consola
  if (store.isNew()) await askLevel();
  if ('serviceWorker' in navigator && !['localhost', '127.0.0.1'].includes(location.hostname)) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

/** Primera visita: pregunta el nivel para empezar con un rival adecuado. */
async function askLevel() {
  const levels = [
    [400, 'Estoy empezando', 'Sé cómo se mueven las piezas'],
    [650, 'Juego de vez en cuando', 'Unos 500–800 de ELO online'],
    [1000, 'Intermedio', 'Unos 900–1200'],
    [1400, 'Avanzado', 'Unos 1300–1600'],
    [1800, 'Fuerte', '1700 o más'],
  ];
  const act = await modal(`
    <h2>¡Bienvenido! ♞</h2>
    <p>¿Qué nivel tienes? Así el rival y los problemas empiezan a tu medida (luego se ajustan solos).</p>
    <div style="display:flex;flex-direction:column;gap:6px">
      ${levels.map(([r, t, d]) => `<button class="op-card" data-act="${r}"><div class="t"><b>${t}</b><span class="muted">${r}</span></div><div class="m">${d}</div></button>`).join('')}
    </div>`, { dismissable: false });
  const r = +act || 650;
  app.profile.rating = r;
  app.profile.prating = r + 250;
  app.saveProfile();
  location.reload();
}

main();
