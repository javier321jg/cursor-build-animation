# Cursor Build Animation

Skill que convierte una interfaz HTML en una animación de cursores colaborativos al estilo Figma. Entre 4 y 12 cursores construyen la pantalla por partes, trazan gráficos, actualizan contadores y ajustan la posición de las tarjetas antes de revelar la interfaz completa.

## Demo

[![Animación de ocho cursores construyendo un dashboard de ventas](docs/preview.gif)](https://javier321jg.github.io/cursor-build-animation/)

**[Abrir el demo interactivo](https://javier321jg.github.io/cursor-build-animation/)** · [Ver el HTML del demo](docs/index.html) · [Descargar la skill en ZIP](https://javier321jg.github.io/cursor-build-animation/cursor-build-animation.zip)

En el demo puedes cambiar el número de cursores, ajustar la velocidad y activar las trayectorias. Pulsa **Espacio** para pausar o reproducir, **R** para reiniciar y **← / →** para retroceder o avanzar un segundo.

## Instalar la skill

Clona el repositorio o descarga y descomprime el ZIP. Copia la carpeta `cursor-build-animation` completa al directorio de skills de tu proyecto.

| Agente | Ruta dentro del proyecto |
| --- | --- |
| Claude Code | `.claude/skills/cursor-build-animation/` |
| Codex | `.agents/skills/cursor-build-animation/` |

La carpeta instalada debe contener [`SKILL.md`](SKILL.md), `runtime/`, `scripts/`, `templates/` y `examples/`.

En Claude web o escritorio, carga directamente el ZIP desde la sección de skills. [Guía de instalación de Claude](https://support.claude.com/en/articles/12512180-use-skills-in-claude).

Adjunta tu HTML y prueba con esta instrucción.

> Usa la skill cursor-build-animation para animar este dashboard con ocho cursores. Entrega un HTML autónomo y verifica cómo se ve el ensamblaje y la revelación final.

## Generar una animación desde la terminal

Ejecuta los comandos desde la carpeta del repositorio. En Windows, usa `python` si `python3` no está disponible.

```bash
# Construir el ejemplo anotado
python3 scripts/build.py --ui examples/dashboard-ui.html --out animacion.html

# Anotar una interfaz propia automáticamente
python3 scripts/build.py --ui mi-dashboard.html --auto --count 12 --out animacion.html
```

Abre `animacion.html` en el navegador. Para controlar el orden y el tipo de entrada de cada pieza, consulta los atributos `data-b`, `data-k` y `data-s` en [`SKILL.md`](SKILL.md). Puedes comenzar con la [plantilla de interfaz](templates/ui-skeleton.html) o el [dashboard anotado](examples/dashboard-ui.html).

### Capturar fotogramas o exportar a MP4

```bash
npm install --no-save playwright
npx playwright install chromium
node scripts/render.js animacion.html --out frames --stills 3,7,14
node scripts/render.js animacion.html --fps 30 --mp4 animacion.mp4
```

La exportación a MP4 requiere `ffmpeg` en el PATH. El demo incluido funciona como un HTML autónomo en el navegador.

## Licencia

[MIT](LICENSE).
