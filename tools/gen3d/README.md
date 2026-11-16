# Generación de modelos 3D (pod con GPU)

1. Pod RunPod con plantilla PyTorch y GPU de 24 GB o más (A40 va bien).
2. En la terminal del pod:
   ```bash
   cd /workspace && git clone https://github.com/jolo8790-ux/ecos-de-aethra && cd ecos-de-aethra
   bash tools/gen3d/setup.sh
   python tools/gen3d/make_images.py      # imágenes de concepto en /workspace/gen3d_out/img
   python tools/gen3d/make_models.py      # modelos en /workspace/gen3d_out/glb
   ```
3. Para elegir otra variante de imagen, copia la que prefieras a `/workspace/gen3d_out/elegida/<id>.png`.

Los modelos se simplifican y luego se integran en el juego con `tools/build_assets.mjs`.
