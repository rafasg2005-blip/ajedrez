// Temario del recorrido "Aprender". Cada lección es una lista de pasos.
//
// Tipos de paso:
//  info    {text, fen?, shapes?}                      explicación con tablero de ejemplo
//  quiz    {text, options[], answer, explain, fen?}   pregunta tipo test
//  stars   {text, piece, from, stars[], enemies{}}    mueve una pieza sola para recoger estrellas / comer piezas
//  goal    {text, fen, goal, accept?, wrong?}         haz una jugada que cumpla el objetivo
//          goal: mate | check | promote | castle | capture | any | moves
//  line    {text, fen, moves[], oppFirst?}            secuencia fija de jugadas
//  lichess {text, themes[], min, max, count}          problemas reales de la base de Lichess
//  playout {text, fen, goal, maxMoves}                juega contra el motor hasta cumplir el objetivo

const A = (orig, dest, brush = 'green') => ({ orig, dest, brush });
const C = (orig, brush = 'green') => ({ orig, brush });
const EMPTY = '8/8/8/8/8/8/8/8 w - - 0 1';
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const UNITS = [
  {
    id: 'u1', title: 'Las piezas', level: 'Desde cero', minRating: 0,
    desc: 'El tablero y cómo se mueve cada pieza.',
    lessons: [
      { id: 'tablero', title: 'El tablero', icon: '▦', steps: [
        { t: 'info', fen: EMPTY, shapes: [C('e4')], text: 'El ajedrez se juega en un tablero de <b>8×8 = 64 casillas</b>, claras y oscuras. Las filas horizontales van del <b>1 al 8</b> y las columnas verticales de la <b>a a la h</b>. Cada casilla se nombra con su columna y su fila: la marcada es <b>e4</b>.' },
        { t: 'info', fen: EMPTY, shapes: [C('h1'), C('a8')], text: 'Regla de oro para colocar el tablero: la esquina de abajo a la derecha de cada jugador es una casilla <b>clara</b>. Las <b>blancas</b> están abajo y siempre empiezan.' },
        { t: 'quiz', fen: EMPTY, shapes: [C('d5', 'blue')], text: '¿Cómo se llama la casilla marcada en azul?', options: ['d5', 'e4', 'c6', '5d'], answer: 0, explain: 'Columna d, fila 5: <b>d5</b>.' },
        { t: 'quiz', fen: EMPTY, shapes: [C('b2', 'blue')], text: '¿Y esta?', options: ['b7', 'b2', 'g2', 'c3'], answer: 1, explain: 'Columna b, fila 2: <b>b2</b>.' },
        { t: 'quiz', text: '¿Quién mueve primero?', options: ['Las blancas', 'Las negras', 'Se sortea'], answer: 0, explain: 'Siempre empiezan las blancas.' },
      ] },
      { id: 'torre', title: 'La torre', icon: '♜', steps: [
        { t: 'info', fen: '8/8/8/8/3R4/8/8/8 w - - 0 1', shapes: [A('d4', 'd8'), A('d4', 'd1'), A('d4', 'a4'), A('d4', 'h4')], text: 'La <b>torre</b> se mueve en línea recta, en horizontal o en vertical, tantas casillas como quiera. No puede saltar por encima de otras piezas.' },
        { t: 'stars', piece: 'R', from: 'a1', stars: ['a6', 'f6', 'f2'], text: 'Mueve la torre y recoge todas las estrellas ⭐.' },
        { t: 'stars', piece: 'R', from: 'h1', stars: ['h8', 'b8', 'b3', 'e3'], text: '¡Otra vez! Recoge las estrellas.' },
        { t: 'stars', piece: 'R', from: 'a1', enemies: { a7: 'p', e7: 'n', e2: 'b' }, text: 'Las piezas también <b>comen</b>: si mueves tu pieza a la casilla de una rival, la capturas. ¡Come todas las piezas negras!' },
      ] },
      { id: 'alfil', title: 'El alfil', icon: '♝', steps: [
        { t: 'info', fen: '8/8/8/8/3B4/8/8/8 w - - 0 1', shapes: [A('d4', 'h8'), A('d4', 'a7'), A('d4', 'a1'), A('d4', 'g1')], text: 'El <b>alfil</b> se mueve en <b>diagonal</b>, las casillas que quiera. Fíjate: un alfil siempre se queda en casillas del mismo color.' },
        { t: 'stars', piece: 'B', from: 'c1', stars: ['h6', 'f8', 'a3'], text: 'Recoge las estrellas con el alfil.' },
        { t: 'stars', piece: 'B', from: 'f1', stars: ['b5', 'e8', 'h5'], text: 'Ahora con el alfil de casillas claras.' },
        { t: 'stars', piece: 'B', from: 'e5', enemies: { b8: 'q', h2: 'p', c3: 'n' }, text: 'Come todas las piezas negras.' },
      ] },
      { id: 'dama', title: 'La dama', icon: '♛', steps: [
        { t: 'info', fen: '8/8/8/8/3Q4/8/8/8 w - - 0 1', shapes: [A('d4', 'd8'), A('d4', 'd1'), A('d4', 'a4'), A('d4', 'h4'), A('d4', 'h8'), A('d4', 'a7'), A('d4', 'a1'), A('d4', 'g1')], text: 'La <b>dama</b> es la pieza más poderosa: se mueve como la torre <b>y</b> como el alfil, en recto y en diagonal.' },
        { t: 'stars', piece: 'Q', from: 'd1', stars: ['d7', 'a4', 'h4', 'e7'], text: 'Recoge las estrellas con la dama.' },
        { t: 'stars', piece: 'Q', from: 'a1', enemies: { a8: 'r', h8: 'b', h1: 'n', d4: 'p' }, text: 'Come todo lo que puedas.' },
      ] },
      { id: 'rey', title: 'El rey', icon: '♚', steps: [
        { t: 'info', fen: '8/8/8/8/3K4/8/8/8 w - - 0 1', shapes: ['c5', 'd5', 'e5', 'c4', 'e4', 'c3', 'd3', 'e3'].map((s) => C(s)), text: 'El <b>rey</b> se mueve <b>una casilla</b> en cualquier dirección. Es la pieza más importante: si atrapan a tu rey (jaque mate), pierdes la partida.' },
        { t: 'stars', piece: 'K', from: 'e1', stars: ['e3', 'g4', 'g6', 'd6'], text: 'Lleva al rey a por las estrellas, paso a paso.' },
      ] },
      { id: 'caballo', title: 'El caballo', icon: '♞', steps: [
        { t: 'info', fen: '8/8/8/2PPP3/2PNP3/2PPP3/8/8 w - - 0 1', shapes: ['c6', 'e6', 'f5', 'f3', 'e2', 'c2', 'b3', 'b5'].map((s) => C(s)), text: 'El <b>caballo</b> salta en forma de <b>L</b>: dos casillas en una dirección y una hacia un lado. Es la única pieza que puede <b>saltar</b> por encima de otras.' },
        { t: 'stars', piece: 'N', from: 'b1', stars: ['c3', 'd5', 'f6'], text: 'Recoge las estrellas saltando con el caballo.' },
        { t: 'stars', piece: 'N', from: 'g1', stars: ['h3', 'g5', 'e6', 'd8'], text: 'Otra ruta con el caballo.' },
        { t: 'stars', piece: 'N', from: 'd4', enemies: { c6: 'p', e7: 'b', g8: 'r' }, text: 'Come las piezas negras con el caballo.' },
      ] },
      { id: 'peon', title: 'El peón', icon: '♟', steps: [
        { t: 'info', fen: '8/8/8/8/8/8/4P3/8 w - - 0 1', shapes: [A('e2', 'e3'), A('e2', 'e4')], text: 'El <b>peón</b> avanza hacia delante, una casilla. Desde su casilla inicial puede avanzar <b>una o dos</b>. Nunca retrocede.' },
        { t: 'stars', piece: 'P', from: 'e2', stars: ['e4', 'e6'], text: 'Avanza el peón hasta las estrellas.' },
        { t: 'info', fen: '8/8/8/3ppp2/4P3/8/8/8 w - - 0 1', shapes: [A('e4', 'd5'), A('e4', 'f5'), A('e4', 'e5', 'red')], text: '¡Ojo! El peón <b>come distinto de como se mueve</b>: come en <b>diagonal</b>, una casilla hacia delante. Y si tiene una pieza justo delante, queda bloqueado.' },
        { t: 'stars', piece: 'P', from: 'b2', enemies: { c3: 'p', d4: 'n', e5: 'b' }, text: 'Come las piezas negras con el peón.' },
      ] },
      { id: 'inicio', title: 'La posición inicial', icon: '♙', steps: [
        { t: 'info', fen: START, text: 'Así empieza cada partida. En la primera fila: <b>torre, caballo, alfil, dama, rey, alfil, caballo, torre</b>. Delante, ocho peones.' },
        { t: 'info', fen: START, shapes: [C('d1'), C('d8')], text: 'Truco para no equivocarte: <b>la dama va en la casilla de su color</b>. Dama blanca en casilla clara (d1), dama negra en casilla oscura (d8).' },
        { t: 'quiz', fen: START, text: '¿En qué casilla empieza el rey blanco?', options: ['d1', 'e1', 'e8', 'f1'], answer: 1, explain: 'El rey blanco empieza en <b>e1</b>, al lado de su dama.' },
        { t: 'quiz', text: '¿Qué pieza está en las esquinas al empezar?', options: ['El caballo', 'El alfil', 'La torre', 'El rey'], answer: 2, explain: 'Las <b>torres</b> están en las esquinas.' },
      ] },
    ],
  },
  {
    id: 'u2', title: 'Las reglas', level: 'Desde cero', minRating: 0,
    desc: 'Comer, valor de las piezas, coronar, jaque, mate, enroque…',
    lessons: [
      { id: 'capturar', title: 'Capturar', icon: '⚔️', steps: [
        { t: 'info', fen: 'k7/8/n7/8/8/8/8/R5K1 w - - 0 1', shapes: [A('a1', 'a6')], text: 'Comer (capturar) es mover tu pieza a la casilla de una pieza rival, que sale del tablero. Todas las piezas comen igual que se mueven, menos el peón.' },
        { t: 'goal', fen: 'k7/8/n7/8/8/8/8/R5K1 w - - 0 1', goal: 'capture', text: 'Come el caballo negro.' },
        { t: 'goal', fen: '4k3/8/3q4/8/4N3/8/8/4K3 w - - 0 1', goal: 'capture', text: '¡Tu caballo puede comer la dama!' },
        { t: 'goal', fen: '4k3/8/8/2r5/8/8/8/2Q1K3 w - - 0 1', goal: 'capture', text: 'Come la torre negra.' },
      ] },
      { id: 'valor', title: 'El valor de las piezas', icon: '⚖️', steps: [
        { t: 'info', fen: START, text: 'No todas las piezas valen lo mismo. Valores aproximados:<br>♟ Peón <b>1</b> · ♞ Caballo <b>3</b> · ♝ Alfil <b>3</b> · ♜ Torre <b>5</b> · ♛ Dama <b>9</b>.<br>El rey no tiene precio: no se puede cambiar.' },
        { t: 'quiz', text: 'Cambias tu caballo por una torre del rival. ¿Es buen negocio?', options: ['Sí, gano 2 puntos', 'No, pierdo 2 puntos', 'Da igual'], answer: 0, explain: 'Das 3 y recibes 5: <b>ganas 2</b>.' },
        { t: 'quiz', text: '¿Qué vale más?', options: ['Una torre', 'Dos alfiles', 'Valen lo mismo'], answer: 1, explain: 'Dos alfiles = 3 + 3 = <b>6</b>, más que una torre (5).' },
        { t: 'goal', fen: '4k3/8/8/1p3r2/3N4/8/8/4K3 w - - 0 1', goal: 'moves', accept: ['d4f5'], wrong: 'Ese peón vale 1. Había algo que vale mucho más…', text: 'Tu caballo puede comer un peón o una torre. Come lo que más vale.' },
        { t: 'goal', fen: '4k3/4p3/3n4/8/8/8/8/b2R2K1 w - - 0 1', goal: 'moves', accept: ['d1a1'], wrong: 'Si comes el caballo, el peón de e7 te come la torre: das 5 por 3.', text: 'Tu torre puede comer el caballo o el alfil. ¿Cuál es la buena captura? Fíjate en quién defiende cada pieza.' },
      ] },
      { id: 'coronar', title: 'La coronación', icon: '👑', steps: [
        { t: 'info', fen: '8/4P3/8/8/8/k7/8/4K3 w - - 0 1', shapes: [A('e7', 'e8')], text: 'Si un peón llega a la <b>última fila</b>, se convierte (<b>corona</b>) en la pieza que quieras: dama, torre, alfil o caballo. Casi siempre se elige <b>dama</b>.' },
        { t: 'goal', fen: '8/4P3/8/8/8/k7/8/4K3 w - - 0 1', goal: 'promote', text: 'Corona el peón.' },
        { t: 'goal', fen: '3r1k2/2P5/8/8/8/8/8/K7 w - - 0 1', goal: 'moves', accept: ['c7d8'], wrong: 'Si avanzas a c8, la torre se come tu nueva dama.', text: 'La torre vigila c8. ¡Corona comiendo la torre!' },
      ] },
      { id: 'jaque', title: 'El jaque', icon: '⚠️', steps: [
        { t: 'info', fen: '4k3/8/8/8/8/8/8/4R1K1 b - - 0 1', shapes: [A('e1', 'e8', 'red')], text: 'Cuando una pieza ataca al rey rival se dice que da <b>jaque</b>. El que recibe el jaque está <b>obligado</b> a salir de él en su jugada.' },
        { t: 'goal', fen: '4k3/8/8/8/8/8/8/R5K1 w - - 0 1', goal: 'check', text: 'Da jaque con la torre.' },
        { t: 'goal', fen: '4k3/8/8/8/4N3/8/8/4K3 w - - 0 1', goal: 'check', text: 'Da jaque con el caballo.' },
        { t: 'goal', fen: '4k3/8/8/8/8/8/8/4KB2 w - - 0 1', goal: 'check', text: 'Da jaque con el alfil.' },
      ] },
      { id: 'salir-jaque', title: 'Salir del jaque', icon: '🛡️', steps: [
        { t: 'info', fen: '4r1k1/8/8/8/8/R7/8/4K3 w - - 0 1', shapes: [A('e8', 'e1', 'red')], text: 'Hay tres formas de salir de un jaque:<br>1) <b>Mover el rey</b> a una casilla segura.<br>2) <b>Tapar</b> el jaque poniendo una pieza en medio.<br>3) <b>Comer</b> la pieza que da jaque.' },
        { t: 'goal', fen: '4r1k1/8/8/8/8/8/8/4K3 w - - 0 1', goal: 'any', text: 'Estás en jaque. Mueve el rey a una casilla segura.' },
        { t: 'goal', fen: '4r1k1/8/8/8/8/R7/8/4K3 w - - 0 1', goal: 'moves', accept: ['a3e3'], wrong: 'Eso también saca del jaque, pero aquí queremos <b>taparlo</b> con la torre.', text: 'Ahora <b>tapa</b> el jaque con la torre.' },
        { t: 'goal', fen: '4k3/8/8/8/1b6/8/2N5/4K3 w - - 0 1', goal: 'moves', accept: ['c2b4'], wrong: 'Sí sales del jaque, pero puedes hacer algo mejor: <b>comer</b> la pieza que te ataca.', text: 'El alfil te da jaque. ¡Cómetelo!' },
      ] },
      { id: 'mate', title: 'El jaque mate', icon: '🏁', steps: [
        { t: 'info', fen: '3R2k1/5ppp/8/8/8/8/8/6K1 b - - 0 1', shapes: [A('d8', 'g8', 'red')], text: '<b>Jaque mate</b>: el rey está en jaque y no tiene forma de salir. ¡La partida se acaba y gana quien da el mate! Aquí el rey negro no puede escapar: sus propios peones le tapan.' },
        { t: 'goal', fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', goal: 'mate', text: 'Da jaque mate en una jugada.' },
        { t: 'goal', fen: 'k7/8/1K6/8/8/8/8/7R w - - 0 1', goal: 'mate', text: 'Mate con la torre: tu rey ya vigila las casillas de escape.' },
        { t: 'goal', fen: 'k7/8/1K6/8/8/8/8/7Q w - - 0 1', goal: 'mate', text: 'Mate con la dama.' },
        { t: 'goal', fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', goal: 'mate', text: 'El famoso <b>mate del pastor</b>: dama y alfil atacan f7. ¡Dalo!' },
      ] },
      { id: 'tablas', title: 'Ahogado y tablas', icon: '🤝', steps: [
        { t: 'info', fen: 'k7/8/1Q6/8/8/8/8/6K1 b - - 0 1', text: 'Si al que le toca mover <b>no tiene ninguna jugada legal</b> pero <b>no</b> está en jaque, es <b>rey ahogado</b>: la partida acaba en <b>tablas</b> (empate). Aquí juegan negras y su rey no puede moverse a ninguna parte.' },
        { t: 'quiz', fen: 'k7/8/1Q6/8/8/8/8/6K1 b - - 0 1', text: 'Juegan negras. ¿Qué pasa?', options: ['Ganan las blancas', 'Tablas por ahogado', 'Las negras pasan turno'], answer: 1, explain: 'No está en jaque y no puede mover: <b>ahogado</b>, tablas. ¡Las blancas tiraron la victoria!' },
        { t: 'info', fen: '8/8/4k3/8/8/3K4/8/8 w - - 0 1', text: 'Otras formas de tablas: <b>material insuficiente</b> (por ejemplo, rey contra rey), <b>triple repetición</b> de la misma posición, <b>50 jugadas</b> sin capturas ni movimientos de peón, o <b>acuerdo</b> entre los dos.' },
        { t: 'goal', fen: 'k7/8/2K5/8/8/8/8/1Q6 w - - 0 1', goal: 'mate', text: 'Da mate… ¡pero sin ahogar!' },
      ] },
      { id: 'enroque', title: 'El enroque', icon: '🏰', steps: [
        { t: 'info', fen: 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', shapes: [A('e1', 'g1'), A('h1', 'f1', 'blue'), A('e1', 'c1'), A('a1', 'd1', 'blue')], text: 'El <b>enroque</b> mueve el rey y una torre a la vez: el rey va <b>dos casillas</b> hacia la torre y la torre salta al otro lado. Sirve para poner al rey a salvo.<br>Solo se puede si: ni el rey ni esa torre se han movido, no hay piezas en medio, y el rey no está en jaque ni pasa por casillas atacadas.' },
        { t: 'goal', fen: 'rnbqk2r/pppp1ppp/5n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', goal: 'castle', text: 'Enroca <b>corto</b>: arrastra el rey dos casillas hacia la derecha.' },
        { t: 'quiz', text: '¿Puedes enrocar si tu rey está en jaque?', options: ['Sí', 'No', 'Solo el enroque largo'], answer: 1, explain: 'Nunca se puede enrocar estando en jaque.' },
        { t: 'goal', fen: 'r3kbnr/pppqpppp/2n5/3p1b2/3P1B2/2N5/PPPQPPPP/R3KBNR w KQkq - 6 5', goal: 'castle', text: 'Ahora enroca <b>largo</b>: el rey va dos casillas hacia la izquierda.' },
      ] },
      { id: 'al-paso', title: 'La captura al paso', icon: '👣', steps: [
        { t: 'info', fen: '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2', shapes: [A('e5', 'd6')], text: 'Regla curiosa: si un peón rival avanza <b>dos casillas</b> y se queda justo al lado de tu peón, puedes comerlo como si solo hubiera avanzado una. Solo se puede en la jugada <b>inmediatamente siguiente</b>.' },
        { t: 'line', fen: '4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1', moves: ['d7d5', 'e5d6'], oppFirst: true, text: 'Las negras van a avanzar su peón dos casillas. ¡Cómelo <b>al paso</b>!' },
      ] },
    ],
  },
  {
    id: 'u3', title: 'Primeros pasos para ganar', level: '≈ 400–700', minRating: 500,
    desc: 'Principios de apertura, no regalar piezas y los primeros mates.',
    lessons: [
      { id: 'principios', title: 'Principios de apertura', icon: '🚀', steps: [
        { t: 'info', fen: START, text: 'Cinco consejos para empezar bien:<br>1) Controla el <b>centro</b> con peones (e4, d4).<br>2) Saca pronto <b>caballos y alfiles</b>.<br>3) <b>Enroca</b> para proteger al rey.<br>4) No saques la <b>dama</b> demasiado pronto.<br>5) No muevas la misma pieza dos veces sin motivo.' },
        { t: 'goal', fen: START, goal: 'moves', accept: ['e2e4', 'd2d4'], wrong: 'Es legal, pero lo ideal es ocupar el centro con un peón.', text: 'Primera jugada: ocupa el centro con un peón.' },
        { t: 'goal', fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', goal: 'moves', accept: ['g1f3'], wrong: 'Busca una pieza menor (caballo o alfil) que ataque el peón de e5. Sacar la dama tan pronto es arriesgado.', text: 'Desarrolla una pieza que ataque el peón de e5.' },
        { t: 'quiz', text: '¿Por qué no conviene sacar la dama muy pronto?', options: ['Porque está prohibido', 'Porque el rival la ataca con sus piezas y gana tiempo', 'Porque vale poco'], answer: 1, explain: 'El rival desarrolla sus piezas atacando a tu dama, y tú pierdes jugadas escapando.' },
      ] },
      { id: 'colgadas', title: 'No regales piezas', icon: '🎁', steps: [
        { t: 'info', fen: '4k3/8/8/3n4/8/8/8/3R2K1 w - - 0 1', shapes: [A('d1', 'd5')], text: 'Una pieza que el rival puede comer gratis está <b>colgada</b>. Antes de cada jugada pregúntate:<br>• ¿Qué piezas del rival están sin defensa?<br>• ¿Y las mías?<br>• ¿Qué amenaza la última jugada del rival?' },
        { t: 'lichess', themes: ['hangingPiece'], min: 400, max: 950, count: 5, text: 'Encuentra la pieza colgada y cómetela.' },
      ] },
      { id: 'mates-basicos', title: 'Mates básicos', icon: '🎯', steps: [
        { t: 'info', fen: '3R2k1/5ppp/8/8/8/8/8/6K1 b - - 0 1', shapes: [A('d8', 'g8', 'red')], text: 'El <b>mate del pasillo</b> es de los más comunes: el rey está en la última fila y sus propios peones le cierran la salida. Una torre o la dama en esa fila dan mate.' },
        { t: 'lichess', themes: ['mateIn1'], min: 400, max: 900, count: 4, text: 'Mate en 1.' },
        { t: 'lichess', themes: ['backRankMate'], min: 500, max: 1100, count: 3, text: 'Mate del pasillo.' },
      ] },
      { id: 'pastor', title: 'Defender el mate del pastor', icon: '🛡️', steps: [
        { t: 'info', fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3', shapes: [A('h5', 'f7', 'red'), A('c4', 'f7', 'red')], text: 'Muchos rivales intentan el mate del pastor: dama a h5 y alfil a c4, los dos contra <b>f7</b>. Hay que saber defenderlo.' },
        { t: 'goal', fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3', goal: 'moves', accept: ['g7g6', 'd8e7', 'd8f6'], wrong: 'Así no paras el mate en f7 (o pierdes un peón gratis). Defiende f7.', text: 'Juegas con <b>negras</b>. La dama blanca amenaza mate en f7. ¡Defiéndete!' },
      ] },
    ],
  },
  {
    id: 'u4', title: 'Táctica I', level: '≈ 650–1000', minRating: 850,
    desc: 'Ataque doble, clavada, enfilada y mate en 2.',
    lessons: [
      { id: 'doble', title: 'El ataque doble', icon: '🍴', steps: [
        { t: 'info', fen: '2r1k3/8/3N4/8/8/8/8/4K3 b - - 0 1', shapes: [A('d6', 'e8', 'red'), A('d6', 'c8', 'red')], text: 'Un <b>ataque doble</b> (u horquilla) ataca dos piezas a la vez. El rival solo puede salvar una. El caballo es el rey de las horquillas.' },
        { t: 'goal', fen: '2r1k3/8/8/1N6/8/8/8/4K3 w - - 0 1', goal: 'moves', accept: ['b5d6'], wrong: 'Busca una casilla desde la que el caballo ataque al rey y a la torre a la vez.', text: 'Haz una horquilla con el caballo.' },
        { t: 'lichess', themes: ['fork'], min: 600, max: 1100, count: 5, text: 'Encuentra el ataque doble.' },
      ] },
      { id: 'clavada', title: 'La clavada', icon: '📌', steps: [
        { t: 'info', fen: '4k3/8/8/4n3/8/8/8/4R1K1 b - - 0 1', shapes: [A('e1', 'e8', 'red'), C('e5', 'red')], text: 'Una <b>clavada</b>: una pieza no puede moverse porque dejaría expuesta otra más valiosa detrás. Aquí el caballo no puede moverse: dejaría a su rey en jaque.' },
        { t: 'goal', fen: '4k3/8/8/4n3/8/8/8/R5K1 w - - 0 1', goal: 'moves', accept: ['a1e1'], wrong: 'Pon la torre en la misma línea que el caballo y el rey negro.', text: 'Clava el caballo contra su rey.' },
        { t: 'lichess', themes: ['pin'], min: 650, max: 1150, count: 4, text: 'Aprovecha la clavada.' },
      ] },
      { id: 'enfilada', title: 'La enfilada', icon: '🎳', steps: [
        { t: 'info', fen: '8/1q6/8/3k4/4B3/8/8/6K1 b - - 0 1', shapes: [A('e4', 'b7', 'red')], text: 'La <b>enfilada</b> es una clavada al revés: atacas una pieza valiosa (a menudo el rey), se aparta, y comes la que estaba detrás.' },
        { t: 'goal', fen: '8/1q6/8/3k4/8/8/4B3/6K1 w - - 0 1', goal: 'moves', accept: ['e2f3'], wrong: 'Busca una diagonal que pase por el rey y por la dama.', text: 'Da jaque de forma que, cuando el rey se aparte, ganes la dama.' },
        { t: 'lichess', themes: ['skewer'], min: 650, max: 1200, count: 4, text: 'Encuentra la enfilada.' },
      ] },
      { id: 'mate2', title: 'Mate en 2', icon: '2️⃣', steps: [
        { t: 'info', fen: START, text: 'En un <b>mate en 2</b> tienes que ver tu jugada, la respuesta del rival y tu remate. Empieza buscando jaques: obligan al rival a responder.' },
        { t: 'lichess', themes: ['mateIn2'], min: 700, max: 1200, count: 5, text: 'Mate en 2 jugadas.' },
      ] },
    ],
  },
  {
    id: 'u5', title: 'Táctica II', level: '≈ 1000–1400', minRating: 1200,
    desc: 'Descubiertas, desviaciones, sacrificios y mate en 3.',
    lessons: [
      { id: 'descubierta', title: 'El ataque a la descubierta', icon: '🎭', steps: [
        { t: 'info', fen: '4k3/8/8/8/8/8/4N3/4R1K1 w - - 0 1', shapes: [A('e1', 'e8', 'red')], text: 'Al mover una pieza destapas el ataque de otra que estaba detrás: es un <b>ataque a la descubierta</b>. Si la pieza que se mueve también ataca algo, el rival no puede defenderlo todo.' },
        { t: 'lichess', themes: ['discoveredAttack'], min: 900, max: 1350, count: 5, text: 'Ataque a la descubierta.' },
      ] },
      { id: 'desviacion', title: 'Desviación y atracción', icon: '🧲', steps: [
        { t: 'info', fen: START, text: 'Una <b>desviación</b> obliga a una pieza defensora a abandonar su puesto. Una <b>atracción</b> obliga a una pieza (a menudo el rey) a ir a una casilla mala.' },
        { t: 'lichess', themes: ['deflection', 'attraction'], min: 1000, max: 1450, count: 5, text: 'Desvía o atrae.' },
      ] },
      { id: 'sacrificio', title: 'Sacrificios', icon: '💥', steps: [
        { t: 'info', fen: START, text: 'Un <b>sacrificio</b> entrega material a cambio de algo más grande: un mate, ganar más material o un ataque imparable.' },
        { t: 'lichess', themes: ['sacrifice'], min: 1050, max: 1500, count: 5, text: 'Encuentra el sacrificio.' },
      ] },
      { id: 'mate3', title: 'Mate en 3', icon: '3️⃣', steps: [
        { t: 'lichess', themes: ['mateIn3'], min: 1050, max: 1550, count: 4, text: 'Mate en 3 jugadas.' },
      ] },
    ],
  },
  {
    id: 'u6', title: 'Finales', level: '≈ 1300+', minRating: 1600,
    desc: 'Rematar la partida: mates con dama y torre, y finales de peones.',
    lessons: [
      { id: 'kqk', title: 'Mate con dama y rey', icon: '♛', steps: [
        { t: 'info', fen: '8/8/8/4k3/8/8/8/3QK3 w - - 0 1', text: 'Técnica: 1) Con la dama, a salto de caballo del rey rival, <b>encierra</b> al rey contra un borde. 2) Acerca <b>tu rey</b>. 3) Da el mate. ¡Cuidado con ahogar!' },
        { t: 'playout', fen: '8/8/8/4k3/8/8/8/3QK3 w - - 0 1', goal: 'mate', maxMoves: 25, text: 'Da mate en menos de 25 jugadas. El motor defiende lo mejor posible.' },
      ] },
      { id: 'krk', title: 'Mate con torre y rey', icon: '♜', steps: [
        { t: 'info', fen: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1', text: 'Con la torre se va «cortando» al rey fila a fila. Pon los reyes frente a frente (oposición) y da jaque con la torre para que retroceda. Si la torre está atacada, aléjala por el otro lado.' },
        { t: 'playout', fen: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1', goal: 'mate', maxMoves: 40, text: 'Da mate en menos de 40 jugadas.' },
      ] },
      { id: 'kpk', title: 'Rey y peón contra rey', icon: '♟', steps: [
        { t: 'info', fen: '4k3/8/8/8/8/4K3/4P3/8 w - - 0 1', text: 'En los finales de peón, <b>el rey va delante</b> del peón para abrirle paso. La clave es la <b>oposición</b>: reyes enfrentados con una casilla en medio; quien no tiene que mover gana la pelea.' },
        { t: 'playout', fen: '4k3/8/8/8/8/4K3/4P3/8 w - - 0 1', goal: 'promote', maxMoves: 30, text: 'Corona el peón sin que te lo coman y sin ahogar.' },
      ] },
    ],
  },
];

/** Lista plana de lecciones con su unidad. */
export const LESSONS = UNITS.flatMap((u, ui) => u.lessons.map((l) => ({ ...l, unit: u, unitIndex: ui })));

/** Unidad en la que empieza alguien según su ELO. */
export function startUnitFor(rating) {
  let s = 0;
  UNITS.forEach((u, i) => {
    const firstOfLevel = i === 0 || u.minRating > UNITS[i - 1].minRating;
    if (rating >= u.minRating && firstOfLevel) s = i;
  });
  return s;
}
