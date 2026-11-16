// Libro de aperturas (base CC0 de lichess-org/chess-openings) + líneas para el entrenador.

const nodes = new Map(); // "e4 e5 Nf3" -> {name, eco, children:Set}
let loaded = null;

export function loadBook() {
  if (loaded) return loaded;
  loaded = fetch('data/openings.json')
    .then((r) => r.json())
    .then((list) => {
      for (const [eco, name, moves] of list) {
        const ms = moves.split(' ');
        let key = '';
        for (let i = 0; i < ms.length; i++) {
          const parent = key;
          key = key ? key + ' ' + ms[i] : ms[i];
          if (!nodes.has(key)) nodes.set(key, { children: new Set() });
          if (!nodes.has(parent)) nodes.set(parent, { children: new Set() });
          nodes.get(parent).children.add(ms[i]);
        }
        const n = nodes.get(key);
        // nombre más corto (más general) si hay varios para la misma secuencia
        if (!n.name || name.length < n.name.length) { n.name = name; n.eco = eco; }
      }
      for (const l of TRAINER_LINES) {
        let key = '';
        for (const m of l.moves.split(' ')) {
          key = key ? key + ' ' + m : m;
          if (nodes.has(key)) nodes.get(key).popular = true;
        }
      }
    });
  return loaded;
}

const stripSan = (s) => s.replace(/[+#]$/, '');
const keyOf = (sans) => sans.map(stripSan).join(' ');

/** ¿Está esta secuencia de jugadas en el libro? */
export function inBook(sans) {
  if (!sans.length) return true;
  // la base de lichess guarda los jaques con "+"; probamos ambas formas
  return nodes.has(sans.join(' ')) || nodes.has(keyOf(sans));
}

function nodeOf(sans) {
  return nodes.get(sans.join(' ')) || nodes.get(keyOf(sans));
}

/** Nombre de la apertura más concreta que encaja con la partida. */
export function openingName(sans) {
  for (let i = Math.min(sans.length, 30); i > 0; i--) {
    const n = nodeOf(sans.slice(0, i));
    if (n && n.name) return { name: n.name, eco: n.eco, ply: i };
  }
  return null;
}

/** Continuaciones de libro desde esta posición (SAN), con las populares primero. */
export function bookChildren(sans) {
  const n = sans.length ? nodeOf(sans) : nodes.get('');
  if (!n) return [];
  return [...n.children].map((m) => {
    const child = nodeOf([...sans, m]);
    return { san: m, popular: !!child?.popular };
  });
}

// Líneas principales para practicar. side = bando con el que juegas.
export const TRAINER_LINES = [
  // ---- Blancas ----
  { id: 'italiana', side: 'w', name: 'Apertura Italiana', moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4 cxd4 Bb4+ Bd2 Bxd2+ Nbxd2 d5',
    idea: 'Desarrollo rápido, el alfil apunta a f7 y con c3 + d4 construyes un gran centro de peones.' },
  { id: 'espanola', side: 'w', name: 'Apertura Española', moves: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3',
    idea: 'El alfil presiona al caballo que defiende e5. Enroque pronto, torre a e1 y luego d4.' },
  { id: 'escocesa', side: 'w', name: 'Apertura Escocesa', moves: 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Bc5 Be3 Qf6 c3 Nge7 Bc4',
    idea: 'Abres el centro muy pronto con d4. Juego directo y piezas activas.' },
  { id: 'londres', side: 'w', name: 'Sistema Londres', moves: 'd4 d5 Bf4 Nf6 e3 e6 Nf3 c5 c3 Nc6 Nbd2 Bd6 Bg3 O-O Bd3',
    idea: 'Un esquema fijo y sólido: alfil a f4, peones en c3-d4-e3 y piezas a sus casillas naturales. Ideal para no memorizar mucho.' },
  { id: 'gambito-dama', side: 'w', name: 'Gambito de Dama', moves: 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 Nbd7 Rc1',
    idea: 'Ofreces el peón de c4 para quitarle el centro a las negras. Si lo cogen, lo recuperas fácilmente.' },
  { id: 'vienesa', side: 'w', name: 'Partida Vienesa', moves: 'e4 e5 Nc3 Nf6 f4 d5 fxe5 Nxe4 Nf3 Be7 d4 O-O',
    idea: 'Caballo a c3 primero y luego f4 para atacar el centro por el flanco de rey.' },
  { id: 'inglesa', side: 'w', name: 'Apertura Inglesa', moves: 'c4 e5 Nc3 Nf6 Nf3 Nc6 g3 d5 cxd5 Nxd5 Bg2 Nb6 O-O',
    idea: 'Controlas d5 desde el flanco. Fianchetto del alfil de rey y juego posicional.' },
  // ---- Negras contra 1.e4 ----
  { id: 'dos-caballos', side: 'b', name: 'Defensa de los dos caballos', moves: 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Na5 Bb5+ c6 dxc6 bxc6',
    idea: 'Respuesta activa a la Italiana. Si te atacan f7, contraatacas con d5 y das un peón por actividad.' },
  { id: 'siciliana', side: 'b', name: 'Defensa Siciliana (Najdorf)', moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5 Nb3 Be6',
    idea: 'Desequilibras la partida desde la primera jugada: cambias tu peón c por el d blanco y juegas por la columna c.' },
  { id: 'francesa', side: 'b', name: 'Defensa Francesa (avance)', moves: 'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6 a3 c4',
    idea: 'Cadena de peones sólida. Atacas la base de la cadena blanca (d4) con c5, Cc6 y Db6.' },
  { id: 'caro-kann', side: 'b', name: 'Defensa Caro-Kann', moves: 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7',
    idea: 'Muy sólida: preparas d5 con c6 y sacas el alfil de casillas blancas antes de cerrar con e6.' },
  { id: 'escandinava', side: 'b', name: 'Defensa Escandinava', moves: 'e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6 Nf3 c6 Bc4 Bf5',
    idea: 'Atacas e4 de inmediato. La dama sale pronto pero se coloca segura en a5.' },
  { id: 'petrov', side: 'b', name: 'Defensa Petrov', moves: 'e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5 Bd3 Nc6 O-O Be7',
    idea: 'Simétrica y muy sólida. Ojo a la trampa: tras 3.Cxe5 no tomes e4 enseguida, juega primero d6.' },
  // ---- Negras contra 1.d4 / 1.c4 ----
  { id: 'qgd', side: 'b', name: 'Gambito de Dama rehusado', moves: 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 h6 Bh4 b6',
    idea: 'Mantienes el peón en d5 con e6. Posición clásica y sólida.' },
  { id: 'eslava', side: 'b', name: 'Defensa Eslava', moves: 'd4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5 e3 e6 Bxc4 Bb4',
    idea: 'Como la Caro-Kann pero contra d4: defiendes d5 con c6 y el alfil sale antes de e6.' },
  { id: 'india-rey', side: 'b', name: 'Defensa India de Rey', moves: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6',
    idea: 'Dejas que las blancas ocupen el centro y luego lo atacas con e5. Fianchetto y enroque rápido.' },
  { id: 'nimzo', side: 'b', name: 'Defensa Nimzoindia', moves: 'd4 Nf6 c4 e6 Nc3 Bb4 e3 O-O Bd3 d5 Nf3 c5 O-O',
    idea: 'Clavas el caballo de c3 para impedir e4. Estás dispuesto a cambiar alfil por caballo.' },
  { id: 'holandesa', side: 'b', name: 'Defensa Holandesa', moves: 'd4 f5 g3 Nf6 Bg2 e6 Nf3 Be7 O-O O-O c4 d6 Nc3 Qe8',
    idea: 'Controlas e4 con el peón f y buscas ataque en el flanco de rey.' },
];
