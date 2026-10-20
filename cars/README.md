# Neural Racing · Laboratorio 01

Un pequeño proyecto para entender cómo una red neuronal convierte lo que ve un coche en decisiones. HTML, CSS y JavaScript, sin librerías, frameworks, dependencias externas ni compilación.

## Abrir el proyecto

Necesitas Node.js 20 o posterior. Desde esta carpeta:

```text
node server.js
```

Abre **http://127.0.0.1:5173** en un navegador moderno. También puedes usar `npm.cmd start` en PowerShell (`npm start` en otros terminales). No hace falta instalar paquetes. Para detener el servidor, pulsa Ctrl+C en su terminal.

El servidor solo escucha en este ordenador. Si el puerto está ocupado, puedes cambiarlo en PowerShell con `$env:PORT = "5174"` antes de arrancar. Para servirlo con otro servidor estático, usa la carpeta raíz del proyecto. Abrir `index.html` con doble clic no basta, porque los módulos de JavaScript necesitan HTTP.

El selector **ES / EN** cambia el idioma sin recargar. El catálogo compartido está en `../i18n/`; conserva esa carpeta si copias el taller. Para usar un servidor estático distinto, sirve el curso completo desde la raíz del repositorio después de `npm run build`.

## Qué incluye

- Cinco circuitos iniciales y seis coches independientes, cada uno con su propia red.
- Cinco rayos que parten del centro del coche hacia sus **10, 11, 12, 1 y 2**: −60°, −30°, 0°, +30° y +60° respecto al morro.
- Redes de distintos tamaños escritas desde cero, con **entradas, capas ocultas, salidas y activación editables por tipo de coche**.
- Cuatro botones controlados por la red: acelerar, frenar, izquierda y derecha.
- Un inspector que muestra lecturas, activaciones, pesos y botones del coche seleccionado.
- Pausa, avance de 1/60 de segundo, tres ritmos de simulación, reinicio y nuevas redes aleatorias.
- Editor visual con puntos, curvas redondeadas, ancho de pista, salida, sentido y deshacer/rehacer.
- Mapas guardados en el navegador, importación/exportación JSON y separación entre entrenamiento y prueba.
- Entrenamiento genético por tipo, con evaluación, selección y mutación visibles paso a paso.
- Historial de puntuaciones, parentesco de las redes, desglose de recompensas y guardado de campeones.

**Ahora las redes aprenden por selección y mutación.** Mientras un coche conduce, sus pesos permanecen fijos: eso es inferencia. Entre generaciones, el entrenador conserva las redes con mejores resultados y crea descendientes con pequeños cambios. «Nuevas redes», en la carrera, sigue siendo una forma de generar pesos al azar. Al principio es normal que muchos coches choquen o no se muevan.

## Primera actividad: observar una generación

1. Deja los cuatro mapas de entrenamiento y uno reservado, y asigna los tipos que quieras comparar a los coches. Solo se entrenan los tipos asignados; un tipo usado por dos coches recibe una sola población.
2. En **Aprender por selección y mutación**, empieza con 24 redes por tipo, 20 generaciones y semilla 42. Cada tipo recibe el mismo número de redes, mapas, salidas y generaciones.
3. Pulsa **1. Evaluar población**. La vista rápida permite ver muchas generaciones; la lenta permite observar los coches. Puedes pausar a mitad de un intento. Cambiar el ritmo o pausar no cambia el tamaño del paso de física ni los resultados.
4. Al terminar, compara la tabla y pulsa una red para abrir su puntuación por mapa. Por ejemplo, quedarse quieta obtiene −15, no una recompensa por seguir viva. Cambia **Inspeccionar un tipo** para ver las otras poblaciones.
5. Pulsa **2. Seleccionar mejores**. Aparecen las élites y los posibles padres. La gráfica añade la mejor puntuación y la media de esa población.
6. Pulsa **3. Crear descendientes**. Las filas muestran el padre, el origen y el número de cambios. Selecciona una **Copia mutada** para ver un cambio real: `peso anterior + cambio = peso nuevo`. Una **Élite intacta** conserva todos sus números.
7. Repite los pasos o pulsa **Continuar automáticamente**. El modo automático hace una pequeña pausa entre fases; **Pausar** permite inspeccionar el estado.
8. Tras una selección, usa **Guardar campeones** y **Probar en mapa reservado**. En la carrera, pulsa **Iniciar**. Cada coche usa una copia del campeón de su tipo; el inspector identifica su generación y puntuación. Los pesos permanecen fijos durante esta prueba.

**Reiniciar desde cero** permite cambiar los parámetros y empezar otra población. Un experimento en marcha mantiene una copia de sus mapas, tipos y parámetros: editar las bibliotecas no cambia lo que está evaluando. Los campeones ya aplicados a la carrera y los guardados se conservan al reiniciar el entrenador.

El guardado es manual y local a este navegador, bajo `neural-racing.champions.v1`. Incluye pesos, sesgos, topologías, configuración, mapas vistos y resultados. **Recuperar guardados** los aplica a la carrera y permite probarlos de nuevo. No reanuda la población ni recupera su gráfica completa. Si has cambiado las entradas, salidas, capas o activación de un tipo, debes volver a su configuración original o entrenar otra vez. Renombrar el tipo no cambia la compatibilidad.

## Cómo funciona este algoritmo genético

El **individuo** es una red neuronal. Su **genoma** es el conjunto de pesos y sesgos. La arquitectura se fija en el editor: la evolución cambia los números, no las capas. El entorno calcula una puntuación; no hace falta un conjunto de ejemplos con el botón correcto ni un conductor que siga un camino.

Cada generación repite tres pasos:

```js
evaluarTodasLasRedesEnTodosLosMapas();
seleccionarLosMejoresDeCadaTipo();
crearLaSiguienteGeneracion();
```

Para una población de 24 redes, la siguiente generación contiene:

- **2 élites intactas**: se copian exactamente las dos mejores redes.
- **20 copias mutadas**: se elige un padre al azar entre las 6 mejores redes del mismo tipo. Se copia su genoma y cada peso o sesgo tiene, por defecto, un 12 % de probabilidad de recibir un cambio aleatorio de hasta ±0,20. Se fuerza al menos un cambio por hijo.
- **2 redes nuevas al azar**: ayudan a explorar otras soluciones.

Para otros tamaños, las élites y los recién llegados son el 10 % redondeado hacia abajo, con mínimo 1; los posibles padres son el 25 % redondeado hacia arriba, con mínimo 2. Esta versión usa descendencia de un solo padre con mutación. No cruza redes con arquitecturas diferentes.

El padre nunca se modifica. Los números de sus hijos están en matrices independientes. Las élites permiten conservar la mejor puntuación en estas evaluaciones deterministas, aunque la media de la población puede bajar y la mejor puntuación puede estancarse. Subir la probabilidad o el tamaño de mutación no garantiza mejorar.

### La evaluación y su puntuación

Cada red conduce desde **dos posiciones de salida en cada mapa**, siempre las mismas para todos los individuos y tipos. Se usa la misma física que en la carrera, con pasos de 1/60 s y sin choques entre coches. Un intento termina al completar una vuelta, tocar el borde, pasar 3 segundos sin nuevo avance o alcanzar 22 segundos simulados. La salida cuenta como el comienzo de la vuelta de ese intento.

Se colocan **32 puntos de control** alrededor del circuito, a partir de la salida. Hay que atravesarlos en orden y hacia delante. Entre dos puntos se recompensa el avance parcial, conservando solo el máximo alcanzado: ir y volver no suma repetidamente. El evaluador usa la geometría de la pista; la red solo recibe las entradas elegidas en el editor, nunca esos puntos de control ni una ruta objetivo.

```text
Por intento:
  avance = 1000 × fracción de la vuelta recorrida
  vuelta = 200 si termina, 0 si no
  rapidez = 100 × (1 − tiempo / 22) si termina, 0 si no
  choque = −25 si toca el borde
  parada = −15 si pasa 3 segundos sin nuevo avance
  total = avance + vuelta + rapidez + choque + parada

Puntuación de la red:
  0,75 × media de todos los intentos + 0,25 × peor intento
```

La rapidez se limita a 0–100. Por ejemplo, acabar en 11 s vale `1000 + 200 + 50 = 1250`; recorrer media vuelta y chocar vale `500 − 25 = 475`. El peso del peor intento favorece comportamientos que funcionan en varios mapas. La tabla de cada red desglosa estos términos; **Vueltas** indica cuántos intentos completó de los 6 u 8 evaluados.

### Comparar sin confundir los resultados

Mantén los mapas, el presupuesto de evaluación y los parámetros genéticos; cambia una propiedad de la red cada vez. Usa varias semillas, porque una sola población puede tener suerte. La misma configuración completa, el mismo orden de tipos y la misma semilla repiten el experimento. Cada tipo usa su propio generador aleatorio, así que igualdad de presupuesto no significa igualdad de pesos iniciales entre tipos.

Una red sin una salida que acelere no aprenderá a conducir; una con información insuficiente puede no distinguir situaciones que requieren acciones diferentes. Los valores absolutos, la normalización, las activaciones y el modo de elegir acciones cambian la dificultad de la búsqueda. Si no mejora, revisa primero qué puede observar y hacer. El entrenador no añade entradas ni acciones para compensar esas decisiones.

Una buena puntuación de entrenamiento no demuestra generalización. Conserva el mapa reservado para el final. Si usas su resultado para elegir una topología, ajustar mutaciones o decidir qué campeón prefieres, ya lo estás usando como validación y debes reservar otro mapa nuevo para la prueba final. Puedes preparar un mapa adicional de validación como **Libre**.

## Crear y guardar circuitos

1. Pulsa **+ Nuevo mapa**. Con **Trazar**, haz clic para colocar los puntos del recorrido en orden. El circuito se cierra automáticamente a partir del tercero. Empieza con una figura grande, por ejemplo un rectángulo. Usa entre 3 y 24 puntos.
2. Con **Mover**, arrastra los puntos. Con **Quitar punto**, elimina uno. Deshacer y Rehacer permiten corregir los cambios. En Trazar, un clic próximo a un segmento inserta un punto entre sus extremos.
3. Ajusta el **ancho de pista**. Las esquinas se redondean automáticamente. Si la carretera se cruza, sale del área útil o forma curvas demasiado estrechas, el editor explica cómo corregirla y desactiva Guardar.
4. Con **Salida**, elige un punto de referencia para colocar la línea de salida. Los coches se sitúan detrás de ella. Puedes **invertir el sentido de marcha**; las flechas muestran la dirección resultante.
5. Ponle nombre y elige su uso: **Libre**, **Entrenamiento** o **Prueba reservada**. Pulsa **Guardar y usar mapa**. Aparecerá en Circuito actual y podrás conducir en él inmediatamente con las redes actuales.

El ajuste preciso permite añadir y mover puntos mediante coordenadas. Con un punto seleccionado y el lienzo enfocado, las flechas del teclado lo mueven; Supr lo elimina; Ctrl+Z deshace y Ctrl+Mayús+Z rehace. El editor también admite arrastrar con el dedo.

**Editar circuito** modifica tus mapas guardados. Las cinco plantillas se abren como copias para conservar los ejemplos originales. Cerrar el editor descarta los cambios que todavía no hayas guardado ni exportado.

El guardado usa `localStorage`, bajo la clave `neural-racing.maps.v1`. Persiste al recargar o cerrar el navegador, pero pertenece a ese navegador y a esa dirección web concreta. No guarda los pesos de las redes. Para compartir con compañeros o llevar una copia a otro ordenador, usa **Exportar**: descarga un archivo `.json`. **Importar** abre ese archivo en el editor para revisarlo y guardarlo con una identidad nueva. Cambiar solo el nombre de un circuito no lo convierte en un entorno distinto.

## Preparar entrenamiento y prueba

Abre **Organizar entrenamiento y prueba**. Cada circuito tiene una sola asignación:

- **Entrenamiento**: elige 3 o 4 trazados distintos; no se permiten más de 4.
- **Prueba reservada**: un circuito separado. Al reservar otro, el anterior pasa a Libre.
- **Libre**: puedes editarlo o explorar sus resultados sin añadirlo a ninguno de los grupos.

Inicialmente hay cuatro mapas asignados a entrenamiento y un quinto reservado. El editor impide poner el mismo mapa en ambos grupos y detecta copias exactas de sus puntos y ancho, incluso renombradas, con otra salida, con otro orden de inicio de los puntos o con el sentido invertido. No pretende detectar equivalencias geométricas entre trazados redibujados manualmente.

`MapStore.getExperiment()` devuelve `{ trainingMaps, testMap }` por separado. El entrenador recibe únicamente `trainingMaps`; no recibe el mapa reservado. Los campeones conservan las geometrías usadas al entrenar. **Probar en mapa reservado** rechaza un trazado ya visto aunque lo hayas renombrado, cambiado de uso o invertido. La prueba conduce con pesos fijos y no actualiza la selección.

Cambiar **Circuito actual** reinicia las posiciones, sensores, velocidad y tiempo, pero conserva los mismos objetos de red y sus pesos. Esto permite comparar la respuesta de los mismos cerebros en entornos distintos.

## Diseñar y comparar topologías

Pulsa **Editar topologías**, o **Editar tipo** en el inspector del coche seleccionado. Puedes crear, duplicar, renombrar y eliminar tipos en el borrador. Elige:

1. **Entradas**: cualquier combinación de velocidad actual y los sensores de las 10, 11, 12, 1 y 2. Debe quedar al menos una entrada. Los cinco sensores físicos siguen existiendo aunque la red use solo algunos.
2. **Escala de cada entrada**: absoluta o mapeada entre 0 y 1. Puedes mezclar escalas y usar los botones para cambiarlas todas. La velocidad absoluta va de 0 a 165 u/s; las distancias de 0 a 220 u. Normalizar divide por el máximo correspondiente. Un sensor sin borde dentro del alcance entrega 220 u, o 1 al normalizar.
3. **Capas ocultas**: de 0 a 4, con entre 1 y 16 neuronas por capa. Sin capas ocultas, las entradas conectan directamente con las salidas.
4. **Activación**: sigmoide o ReLU, aplicada a todas las capas ocultas y a la salida. ReLU puede producir números mayores que 1; no se recortan ni se convierten en probabilidades.
5. **Salidas**: cualquier selección de las seis acciones de la tabla siguiente. Debe quedar al menos una. El número junto a cada casilla indica el orden en el vector: las nuevas selecciones se añaden al final.
6. **Interpretación**: activar todas las salidas mayores que 0,5, o solo la salida con el mayor valor positivo. En este último modo, todo ceros deja los botones libres y los empates se resuelven a favor de la primera salida.

| Salida elegida | Botones que pulsa |
| --- | --- |
| Avanzar | Acelerar |
| Avanzar y girar a la derecha | Acelerar + derecha |
| Avanzar y girar a la izquierda | Acelerar + izquierda |
| Girar a la derecha | Derecha |
| Girar a la izquierda | Izquierda |
| Frenar | Freno |

Asigna un tipo a cada coche y pulsa **Guardar y aplicar**. Se reinicia la carrera y se reconstruyen los cerebros cuya configuración cambió; las otras redes conservan sus pesos. Renombrar un tipo tampoco cambia sus pesos. Dos coches del mismo tipo comparten la arquitectura, pero sus redes y pesos son independientes. **Cancelar** o Escape descartan el borrador completo.

Los tipos y las asignaciones se guardan en este navegador (`neural-racing.topologies.v1`). La biblioteca de mapas y los campeones se mantienen aparte. Al recargar, la carrera empieza con pesos aleatorios hasta que pulses **Recuperar guardados**. **Reiniciar** conserva las redes y **Nuevas redes** cambia sus pesos sin alterar los tipos ni borrar los campeones guardados.

Hay tres ejemplos iniciales: **Clásico** (5 → 6 → 4, sigmoide), **Acciones combinadas** (6 → 8 → 6 → 4, sigmoide) y **Absolutos + ReLU** (6 → 6 → 4). Son ejemplos de representación, no redes entrenadas ni una clasificación de cuál es mejor.

El inspector muestra la medida real y el valor que recibe cada neurona, las activaciones de la red, las acciones elegidas y los cuatro botones físicos. Los sensores excluidos aparecen atenuados. El color de un nodo se satura en 1 para dibujarlo, pero su valor matemático sigue intacto; los números grandes se abrevian solo en el diagrama, y la tabla de salidas muestra su valor con dos decimales.

Para un ejercicio controlado, cambiamos una cosa cada vez: por ejemplo, la escala de una entrada, manteniendo la arquitectura. Cada coche usa una semilla propia: cambiar solo la escala, la activación o el modo de salida reconstruye los mismos números de pesos y sesgos iniciales. No basta con comparar dos coches distintos para atribuir su comportamiento a una capa: también tienen pesos y posiciones de salida distintos.

## Recorrer el código en grupo

Este es un buen orden de lectura:

| Archivo | Responsabilidad |
| --- | --- |
| `src/sensor.js` | Lanzar cinco rayos y medir la distancia al borde más cercano. |
| `src/topology.js` | Definir entradas y acciones; preparar valores absolutos o normalizados y elegir las salidas activas. |
| `src/topology-store.js` | Validar y guardar tipos y asignaciones de los seis coches. |
| `src/topology-editor.js` | Editar un borrador, ver la arquitectura y asignar tipos a coches. |
| `src/neural-network.js` | Crear pesos y sesgos, sumar las entradas ponderadas y aplicar sigmoide o ReLU. |
| `src/controls.js` | Traducir las acciones de la red a los cuatro botones físicos. |
| `src/car-settings.js` | Dimensiones y velocidad máxima compartidas por física y normalización. |
| `src/car.js` | Posición, velocidad, giro y colisiones de un coche. |
| `src/simulation.js` | Crear seis coches y ejecutar pasos de duración fija. |
| `src/genetics.js` | Copiar redes, representar sus pesos como datos y mutar hijos. |
| `src/training-score.js` | Contar avance y puntos de control; desglosar la puntuación. |
| `src/training-engine.js` | Evaluar poblaciones, seleccionar y crear generaciones. Funciona sin interfaz. |
| `src/training-worker.js` | Ejecutar el entrenador aparte, con pausa y dos ritmos de visualización. |
| `src/training-ui.js` | Conectar los tres pasos con la vista de coches, tablas y botones. |
| `src/training-chart.js` | Dibujar las curvas de mejor puntuación y media. |
| `src/trained-models.js` | Validar y guardar campeones; comprobar compatibilidad y mapas no vistos. |
| `src/track.js` | Definir el circuito mediante segmentos. |
| `src/maps.js` | Los cinco ejemplos y el formato de un mapa como datos. |
| `src/map-store.js` | Guardar la biblioteca, separar los conjuntos y validar importaciones. |
| `src/map-editor.js` | Herramientas de dibujo, arrastre, coordenadas y deshacer/rehacer. |
| `src/map-ui.js` | Selector de mapas, biblioteca y conexión del editor con la simulación. |
| `src/track-drawing.js` | Dibujar los mismos bordes y la misma salida en el editor y en la carrera. |
| `src/geometry.js` | Intersecciones y otras funciones matemáticas pequeñas. |
| `src/renderer.js` | Dibujar el circuito, coches, rayos y red en Canvas. |
| `src/app.js` | Conectar los botones de la página y el bucle de animación. |

El núcleo (`sensor`, `neural-network`, `controls`, `car`, `track`, `simulation`) funciona sin acceder al navegador. El dibujo y la página están separados para poder añadir entrenamiento más adelante sin mezclarlo con la interfaz.

### 1. De una distancia a una entrada

Cada rayo tiene un alcance de 220 unidades. Se queda con la primera intersección con un borde:

```js
entrada = modo === "raw"
  ? distanciaAlBorde
  : distanciaAlBorde / alcanceDelSensor;
```

Ahora usamos **distancia**, por lo que `0` significa borde en el centro del coche y `1` normalizado significa alcance completo (220 unidades). `0.5` significa que el borde está a mitad de distancia. La versión inicial usaba proximidad invertida (`1 - distancia / alcance`); el editor usa distancia en ambas escalas para que cambiar la escala no invierta el significado. Las direcciones giran con el coche, no con la pantalla.

### 2. De las entradas a las salidas

Una neurona hace lo siguiente:

```js
let suma = sesgo;
for (let i = 0; i < entradas.length; i++) {
  suma += entradas[i] * pesos[i];
}
const salida = activacion === "relu"
  ? Math.max(0, suma)
  : 1 / (1 + Math.exp(-suma));
```

Los **pesos** regulan la influencia de las entradas. El **sesgo** desplaza la suma. La **sigmoide** convierte esa suma en un número entre 0 y 1. **ReLU** devuelve 0 para sumas negativas y deja pasar las positivas, sin límite superior. Estos números son activaciones, no probabilidades calibradas de conducir bien. Las activaciones de cada capa pasan a ser las entradas de la siguiente; los tamaños dependen del tipo elegido.

En el dibujo de la red, las líneas verdes continuas son pesos positivos y las naranjas discontinuas son negativos. Su intensidad y grosor indican la magnitud del peso; el relleno de cada neurona indica su activación. Los sesgos se pueden leer en `brain.layers`, aunque no se dibujan como nodos.

### 3. De una salida a un botón

El orden y las acciones están en `car.topology.outputs`. Con el modo de umbral, cada salida **mayor que 0.5** activa su acción; con el modo ganador solo actúa el mayor valor positivo. Una acción combinada pulsa dos botones. Los cuatro botones del inspector son indicadores; los pulsa la red automáticamente. Los números del panel se redondean para facilitar la lectura; la selección se evalúa con la precisión completa.

- Acelerar aumenta la velocidad hasta un máximo.
- Frenar reduce la velocidad hasta cero y tiene prioridad sobre acelerar.
- Sin pedales, el rozamiento reduce la velocidad.
- Izquierda y derecha a la vez se cancelan. Un coche parado no gira.
- No hay marcha atrás. Los valores de velocidad y distancia usan unidades del circuito, no km/h ni metros reales.

Los coches solo detectan y chocan con los bordes. No interactúan entre sí en esta primera versión. Una colisión de la carrocería detiene el coche y desactiva sus botones hasta reiniciar. El panel sigue mostrando las salidas de la red para poder inspeccionarlas.

## Un primer ejercicio de 10 minutos

1. Antes de iniciar, seleccionad un coche e identificad el morro y sus cinco rayos.
2. Relacionad un sensor próximo al borde con su entrada numérica.
3. Leed las salidas y predecid qué botones se van a pulsar según el modo de interpretación.
4. Iniciad, pausad y comprobad lo que ha ocurrido. Podéis avanzar un paso cada vez.
5. Reiniciad: con los mismos pesos y las mismas posiciones, el resultado se repite.
6. Pulsad «Nuevas redes» y comparad. ¿Cambiar al azar ha mejorado realmente la conducción?
7. Editad el tipo del coche: cambiad una entrada de normalizada a absoluta y explicad cómo varían las activaciones.
8. Comparad sigmoide y ReLU; después probad a quitar una capa o usar acciones combinadas.

Para seguir el aprendizaje en el código, empieza por `scoreEpisode`, después por `mutateNetwork` y finalmente por `GeneticTrainer.tick`, `select` y `reproduce`. Las tres fases son explícitas; la interfaz solo las ejecuta y presenta sus resultados.

## Comprobar la lógica

```text
node --test
```

Las pruebas usan únicamente las herramientas incluidas en Node.js. Comprueban cálculo neuronal con sigmoide y ReLU, selección y escala de entradas, acciones combinadas, modos de salida, redes sin capas ocultas y con varias capas, física, colisiones, independencia de redes y repetición al reiniciar. También verifican geometría de mapas, separación de entrenamiento/prueba, persistencia de mapas y topologías, importación/exportación de mapas, errores de guardado y conservación de las redes que no cambian.

Las pruebas del entrenador comprueban mutaciones sin modificar padres, élites exactas, progreso ordenado sin recompensar vueltas atrás, puntuación, igualdad de salidas, finalización de redes inmóviles, separación de fases y tipos, repetición por semilla, exclusión del mapa de prueba, aplicación de campeones y guardado resistente a datos corruptos o falta de espacio.

La simulación avanza a 60 pasos por segundo. El navegador decide cuántas imágenes puede dibujar; el tamaño del paso de física permanece fijo. Si ocultas la pestaña, la simulación se pausa para no saltarse una parte del experimento.
