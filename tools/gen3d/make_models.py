# Paso 2: imagen -> malla con textura (Hunyuan3D 2.1), simplificada para el navegador.
# Uso (dentro de /workspace/venv): python make_models.py [ids...]
# Usa elegida/<id>.png si existe; si no, la variante _1.
import json, os, sys, time, traceback, shutil
H = os.environ.get('HY', '/workspace/Hunyuan3D-2.1')
here = os.path.dirname(os.path.abspath(__file__))
cfg = json.load(open(os.path.join(here, 'assets.json')))
out = os.environ.get('OUT', '/workspace/gen3d_out')
sys.path[:0] = [H, f'{H}/hy3dshape', f'{H}/hy3dpaint']
os.chdir(H)
try:
    from torchvision_fix import apply_fix; apply_fix()
except Exception as e: print('aviso torchvision_fix:', e)
from PIL import Image
import trimesh
from hy3dshape.rembg import BackgroundRemover
from hy3dshape.pipelines import Hunyuan3DDiTFlowMatchingPipeline
from textureGenPipeline import Hunyuan3DPaintPipeline, Hunyuan3DPaintConfig
for d in ('raw', 'glb', 'log'): os.makedirs(f'{out}/{d}', exist_ok=True)
only = set(sys.argv[1:])
shape = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained('tencent/Hunyuan3D-2.1')
rembg = BackgroundRemover()
conf = Hunyuan3DPaintConfig(6, 512)
conf.realesrgan_ckpt_path = 'hy3dpaint/ckpt/RealESRGAN_x4plus.pth'
conf.multiview_cfg_path = 'hy3dpaint/cfgs/hunyuan-paint-pbr.yaml'
conf.custom_pipeline = 'hy3dpaint/hunyuanpaintpbr'
conf.texture_size = 1024; conf.render_size = 1024   # texturas de 1024: suficientes para el juego y mucho más ligeras
paint = Hunyuan3DPaintPipeline(conf)
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
        mesh.export(f'{out}/raw/{i}_full.glb')
        if len(mesh.faces) > a['faces']:   # menos caras: archivo pequeño y estilo low-poly
            mesh = mesh.simplify_quadric_decimation(face_count=a['faces'])
        mesh.export(f'{out}/raw/{i}_shape.obj')
        paint(mesh_path=f'{out}/raw/{i}_shape.obj', image_path=f'{out}/raw/{i}_rgba.png',
              output_mesh_path=f'{out}/raw/{i}_tex.obj', use_remesh=False, save_glb=False)
        # OBJ con su textura -> GLB (sin Blender)
        tm = trimesh.load(f'{out}/raw/{i}_tex.obj', force='mesh', process=False)
        tm.export(f'{out}/glb/{i}.glb')
        print(f'OK {i} {time.time()-t0:.0f}s caras={len(mesh.faces)} -> {os.path.getsize(f"{out}/glb/{i}.glb")//1024} KB', flush=True)
    except Exception:
        open(f'{out}/log/{i}.txt', 'w').write(traceback.format_exc())
        print(f'FALLO {i} (ver log/{i}.txt)', flush=True)
