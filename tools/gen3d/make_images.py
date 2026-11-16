# Paso 1: imágenes de concepto con FLUX.1-schnell (4 pasos). Dos variantes por modelo.
import json, os, sys, torch
from diffusers import FluxPipeline
here = os.path.dirname(os.path.abspath(__file__))
cfg = json.load(open(os.path.join(here, 'assets.json')))
out = os.environ.get('OUT', '/workspace/gen3d_out'); os.makedirs(f'{out}/img', exist_ok=True)
only = set(sys.argv[1:])
pipe = FluxPipeline.from_pretrained('black-forest-labs/FLUX.1-schnell', torch_dtype=torch.bfloat16).to('cuda')
for a in cfg['assets']:
    if only and a['id'] not in only: continue
    for seed in (1, 2):
        p = f"{out}/img/{a['id']}_{seed}.png"
        if os.path.exists(p): continue
        img = pipe(f"{a['prompt']}, {cfg['style']}", num_inference_steps=4, guidance_scale=0.0, height=1024, width=1024,
                   generator=torch.Generator('cuda').manual_seed(seed)).images[0]
        img.save(p); print('imagen', p, flush=True)
