#!/usr/bin/env python3
"""package_skill.py — valida la skill y genera el ZIP para publicarla (Agensi, Claude, Codex, Gemini).

Uso, desde la raíz del repositorio:
  python tools/package_skill.py            # dist/cursor-build-animation.zip y docs/cursor-build-animation.zip
  python tools/package_skill.py --flat     # variante con SKILL.md en la raíz del ZIP, sin carpeta
  python tools/package_skill.py --no-docs  # no toca docs/

Estructura generada (la que piden Agensi y Claude):
  cursor-build-animation.zip
  └── cursor-build-animation/
      ├── SKILL.md
      ├── README.md, LICENSE
      ├── runtime/  scripts/  templates/  examples/

Comprobaciones antes de empaquetar:
  - SKILL.md tiene frontmatter YAML válido con `name` (slug) y `description`, y un cuerpo con instrucciones.
  - Solo entran archivos de texto con extensiones conocidas; nada oculto, ni enlaces simbólicos, ni binarios.
  - Ningún archivo contiene algo con forma de clave de API o token.
  - El ZIP pesa menos de 50 MB.
El script no hace llamadas de red y solo escribe dentro de dist/ y docs/.
"""
import argparse, io, os, re, shutil, sys, zipfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
INCLUDE = ['SKILL.md', 'README.md', 'LICENSE', 'runtime', 'scripts', 'templates', 'examples']
TEXT_EXT = {'.md', '.py', '.js', '.html', '.css', '.json', '.txt', ''}   # '' = LICENSE
SKIP_NAMES = {'__pycache__', 'Thumbs.db', 'desktop.ini', 'node_modules'}
MAX_BYTES = 50 * 1024 * 1024
FIXED_DATE = (2026, 1, 1, 0, 0, 0)   # fecha fija: el mismo contenido produce el mismo ZIP
SECRET_PATTERNS = [
    re.compile(r'sk-[A-Za-z0-9_-]{20,}'),                      # OpenAI / Anthropic
    re.compile(r'AKIA[0-9A-Z]{16}'),                            # AWS
    re.compile(r'gh[pousr]_[A-Za-z0-9]{30,}'),                  # GitHub
    re.compile(r'AIza[0-9A-Za-z_-]{35}'),                       # Google
    re.compile(r'(?i)(api[_-]?key|secret|password|token)\s*[:=]\s*["\'][^"\']{12,}["\']'),
]


def fail(msg):
    print('ERROR  ' + msg, file=sys.stderr)
    sys.exit(1)


def read_frontmatter(path):
    """Devuelve (frontmatter: dict, cuerpo: str) y falla si SKILL.md no es válido."""
    text = open(path, encoding='utf-8').read()
    m = re.match(r'^---\r?\n(.*?)\r?\n---\r?\n(.*)$', text, re.S)
    if not m:
        fail('SKILL.md debe empezar con un bloque de frontmatter entre líneas ---')
    raw, body = m.group(1), m.group(2)
    try:
        import yaml   # PyYAML, si está instalado: validación estricta
        meta = yaml.safe_load(raw)
    except ImportError:
        meta = dict(re.findall(r'^([A-Za-z_-]+):\s*(.+)$', raw, re.M))
    except Exception as e:   # YAML mal formado
        fail('el frontmatter de SKILL.md no es YAML válido: %s' % e)
    if not isinstance(meta, dict):
        fail('el frontmatter de SKILL.md debe ser un mapa clave: valor')
    name, desc = str(meta.get('name') or ''), str(meta.get('description') or '')
    if not re.fullmatch(r'[a-z0-9]+(-[a-z0-9]+)*', name) or len(name) > 64:
        fail('`name` debe ser un slug en minúsculas con guiones (máx. 64): %r' % name)
    if not desc.strip():
        fail('falta `description` en el frontmatter')
    if len(desc) > 1024:
        fail('`description` tiene %d caracteres; el máximo es 1024' % len(desc))
    if '<' in desc or '>' in desc:
        fail('`description` no puede contener < ni >')
    if len(body.strip()) < 200:
        fail('el cuerpo de SKILL.md está vacío o es demasiado corto')
    return meta, body


def collect():
    """Lista (ruta_relativa, ruta_absoluta) de los archivos que entran al ZIP, ya validados."""
    files = []
    for item in INCLUDE:
        p = os.path.join(ROOT, item)
        if not os.path.exists(p):
            fail('falta %s' % item)
        if os.path.isfile(p):
            files.append((item, p))
            continue
        for d, dirs, names in os.walk(p):
            dirs[:] = sorted(x for x in dirs if not x.startswith('.') and x not in SKIP_NAMES)
            for n in sorted(names):
                if n.startswith('.') or n in SKIP_NAMES or n.endswith('.pyc'):
                    continue
                full = os.path.join(d, n)
                files.append((os.path.relpath(full, ROOT).replace(os.sep, '/'), full))
    for rel, full in files:
        if os.path.islink(full):
            fail('%s es un enlace simbólico' % rel)
        if os.path.splitext(rel)[1].lower() not in TEXT_EXT:
            fail('%s no es un archivo de texto permitido (%s)' % (rel, ', '.join(sorted(e for e in TEXT_EXT if e))))
        data = open(full, 'rb').read()
        if b'\x00' in data:
            fail('%s parece binario' % rel)
        text = data.decode('utf-8', errors='replace')
        for pat in SECRET_PATTERNS:
            hit = pat.search(text)
            if hit:
                fail('%s contiene algo con forma de credencial: %s…' % (rel, hit.group(0)[:12]))
    return files


def build_zip(name, files, flat):
    """Crea el ZIP en memoria con finales de línea LF y fecha fija."""
    buf = io.BytesIO()
    prefix = '' if flat else name + '/'
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        dirs = sorted({prefix + rel.rsplit('/', 1)[0] + '/' for rel, _ in files if '/' in rel} | ({prefix} if prefix else set()))
        for d in dirs:
            info = zipfile.ZipInfo(d, FIXED_DATE); info.external_attr = 0o40755 << 16
            z.writestr(info, b'')
        for rel, full in files:
            data = open(full, 'rb').read().replace(b'\r\n', b'\n')
            info = zipfile.ZipInfo(prefix + rel, FIXED_DATE)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = (0o755 if rel.startswith('scripts/') else 0o644) << 16
            z.writestr(info, data)
    return buf.getvalue()


def verify(blob, name, flat):
    """Relee el ZIP y comprueba la estructura que validan Agensi y Claude."""
    with zipfile.ZipFile(io.BytesIO(blob)) as z:
        names = z.namelist()
        if any(n.startswith('/') or '..' in n.split('/') for n in names):
            fail('el ZIP contiene rutas absolutas o con ..')
        if flat:
            ok = 'SKILL.md' in names
        else:
            tops = {n.split('/', 1)[0] for n in names}
            ok = tops == {name} and (name + '/SKILL.md') in names
        if not ok:
            fail('estructura inesperada en el ZIP')
        return names


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--flat', action='store_true', help='SKILL.md en la raíz del ZIP, sin carpeta contenedora')
    ap.add_argument('--no-docs', action='store_true', help='no copiar el ZIP a docs/')
    a = ap.parse_args()
    for stream in (sys.stdout, sys.stderr):   # tildes legibles también en consolas de Windows
        if hasattr(stream, 'reconfigure'):
            stream.reconfigure(encoding='utf-8')

    meta, _ = read_frontmatter(os.path.join(ROOT, 'SKILL.md'))
    name = meta['name']
    files = collect()
    blob = build_zip(name, files, a.flat)
    if len(blob) > MAX_BYTES:
        fail('el ZIP pesa %.1f MB; el límite es 50 MB' % (len(blob) / 1048576))
    names = verify(blob, name, a.flat)

    os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
    out = os.path.join(ROOT, 'dist', name + ('-flat' if a.flat else '') + '.zip')
    open(out, 'wb').write(blob)
    if not a.flat and not a.no_docs:
        shutil.copyfile(out, os.path.join(ROOT, 'docs', name + '.zip'))

    print('OK  %s  (%.1f KB, %d archivos)' % (os.path.relpath(out, ROOT), len(blob) / 1024, len(files)))
    print('    name: %s' % name)
    print('    description: %d caracteres' % len(str(meta['description'])))
    for n in names:
        if not n.endswith('/'):
            print('    ' + n)
    if not a.flat and not a.no_docs:
        print('    copiado también a docs/%s.zip' % name)


if __name__ == '__main__':
    main()
