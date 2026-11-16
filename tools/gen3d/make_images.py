# Paso 1: imágenes de concepto con Stable Diffusion XL (abierto, sin cuenta). Dos variantes por modelo.
import json, os, sys, torch
from diffusers import StableDiffusionXLPipeline
here = os.path.dirname(os.path.abspath(__file__))
cfg = json.load(open(os.path.join(here, 'assets.json')))
out = os.environ.get('OUT', '/workspace/gen3d_out'); os.makedirs(f'{out}/img', exist_ok=True)
only = set(sys.argv[1:])
pipe = StableDiffusionXLPipeline.from_pretrained('stabilityai/stable-diffusion-xl-base-1.0', torch_dtype=torch.float16, variant='fp16', use_safetensors=True).to('cuda')
neg = 'photo, realistic, background scenery, ground, floor, shadow, text, watermark, multiple objects, cropped, cut off, blurry, dark background'
for a in cfg['assets']:
    if only and a['id'] not in only: continue
    for seed in (1, 2):
        p = f"{out}/img/{a['id']}_{seed}.png"
        if os.path.exists(p): continue
        img = pipe(prompt=f"{a['prompt']}, {cfg['style']}", negative_prompt=neg, num_inference_steps=30, guidance_scale=7.0,
                   height=1024, width=1024, generator=torch.Generator('cuda').manual_seed(seed)).images[0]
        img.save(p); print('imagen', p, flush=True)
