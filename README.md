# Ecos de Aethra

Aventura 3D con historia para el navegador, hecha con [Three.js](https://threejs.org/).

Lía, una aprendiz de cartógrafa, recorre islas flotantes sobre un mar de nubes para reunir los fragmentos del Corazón de Aethra y decidir el destino de su mundo.

## Estado: versión 2.4

| Etapa | Contenido | Estado |
| --- | --- | --- |
| 1. Fundamentos | Motor, cámara, controles, física, guardado | Lista |
| 2. Prólogo jugable | Puerto Bruma, diálogos, primera misión | Lista |
| 3. Combate y capítulo 1 | Bastón, esquiva, Bosque Colgante, Raíz Madre | Lista |
| 4. Capítulos 2 y 3 | Planeador, garfio, Ruinas de Vidrio, Ciudad de Engranajes, Escorpión Prisma, Coloso | Lista |
| 5. Capítulos 4 y 5 | Escudo, pulso de luz, Glaciar del Eco, Ciudadela de la Orden, Sierpe de Escarcha, Vaelor, 2 finales | Lista |
| 6. Arte y sonido | 23 modelos 3D generados (2 tandas) con Hunyuan3D 2.1; música sintetizada para cada zona, jefe y final; ambiente | Lista |
| 7. Pulido y versión final | Cámara que aclara el decorado, 3 dificultades, capítulos, créditos, memoria gráfica, recuperación de la GPU | Lista: versión 1.0 |
| 8. Desafíos | Cristales del Cielo: el primer prototipo convertido en 5 niveles contrarreloj con medallas (3 originales + planeador + garfio) | Lista: versión 1.1 |
| 9. Más juego | Dificultad Automático, objetos que se rompen con reliquias, controles táctiles y mando de PS4, personalización, 3 ranuras de guardado, capítulo extra «El Eco Olvidado» | Lista: versiones 1.3 a 1.5 |
| 10. Vuelos con dificultad | Planeador con aguante (barra que se agota; las corrientes lo recargan), ráfagas de viento avisadas, avispas de cristal que vuelan entre islas; el modo Automático recorre los niveles de verdad (anda, salta, planea, rebota, usa corrientes, garfio e impulso) | Lista: versión 1.6 |
| 11. Logros y rendimiento | 16 logros con aviso y pantalla propia en el menú; opción de calidad gráfica (Automática / Alta / Media / Baja) que en Automática baja sola si el juego va lento; la barra del planeador ahora se ve en vuelo | Lista: versión 1.7 |
| 12. Fuego y rocas que caen | Plataformas rojas que se desploman al pisarlas, chorros de fuego que salen de la lava en los saltos, mazas-péndulo que hay que esquivar; nuevo capítulo extra 2 «Las Forjas de Ignis» (música propia, lava, brasas) y desafíos 6 y 7; resplandor (bloom) en calidad Alta y estallidos de colores; 2 logros nuevos | Lista: versión 1.8 |
| 13. Partidas con nombre | Título con solo «Continuar» y «Nueva partida»; la partida nueva pide nombre, dificultad y personaje; cada partida guarda sus logros (vitrina de trofeos, medallas e insignias animados), sus récords de desafíos y su dificultad; si se pierden dos rondas de vidas sin avanzar se ofrece bajar la dificultad; créditos finales con los personajes bailando al terminar la historia y los dos capítulos extra (producción ejecutiva: Jorge Chaparro, CEO de Think Animation Studio) | Lista: versión 1.9 |
| 14. Niveles el doble de largos | Cada zona de la historia y los capítulos extra 1 y 2 tienen un «Sendero» de unos 150 m (saltos, rocas que caen, plataformas móviles, mazas, fuego, planeo, corrientes y garfio según el capítulo); una barrera de luz cierra el camino hasta tocar el Sello del final | Lista: versión 2.0 |
| 15. Las Profundidades de Mareth | Capítulo extra 3 submarino: nadar en 3D, aire que se acaba (burbujas, cúpulas, superficie), pantalla roja con latidos cada vez más lentos, borrosa y oscura al ahogarse; sin corazones el nivel empieza de nuevo; medusas, corrientes, algas, peces, ciudad hundida, Nerea la buzo y un submarino que rompe muros de coral | Lista: versión 2.0 |
| 16. Gráficos mejorados | Submarino nuevo (casco amarillo con remaches, cúpula de cristal con Lía pilotando, ojos de buey, periscopio, hélice carenada y estela de burbujas); dirigible rehecho (globo de gajos, góndola-barco con cabina iluminada, tres motores, banderines) que ahora gira y zarpa con la proa por delante; islas con texturas de tierra y roca, rocas colgantes irregulares, hierba que se mece con el viento, flores y piedras; luz de contorno en los personajes | Lista: versión 2.1 |
| 17. Héroes, piezas y Arena | Cambio de héroe en cualquier momento (H o pausa): siete héroes con ventajas propias (Nerea, Brasa e Ilan se desbloquean con piezas); 16 Piezas especiales (una escondida en cada zona dentro de una vasija con destellos dorados y una por misión) que dan corazones extra; siete misiones; Arena multijugador con Duelo, Cooperativo por oleadas con jefes y Carrera de piezas, contra la CPU, a dos jugadores en la misma pantalla u online en tiempo real con un código de sala | Lista: versión 2.2 |
| 18. Poderes, chat y salas grandes | Siete poderes especiales con energía (ráfaga de fuego, furia de golpes, ráfaga de hielo que congela, levitación, telequinesis que levanta y estrella al rival, rayo de los ojos y lluvia de miles de flechas) que se desbloquean con puntos de poder (piezas + victorias en la Arena) y se usan con 1, 2 y 3 en la historia y en la Arena; chat en vivo en la Arena online con frases rápidas y filtro de palabrotas; salas para muchos jugadores (aparición en anillos, objetivo y oleadas que crecen con el número de jugadores, marcador de los mejores); aura de color y título en la personalización | Lista: versión 2.3 |
| 19. Cámara de cada jugador | Online y contra la CPU la cámara sigue siempre a tu personaje y ves a los demás moverse en el mundo; con dos jugadores en un mismo dispositivo, pantalla dividida (lado a lado en horizontal, arriba y abajo en vertical), cada uno con su cámara | Lista: versión 2.4 |

## Cómo jugar en tu computadora

Los módulos de JavaScript necesitan un servidor local (no se abren con doble clic):

```bash
python -m http.server 8000
# luego abre http://localhost:8000
```

## Controles

| Acción | Teclado | Mando PS4 (Xbox) | Teléfono (horizontal) |
| --- | --- | --- | --- |
| Moverse | W A S D (Shift para caminar) | Stick izquierdo o cruceta | Palanca izquierda |
| Cámara | Arrastrar con el ratón, rueda para acercar | Stick derecho | Deslizar en la mitad derecha |
| Saltar / doble salto / planear | Espacio (mantener para planear) | ✕ (A) | A |
| Golpear (combo de 3) y romper vasijas | Clic izquierdo o J | □ (X) | B |
| Esquivar / impulso aéreo | Clic derecho o K | ○ (B) | C |
| Hablar, leer, usar | E | △ (Y) | X |
| Escudo (bloquea y refleja) | Mantener V | Mantener L1 (LB) | Mantener Y |
| Garfio (al anillo marcado) | G o clic central | R1 / R2 (RB / RT) | Z (si hay un anillo a la vista) |
| Pulso de luz | Z | L2 (LT) | Z |
| Pausa, ajustes y guardado | Esc o P | OPTIONS (Start) | ❚❚ |
| Menús | Ratón | Cruceta para elegir, ✕ aceptar, ○ volver | Tocar |

**Mando de PS4 en la notebook:** conéctalo por cable USB o por Bluetooth (en Windows: Configuración → Bluetooth → Agregar dispositivo, manteniendo PS + SHARE hasta que la luz parpadee). Abre el juego en Chrome o Edge y pulsa cualquier botón del mando: el juego lo detecta solo, muestra los símbolos ✕ ○ □ △ y vibra al recibir golpes.

**Dificultad:** Cuento (fácil), Aventura (normal), Leyenda (difícil) y **Automático**: Lía recorre la historia y los desafíos sola (camina, planea hasta donde haga falta, resuelve los mecanismos y vence a los jefes); los desafíos jugados así no cuentan como récord.

**Partidas:** tres ranuras en el título (cada una con su progreso y su propio aspecto de personaje), para que jueguen varias personas en el mismo dispositivo.

**Capítulo extra — El Eco Olvidado:** se abre al terminar la historia (botón al final o en *Capítulos*). Una isla nueva con el eco del abuelo Ilan, puentes de luz, corrientes de aire, el garfio y un jefe secreto: el Eco Sombrío, una copia oscura de tu personaje. Guarda la séptima reliquia.

**Personaje:** en el título o en la pausa, botón *Personaje*: estilo (exploradora, encapuchada, maga o caballera), color de ropa, pelo y piel, y color del planeador, con vista previa en 3D que se puede girar.

**Reliquias de Aethra:** cada zona esconde una geoda violeta que se rompe con el bastón; dentro hay una reliquia. Son 7 (una en el capítulo extra); cada dos reliquias, un corazón más. Las vasijas pueden tener corazones, y en los desafíos un reloj de arena que resta 3 segundos.

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
js/zones/desafios.js    niveles contrarreloj de Cristales del Cielo
js/zones/eco_olvidado.js capítulo extra con el jefe secreto
prototipos/             prototipos anteriores (Cristales del Cielo)
```

Para añadir una zona nueva basta con crear un archivo en `js/zones/` con sus datos y registrarlo en `js/main.js`.

## Créditos

Personajes y animaciones: [KayKit Adventurers Character Pack](https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0) de Kay Lousberg ([kaylousberg.com](https://www.kaylousberg.com)), licencia CC0.

Modelos de jefes, enemigos y decorados: generados para este juego con [Hunyuan3D 2.1](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1) (Tencent) a partir de imágenes de SDXL; ver `tools/gen3d/`.
