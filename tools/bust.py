# Marca de versión en todos los módulos del juego para que el navegador (y la app del teléfono)
# nunca use copias viejas en caché: genera el mapa de importación con ?v=<versión>.
import os, re, time, sys
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
v = sys.argv[1] if len(sys.argv) > 1 else time.strftime('%y%m%d%H%M')
mods = []
for d, _, fs in os.walk(os.path.join(root, 'js')):
    for f in fs:
        if f.endswith('.js'):
            rel = os.path.relpath(os.path.join(d, f), root).replace(os.sep, '/')
            mods.append(rel)
mods.sort()
imports = ['"three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js"', '"three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"']
imports += [f'"./{m}": "./{m}?v={v}"' for m in mods]
p = os.path.join(root, 'index.html'); s = open(p, encoding='utf-8').read()
s = re.sub(r'<script type="importmap">.*?</script>', '<script type="importmap">\n{ "imports": {\n  ' + ',\n  '.join(imports) + '\n} }\n</script>', s, count=1, flags=re.S)
s = re.sub(r'<script type="module" src="js/main\.js[^"]*"></script>', f'<script type="module" src="js/main.js?v={v}"></script>', s, count=1)
open(p, 'w', encoding='utf-8').write(s)
print('versión', v, len(mods), 'módulos')
