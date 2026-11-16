#!/usr/bin/env bash
# Prepara el pod (plantilla RunPod PyTorch, GPU con 24 GB o más).
# Uso: bash tools/gen3d/setup.sh
set -e
W=${WORK:-/workspace}
cd $W
export HF_HOME=$W/hf; mkdir -p $HF_HOME
pip install -q --upgrade pip
pip install -q diffusers transformers accelerate sentencepiece protobuf pymeshlab trimesh fast_simplification pillow
if [ ! -d Hunyuan3D-2.1 ]; then git clone --depth 1 https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1; fi
cd Hunyuan3D-2.1
pip install -q -r requirements.txt || pip install -q -r requirements.txt
(cd hy3dpaint/custom_rasterizer && pip install -q -e . --no-build-isolation)
(cd hy3dpaint/DifferentiableRenderer && bash compile_mesh_painter.sh)
mkdir -p hy3dpaint/ckpt
[ -f hy3dpaint/ckpt/RealESRGAN_x4plus.pth ] || wget -q https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth -P hy3dpaint/ckpt
echo "LISTO: entorno preparado"
