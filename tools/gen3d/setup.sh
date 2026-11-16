#!/usr/bin/env bash
# Prepara el pod (plantilla RunPod PyTorch, GPU con 24 GB o más).
# Crea un entorno Python 3.10 aparte con las versiones que Tencent probó para Hunyuan3D 2.1.
# Uso: bash tools/gen3d/setup.sh > /workspace/setup.log 2>&1 &
set -e
W=${WORK:-/workspace}
cd $W
export HF_HOME=$W/hf; mkdir -p $HF_HOME
pip install -q uv
[ -d $W/venv ] || uv venv -q -p 3.10 $W/venv
source $W/venv/bin/activate
export UV_HTTP_TIMEOUT=300
uv pip install -q torch==2.5.1 torchvision==0.20.1 --index-url https://download.pytorch.org/whl/cu124
echo "== torch listo"
[ -d Hunyuan3D-2.1 ] || git clone -q --depth 1 https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1
cd Hunyuan3D-2.1
# sin la demo web, Blender ni deepspeed (no hacen falta para generar)
grep -vE '^(bpy|gradio|fastapi|uvicorn|deepspeed|tb_nightly|pythreejs|--extra-index-url)' requirements.txt > /tmp/req.txt
uv pip install -q -r /tmp/req.txt
uv pip install -q sentencepiece protobuf fast_simplification setuptools wheel bpy==4.0.0
echo "== dependencias listas"
(cd hy3dpaint/custom_rasterizer && uv pip install -q -e . --no-build-isolation)
echo "== rasterizador compilado"
(cd hy3dpaint/DifferentiableRenderer && bash compile_mesh_painter.sh)
echo "== mesh painter compilado"
mkdir -p hy3dpaint/ckpt
[ -f hy3dpaint/ckpt/RealESRGAN_x4plus.pth ] || wget -q https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth -P hy3dpaint/ckpt
python -c "import torch, diffusers, custom_rasterizer; print('torch', torch.__version__, 'cuda', torch.cuda.is_available(), 'diffusers', diffusers.__version__)"
echo "LISTO: entorno preparado"
