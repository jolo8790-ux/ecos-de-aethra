# Paso 2: imagen -> malla con textura (Hunyuan3D 2.1). Paso 3: simplificar para el navegador.
# Uso: python make_models.py [ids...]   (elige la variante _1 salvo que exista elegida/<id>.png)
import json, os, sys, time, traceback
H = os.environ.get('HY', '/workspace/Hunyuan3D-2.1')
sys.path[:0] = [H, f'{H}/hy3dshape', f'{H}/hy3dpaint']
os.chdir(H)
from PIL import Image
import trimesh
from hy3dshape.pipelines import Hunyuan3DDiTFlowMatchingPipeline
from hy3dshape.rembg import BackgroundRemover
from textureGenPipeline import Hunyuan3DPaintPipeline, Hunyuan3DPaintConfig
here = os.path.dirname(os.path.abspath(__file__))
cfg = json.load(open(os.path.join(here, 'assets.json')))
out = os.environ.get('OUT', '/workspace/gen3d_out')
for d in ('raw', 'glb', 'log'): os.makedirs(f'{out}/{d}', exist_ok=True)
only = set(sys.argv[1:])
shape = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained('tencent/Hunyuan3D-2.1')
rembg = BackgroundRemover()
pc = Hunyuan3DPaintConfig(max_num_view=6, resolution=512)
pc.realesrgan_ckpt_path = f'{H}/hy3dpaint/ckpt/RealESRGAN_x4plus.pth'
pc.multiview_cfg_path = f'{H}/hy3dpaint/cfgs/hunyuan-paint-pbr.yaml'
pc.custom_pipeline = f'{H}/hy3dpaint/hunyuanpaintpbr'
paint = Hunyuan3DPaintPipeline(pc)
for a in cfg['assets']:
    i = a['id']
    if only and i not in only: continue
    if os.path.exists(f'{out}/glb/{i}.glb'): continue
    t0 = time.time()
    try:
        src = f'{out}/elegida/{i}.png' if os.path.exists(f'{out}/elegida/{i}.png') else f'{out}/img/{i}_1.png'
        img = rembg(Image.open(src).convert('RGB'))
        img.save(f'{out}/raw/{i}_rgba.png')
        mesh = shape(image=img, num_inference_steps=30, octree_resolution=256, seed=1)[0]
        # simplificar antes de pintar: menos caras = textura más limpia y archivo pequeño
        mesh = mesh.simplify_quadric_decimation(face_count=a['faces']) if len(mesh.faces) > a['faces'] else mesh
        mesh.export(f'{out}/raw/{i}_shape.obj')
        paint(mesh_path=f'{out}/raw/{i}_shape.obj', image_path=f'{out}/raw/{i}_rgba.png', output_mesh_path=f'{out}/raw/{i}_tex.obj')
        tm = trimesh.load(f'{out}/raw/{i}_tex.obj', force='mesh')
        tm.export(f'{out}/glb/{i}.glb')
        print(f'OK {i} {time.time()-t0:.0f}s caras={len(tm.faces)}', flush=True)
    except Exception:
        open(f'{out}/log/{i}.txt', 'w').write(traceback.format_exc())
        print(f'FALLO {i} (ver log/{i}.txt)', flush=True)
