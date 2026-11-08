---
name: cursor-build-animation
description: Turns an HTML dashboard, landing page or app screen into a Figma-style collaborative-cursor build animation (1920x1080, one self-contained HTML file, optional MP4) in which 4 to 12 named cursors drag selection frames, drop cards, draw charts and count up numbers until the full UI is revealed. Use when the user asks to "animate my dashboard with cursors", "make a UI that builds itself", "create a multi-cursor or collaborative cursor animation", "turn this screen into an animated hero or product demo", or "export the UI build animation to MP4". Also in Spanish, "animación de cursores colaborativos", "dashboard que se arma solo", "anima esta interfaz con cursores".
---

# Cursor Build Animation

Genera una animación de 1920×1080 en la que 4, 8 o 12 cursores con nombre ("Ana", "Kenji", "Lucía"…) construyen una interfaz como si un equipo la diseñara en vivo: arrastran rectángulos de selección con medidas ("Frame 593 × 283"), sueltan piezas con manijas y guías rosa de alineación, corrigen el desplazamiento de algunas tarjetas ("x 688  y 100"), dibujan líneas, barras y donas, y llenan los contadores. La cámara hace zoom suave y, al final, se aleja para la revelación.

Todo es HTML/CSS/JS sin dependencias, en un solo archivo, y se puede capturar fotograma a fotograma para sacar un MP4.

## Cuándo usarlo

- El usuario pide una animación, demo, hero o video de una UI "armándose sola" o "con cursores colaborativos / multi-cursor".
- Tiene un dashboard, landing o pantalla en HTML (o quieres crear uno) y la quiere animada.

No lo uses para animar una página interactiva ya publicada (esto reconstruye la UI desde cero, no graba una web viva), ni para animaciones de datos reales en tiempo real.

## Requisitos y compatibilidad

- **Construir la animación:** Python 3.8 o superior, sin paquetes externos. En Windows usa `python` si `python3` no existe.
- **Fotogramas PNG y MP4 (opcional):** Node.js 18+, el paquete `playwright` con Chromium y, para MP4, `ffmpeg` en el PATH. No instales nada sin pedir permiso al usuario. Si faltan, revisa los fotogramas en el navegador del agente (paso 4).
- **Agentes:** funciona en cualquier agente que lea `SKILL.md` y pueda ejecutar Python: Claude Code, Codex, Gemini CLI / Antigravity, Cursor. Las rutas de los comandos son relativas a la carpeta de la skill.

## Flujo

1. **Tener la UI en un lienzo de 1920×1080 px.** Si el usuario no tiene UI, créala en HTML+CSS con unidades en píxeles, dentro de `<div id="ui">`. Parte de `templates/ui-skeleton.html`. Si ya tiene una página, no hace falta adaptarla: se envuelve sola.
2. **Anotar las piezas** con `data-b` (ver tabla abajo). Dos caminos:
   - **Manual (mejor resultado):** añade `data-b data-k="…" data-s="…"` a cada pieza. Usa `examples/dashboard-ui.html` como modelo.
   - **Automático:** `--auto` anota por selectores (aside/header → slide, tarjetas → rise, botones/chips → pop, filas → fade). Sirve para HTML ajeno; los gráficos SVG y los contadores requieren marcas explícitas (`data-cb="line"`, `data-cb="bar"`, `data-cb="count"`).
3. **Construir el archivo final:**
   ```bash
   python3 scripts/build.py --ui mi_ui.html --out animacion.html            # UI anotada a mano
   python3 scripts/build.py --ui pagina.html --auto --count 12 --out animacion.html
   ```
4. **Verificar** (obligatorio antes de entregar):
   ```bash
   node scripts/render.js animacion.html --out frames --stills 1,3,5,7,9,11,13
   ```
   `render.js` ejecuta primero la autoprueba de alineación e imprime `OK check: desfase máx … px`; si dice `ERROR`, termina con código 1 y no se entrega. Con `--channel chrome` o `--channel msedge` usa el navegador instalado.
   Sin Playwright, abre el HTML en el navegador del agente con `?hud=0&check=1`: tras ~2 s aparece arriba a la izquierda una etiqueta verde `check OK` o roja `check FALLÓ`, y el informe queda en `window.__cbCheck` (también `__cb.selfTest()` en la consola). Luego toma capturas con `?hud=0&t=3`, `?hud=0&t=7` y `?hud=0&t=99` (el último salta al final); `t` pausa la animación en ese segundo.
   Mira al menos t=3 (estructura), t=7 (ensamblaje) y el último (revelación). Comprueba lo de la lista de verificación de abajo.
5. **Entregar** el `.html`. Si piden video: `node scripts/render.js animacion.html --fps 30 --mp4 animacion.mp4` (requiere `playwright` y `ffmpeg`).

## Formato de entrega

Responde al usuario con:

1. La ruta del `.html` generado y cómo abrirlo (doble clic o navegador; teclas `Espacio`, `R`, `←`/`→`).
2. Número de cursores, piezas anotadas y duración aproximada (los imprime `build.py`).
3. El resultado de la autoprueba (`OK` y desfase máximo en px) y los fotogramas revisados (rutas o capturas), con una línea por cada punto de la lista de verificación que se cumple o no.
4. La ruta del MP4, solo si lo pidieron.

## Vocabulario de atributos

| Atributo | Dónde | Qué hace |
|---|---|---|
| `data-b` | cualquier elemento | Lo marca como pieza que un cursor construye. Las piezas anidadas se construyen después de su padre. |
| `data-k="slide"` | cajas grandes (sidebar, header) | Aparece cuando el cursor termina de arrastrar su rectángulo de selección. |
| `data-k="rise"` | tarjetas | Igual que `slide`; pensada para tarjetas y paneles. |
| `data-k="pop"` | chips, botones, avatares, logos | Pieza pequeña con rebote (`eBack`). |
| `data-k="line"` | `<path>` / `<polyline>` SVG | Se traza de izquierda a derecha. Ponle `fill="none"` y `stroke`. El runtime fija `pathLength=1`. |
| `data-k="bar"` | barras | Crecen desde la base (`scaleY`). Define la altura en el estilo. Si no defines `transform-origin`, el motor lo fija en la base. |
| `data-k="prog"` | relleno de barra de progreso | Crece de izquierda a derecha (`scaleX`). Si no defines `transform-origin`, el motor lo fija a la izquierda. |
| `data-k="arc"` + `data-len="42"` | `<circle>` SVG de una dona | Dibuja `len` de 100. Pon `stroke-dashoffset` negativo acumulado para encadenar arcos y `transform="rotate(-90 cx cy)"` como atributo SVG. |
| `data-k="fade"` | filas, ítems | Aparece con fundido. |
| `data-s="3.9"` | toda pieza | Orden de construcción: las de menor valor se construyen antes. Se reparte entre cursores libres. |
| `data-ax` / `data-ay` + `data-at="9.0"` | pieza `rise`/`pop` | Nace desplazada esos píxeles y un cursor la "corrige" en el segundo `data-at`, con etiqueta `x … y …`. Úsalo en 2–4 piezas como máximo. |
| `data-sel` | cajas | Al soltar, muestra manijas y guías de alineación. |
| `data-count="1284560"` (+ `data-pre="$"`, `data-suf="%"`, `data-dec="1"`) | elemento de texto | Contador que sube hasta el valor al aparecer su tarjeta y termina en la revelación. Usa cifras de ancho fijo y reserva el ancho del valor final, así no empuja a los elementos de al lado. |

## Guion recomendado de tiempos (`data-s`)

Las 5 fases del HUD se calculan sobre la duración real: Lienzo vacío → Estructura → Ensamblaje → Ajustes finales → Revelación.

| Segundos | Qué construir |
|---|---|
| 0 – 1.5 | Nada (lienzo vacío con cuadrícula). |
| 2.0 – 3.7 | Estructura: sidebar, header, ítems de menú, logo. |
| 3.8 – 5.8 | Tarjetas KPI y paneles grandes (`rise`). |
| 5.6 – 8.0 | Chips, deltas, líneas, donas. |
| 7.0 – 10.7 | Barras, filas de tabla, barras de progreso. |
| `data-at` 8.8 – 10.2 | Correcciones de posición en 2–4 tarjetas. |

Con 8 cursores y ~57 piezas la animación dura ≈ 14 s; con 12 cursores, ≈ 12 s; con 4, más.

## Opciones de `CursorBuild.mount('#ui', {...})`

`count` (4/8/12) · `speed` · `loop` · `paths` (muestra la trayectoria siguiente) · `labels` · `cameraMotion` · `lang` (`'es'`/`'en'`) · `hud` · `names` · `colors` · `phases` · `background` · `stageBackground` · `auto`.

Parámetros en la URL del HTML generado: `?hud=0`, `?count=12`, `?speed=2`, `?loop=0`, `?paths=1`, `?labels=0`, `?lang=en`, `?t=7` (pausa en el segundo 7), `?check=1` (autoprueba de alineación con etiqueta en pantalla).

Teclado: `Espacio` pausa/reproduce · `R` reinicia · `←`/`→` ±1 s.
API: `__cb.seek(t)` es determinista (la usa `render.js`), `__cb.selfTest()` devuelve `{ ok, maxOffsetPx, checked, issues, warnings }`, además de `play()`, `pause()`, `setCount(n)`, `END`, `L`.

Cómo se mantiene todo alineado: el motor mide cada pieza en el lienzo 1920×1080 tal como queda al final, y las cajas, manijas, guías y cursores del canvas pasan por la misma cámara (zoom y desplazamiento) que la UI. Si el layout cambia después (fuentes web, imágenes), vuelve a medir solo.

## Lista de verificación antes de entregar

- [ ] En t≈3 s se ve sidebar/header con rectángulos de selección "Frame W × H" y cursores con nombre.
- [ ] En t≈7 s las tarjetas ya están y se dibujan líneas/barras; ningún elemento aparece "de golpe" sin cursor.
- [ ] En el último fotograma la UI está completa, contadores en su valor final y no quedan cursores.
- [ ] La autoprueba da `OK` (desfase máximo ≤ 2 px) y no hay avisos de piezas fuera del lienzo o sin tamaño.
- [ ] Consola sin errores (`render.js` falla si no hay piezas o si la autoprueba falla).
- [ ] Textos y cifras son los del usuario, no de relleno.

## Trampas conocidas

- **Tamaño:** la UI debe medir 1920×1080; el runtime la escala para ajustarla a la ventana. Con `position:absolute`/`fixed` propios, referencia siempre a `#ui`.
- **Transformaciones:** `slide/rise/pop/bar/prog` usan `style.transform`. Un `translate` propio (por ejemplo, `translate(-50%,-50%)` para centrar) se conserva y se combina. Una rotación o escala propia también se conserva, pero el motor avisa en la consola; si la pieza se deforma, envuélvela en otro `div`. Las piezas `display:inline` pasan a `inline-block`, porque un elemento en línea ignora `transform`.
- **Fuentes web e imágenes:** el runtime vuelve a medir cuando terminan de cargar o cambia el tamaño de una pieza. Para grabar con `render.js` ya espera 800 ms.
- **Capturas:** un `<body>` con fondo propio no se hereda; usa `--stage-bg` para igualar el color del lienzo.
- **Demasiadas piezas:** más de ~150 piezas ralentiza el dibujo; anota solo lo visible y agrupa listas largas en una sola pieza `rise`.

## Seguridad y privacidad

- La skill no hace llamadas de red, no pide credenciales ni claves de API y no lee variables de entorno.
- `scripts/build.py` solo lee el archivo `--ui` y `runtime/cursor-build.js`, y escribe el archivo `--out`.
- `scripts/render.js` abre el HTML local en Chromium sin interfaz, guarda PNG en `--out` y, si se pide MP4, ejecuta `ffmpeg` con argumentos fijos (sin shell).
- `runtime/cursor-build.js` solo modifica el DOM de la página donde se monta: no usa cookies, almacenamiento ni `fetch`.
- Las fuentes o estilos externos que aparezcan en la animación vienen del HTML del usuario, no de la skill.

## Archivos

- `runtime/cursor-build.js` — motor (cursores, planificador, cámara, HUD, `autoAnnotate`).
- `scripts/build.py` — empaqueta UI + runtime en un HTML autónomo.
- `scripts/render.js` — fotogramas PNG y MP4 con Playwright.
- `templates/ui-skeleton.html` — punto de partida para UIs nuevas, con la hoja de atributos.
- `examples/dashboard-ui.html` y `examples/dashboard-animation.html` — dashboard de ejemplo, anotado y ya construido.
