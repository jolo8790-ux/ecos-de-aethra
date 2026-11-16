# Empaqueta los GLB generados para el juego:
#  - reduce las texturas a 512 px en JPEG para que pesen poco,
#  - escribe assets/props/<id>.glb.js (módulo con el GLB en base64, como los personajes),
#  - escribe assets/props/index.js con la lista de modelos disponibles.
# Uso: python pack.py <carpeta_glb> <carpeta_repo>
import base64, io, json, os, struct, sys
from PIL import Image

TEX = int(os.environ.get('TEX', '512'))


def read_glb(b):
    magic, ver, length = struct.unpack_from('<4sII', b, 0)
    assert magic == b'glTF'
    off, js, bin_ = 12, None, b''
    while off < length:
        clen, ctype = struct.unpack_from('<I4s', b, off)
        chunk = b[off + 8: off + 8 + clen]
        if ctype == b'JSON':
            js = json.loads(chunk)
        elif ctype == b'BIN\x00':
            bin_ = chunk
        off += 8 + clen
    return js, bin_


def write_glb(js, bin_):
    j = json.dumps(js, separators=(',', ':')).encode()
    j += b' ' * ((4 - len(j) % 4) % 4)
    bin_ += b'\x00' * ((4 - len(bin_) % 4) % 4)
    total = 12 + 8 + len(j) + 8 + len(bin_)
    return (struct.pack('<4sII', b'glTF', 2, total) + struct.pack('<I4s', len(j), b'JSON') + j
            + struct.pack('<I4s', len(bin_), b'BIN\x00') + bin_)


def shrink(js, bin_):
    views = js.get('bufferViews', [])
    data = [bin_[v.get('byteOffset', 0): v.get('byteOffset', 0) + v['byteLength']] for v in views]
    used = set()
    for mat in js.get('materials', []):
        pbr = mat.get('pbrMetallicRoughness', {})
        if 'metallicRoughnessTexture' in pbr:  # el juego usa su propio material mate
            del pbr['metallicRoughnessTexture']
        pbr['metallicFactor'] = 0.0
        pbr['roughnessFactor'] = 0.85
        for k in ('baseColorTexture',):
            if k in pbr:
                used.add(js['textures'][pbr[k]['index']]['source'])
        for k in ('normalTexture', 'emissiveTexture'):
            if k in mat:
                used.add(js['textures'][mat[k]['index']]['source'])
    for i, im in enumerate(js.get('images', [])):
        if 'bufferView' not in im:
            continue
        if i not in used:
            data[im['bufferView']] = b''
            continue
        img = Image.open(io.BytesIO(data[im['bufferView']])).convert('RGB')
        if max(img.size) > TEX:
            img = img.resize((TEX, TEX), Image.LANCZOS)
        o = io.BytesIO(); img.save(o, 'JPEG', quality=85)
        data[im['bufferView']] = o.getvalue(); im['mimeType'] = 'image/jpeg'
    nb, off = b'', 0
    for v, d in zip(views, data):
        pad = (4 - off % 4) % 4
        nb += b'\x00' * pad; off += pad
        v['byteOffset'] = off; v['byteLength'] = len(d)
        nb += d; off += len(d)
    js['buffers'] = [{'byteLength': len(nb)}]
    return js, nb


def main():
    src, repo = sys.argv[1], sys.argv[2]
    out = os.path.join(repo, 'assets', 'props')
    os.makedirs(out, exist_ok=True)
    ids = []
    skip = set(filter(None, os.environ.get('EXCLUDE', '').split(',')))  # modelos que el juego no usa
    for f in sorted(os.listdir(src)):
        if not f.endswith('.glb'):
            continue
        pid = f[:-4]
        if pid in skip:
            continue
        js, b = read_glb(open(os.path.join(src, f), 'rb').read())
        data = write_glb(*shrink(js, b))
        with open(os.path.join(out, pid + '.glb.js'), 'w') as fh:
            fh.write('export default "' + base64.b64encode(data).decode() + '";\n')
        ids.append(pid)
        print(f'{pid}: {len(data) // 1024} KB')
    with open(os.path.join(out, 'index.js'), 'w') as fh:
        fh.write('// Generado por tools/gen3d/pack.py\nexport default ' + json.dumps(ids) + ';\n')
    print('total', len(ids))


if __name__ == '__main__':
    main()
