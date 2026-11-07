#!/usr/bin/env python3
"""build.py — empaqueta una UI anotada (o cualquier HTML) en una animación autónoma de un solo archivo.

Ejemplos:
  python3 scripts/build.py --ui examples/dashboard-ui.html --out salida.html
  python3 scripts/build.py --ui mi_pagina.html --auto --count 12 --lang en --out salida.html
"""
import argparse, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
RUNTIME = os.path.join(HERE, '..', 'runtime', 'cursor-build.js')

PAGE = """<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<style>html,body{{margin:0;height:100%;background:{bg};overflow:hidden}}</style>
{head_extra}
</head>
<body>
{ui}
<script>
{runtime}
</script>
<script>
CursorBuild.mount('#ui', {opts});
</script>
</body>
</html>
"""


def extract_page(src):
    """Si es una página completa, separa estilos del <head> y el contenido del <body>."""
    if not re.search(r'<body', src, re.I):
        return '', src
    head = re.search(r'<head[^>]*>(.*?)</head>', src, re.I | re.S)
    body = re.search(r'<body[^>]*>(.*?)</body>', src, re.I | re.S)
    extra = ''
    if head:
        extra = ''.join(re.findall(r'<style[^>]*>.*?</style>|<link[^>]+rel=["\']stylesheet["\'][^>]*>', head.group(1), re.I | re.S))
    return extra, (body.group(1) if body else src)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--ui', required=True, help='HTML de la interfaz (fragmento con #ui, o página completa)')
    ap.add_argument('--out', required=True, help='archivo HTML de salida')
    ap.add_argument('--auto', action='store_true', help='anotar automáticamente con data-b (para HTML sin anotar)')
    ap.add_argument('--count', type=int, default=8, help='cursores (4, 8 o 12)')
    ap.add_argument('--speed', type=float, default=1)
    ap.add_argument('--lang', default='es', choices=['es', 'en'])
    ap.add_argument('--title', default='Animación de cursores colaborativos')
    ap.add_argument('--bg', default='#05070B', help='color de fondo fuera del lienzo')
    ap.add_argument('--stage-bg', default='#080A0F', help='color de fondo del lienzo 1920×1080')
    ap.add_argument('--no-hud', action='store_true', help='sin barra de controles (para grabar)')
    ap.add_argument('--no-loop', action='store_true')
    ap.add_argument('--no-labels', action='store_true', help='sin etiquetas con nombre en los cursores')
    ap.add_argument('--no-camera', action='store_true', help='sin movimiento de cámara')
    a = ap.parse_args()

    src = open(a.ui, encoding='utf-8').read()
    extra, ui = extract_page(src)
    if not re.search(r'id=["\']ui["\']', ui):
        ui = '<div id="ui">\n%s\n</div>' % ui
    opts = {'count': a.count, 'speed': a.speed, 'lang': a.lang, 'hud': not a.no_hud, 'loop': not a.no_loop,
            'labels': not a.no_labels, 'cameraMotion': not a.no_camera, 'auto': a.auto,
            'background': a.bg, 'stageBackground': a.stage_bg}
    runtime = open(RUNTIME, encoding='utf-8').read().replace('</script', '<\\/script')
    html = PAGE.format(lang=a.lang, title=a.title, bg=a.bg, head_extra=extra, ui=ui, runtime=runtime, opts=json.dumps(opts))
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    open(a.out, 'w', encoding='utf-8').write(html)
    n = len(re.findall(r'<[^>]*\bdata-b\b', re.sub(r'<!--.*?-->', '', ui, flags=re.S)))
    print('OK  %s  (%.0f KB, %d piezas anotadas%s)' % (a.out, len(html) / 1024, n, ', auto-anotado en el navegador' if a.auto else ''))
    if n == 0 and not a.auto:
        print('AVISO: no hay elementos data-b; usa --auto o anota la UI a mano.', file=sys.stderr)


if __name__ == '__main__':
    main()
