# Ecos de Aethra

Aventura 3D con historia para el navegador, hecha con [Three.js](https://threejs.org/).

Lía, una aprendiz de cartógrafa, recorre islas flotantes sobre un mar de nubes para reunir los fragmentos del Corazón de Aethra y decidir el destino de su mundo.

## Estado

| Etapa | Contenido | Estado |
| --- | --- | --- |
| 1. Fundamentos | Motor, cámara, controles, física, guardado | Lista |
| 2. Prólogo jugable | Puerto Bruma, diálogos, primera misión | Lista |
| 3. Combate y capítulo 1 | Bastón, esquiva, Bosque Colgante, Raíz Madre | Lista |
| 4. Capítulos 2 y 3 | Planeador, garfio, Ruinas de Vidrio, Ciudad de Engranajes, Escorpión Prisma, Coloso | Lista |
| 5. Capítulos 4 y 5 | Escudo, pulso de luz, Glaciar del Eco, Ciudadela de la Orden, Sierpe de Escarcha, Vaelor, 2 finales | Lista |
| 6. Arte y sonido | 16 modelos 3D generados con Hunyuan3D 2.1; música sintetizada para cada zona, jefe y final; ambiente | Lista |
| 7. Pruebas y versión final | Equilibrio, errores, publicación | Pendiente |

## Cómo jugar en tu computadora

Los módulos de JavaScript necesitan un servidor local (no se abren con doble clic):

```bash
python -m http.server 8000
# luego abre http://localhost:8000
```

## Controles

| Acción | Teclado | Mando |
| --- | --- | --- |
| Moverse | W A S D (Shift para caminar) | Stick izquierdo |
| Cámara | Arrastrar con el ratón, rueda para acercar | Stick derecho |
| Saltar / doble salto | Espacio | A |
| Golpear (combo de 3) | Clic izquierdo o J | X |
| Esquivar / impulso aéreo | Clic derecho o K | B |
| Planear (con el planeador) | Mantener Espacio al caer | Mantener A |
| Garfio (al anillo marcado) | G o clic central | RB / RT |
| Escudo (bloquea y refleja) | Mantener V | Mantener LB |
| Pulso de luz | Z | LT |
| Elegir en diálogos | 1 / 2 o flechas y E | Cruceta y Y |
| Hablar, leer, usar | E | Y |
| Pausa, ajustes y guardado | Esc o P | Start |

## Estructura

```
index.html              interfaz y menús
js/main.js              bucle del juego, estados, interacción, diálogos, menús
js/input.js             teclado, ratón, táctil y mando
js/physics.js           colisiones con cajas y rampas, escalones
js/player.js            modelo y control de Lía
js/camera.js            cámara en tercera persona que esquiva paredes
js/world.js             construye una zona a partir de sus datos
js/audio.js             efectos de sonido sintetizados
js/music.js             secuenciador de música y ambiente (sin archivos de audio)
js/songs.js             partituras: temas de zona, jefes, final y fanfarrias
js/save.js              guardado local y código de exportación
js/characters.js        personajes animados (modelos KayKit), mezcla de animaciones, mirada
js/rig.js               personaje de respaldo hecho con formas (si los modelos no cargan)
js/fx.js                partículas: polvo, destellos
js/combat.js            enemigos, proyectiles, curaciones y jefes (Raíz Madre, Escorpión Prisma, Coloso, Sierpe, Vaelor)
assets/characters/      modelos y animaciones (.glb codificados en .js)
js/props.js             carga los modelos generados y los encaja en cada pieza (con respaldo de formas simples)
assets/props/           modelos generados (.glb codificados en .js); ver tools/gen3d/
tools/build_assets.mjs  reconstruye los modelos desde el paquete KayKit original
js/zones/*.js           datos de cada zona (plataformas, personajes, diálogos)
prototipos/             prototipos anteriores (Cristales del Cielo)
```

Para añadir una zona nueva basta con crear un archivo en `js/zones/` con sus datos y registrarlo en `js/main.js`.

## Créditos

Personajes y animaciones: [KayKit Adventurers Character Pack](https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0) de Kay Lousberg ([kaylousberg.com](https://www.kaylousberg.com)), licencia CC0.

Modelos de jefes, enemigos y decorados: generados para este juego con [Hunyuan3D 2.1](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1) (Tencent) a partir de imágenes de SDXL; ver `tools/gen3d/`.
