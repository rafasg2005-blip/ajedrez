# Entrenador de Ajedrez

**Web pública (gratis, también en el móvil):** https://rafasg2005-blip.github.io/ajedrez/
En el móvil se puede instalar como app: Chrome → menú ⋮ → «Instalar aplicación»; iPhone/Safari → Compartir → «Añadir a pantalla de inicio».

**Versión local:** doble clic en **Ajedrez.bat**. Se abre el navegador en http://127.0.0.1:8765
(deja abierta la ventana negra mientras juegas; ciérrala para apagar la app).

**Publicar cambios en la web:** `git add -A`, `git commit -m "..."` y `git push` desde esta carpeta
(GitHub Pages se actualiza solo en uno o dos minutos).

## Qué tiene
- **Jugar**: partidas sin límite contra un rival con ELO **adaptativo** (sube si ganas, baja si pierdes) o fijo (250–2500).
  El entrenador comenta cada jugada en vivo (Brillante, Genial, La mejor, Excelente, Buena, De libro, Imprecisión, Error,
  Oportunidad perdida, Error grave), explica el porqué (pieza colgada, mate permitido, ataque doble…) y se para tras tus errores
  para que puedas reintentar. Botones de Pista, Amenaza y Deshacer.
- **Revisión completa** de cada partida: precisión, recuento por tipo de jugada, gráfica de evaluación, línea del motor,
  "Reintentar esta jugada" y "Jugar desde aquí".
- **Problemas**: 34.500 problemas reales de Lichess (de 400 a 2700) que se adaptan a tu ELO de problemas. Modos Normal,
  Racha y **Mis errores** (las posiciones donde fallaste en tus partidas).
- **Aperturas**: 18 líneas principales (blancas y negras) para practicar de memoria, con estrellas de progreso.
- **Historial**: evolución de tu ELO, partidas guardadas y copia de seguridad.

## Datos
Todo se guarda en el navegador (localStorage de http://127.0.0.1:8765). Usa siempre el mismo navegador y haz
"Exportar datos" en Historial de vez en cuando.

## Créditos y licencias
- Motor: Stockfish 18 lite (GPLv3), compilado a WebAssembly por el paquete npm `stockfish`.
- Tablero: chessground 9.2.1 (GPLv3, lichess.org). Reglas: chess.js 1.4.0 (BSD-2).
- Problemas y nombres de aperturas: bases públicas de Lichess (CC0).
- `tools/` contiene los scripts que generaron `data/` (no hacen falta para jugar).
