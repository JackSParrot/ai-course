[← Volver al README](../README.md)

# Fe de erratas de las charlas

Las charlas se explican en directo, con simplificaciones y algún desliz. Esta página recoge las **correcciones** (algo que se dijo y no es correcto) y las **aclaraciones** (algo correcto pero incompleto o que puede confundir). Cada entrada enlaza al minuto exacto del vídeo.

Si encuentras otro error, abre un *issue* en el repositorio.

**Leyenda:** 🔴 corrección importante · 🟡 corrección menor · 🔵 aclaración

## IA 01 · Introducción a redes neuronales

[Ver el vídeo](https://www.youtube.com/watch?v=lE2Z-ayxwzU)

### 🔴 La red de dígitos no es convolucional
[31:31](https://www.youtube.com/watch?v=lE2Z-ayxwzU&t=1891s) y [49:30](https://www.youtube.com/watch?v=lE2Z-ayxwzU&t=2970s)

**Se dijo:** la red de 256 entradas y 10 salidas «se llama una red neuronal convolucional», y procesar la imagen con menos neuronas que píxeles «por eso es una red convolucional».

**Lo correcto:** todas las redes del capítulo 02 son **densas** (totalmente conectadas). Cada neurona recibe **todos** los píxeles, cada uno con su propio peso. Pasar de 256 entradas a 32 neuronas ocultas es una capa densa más pequeña, no una convolución.

Una red **convolucional** usa un **filtro pequeño** (por ejemplo, de 3 × 3) que recorre la imagen. Aplica los mismos pesos en cada posición y produce un **mapa** que indica dónde aparece un patrón. Como el filtro es el mismo en toda la imagen, puede detectar un trazo esté donde esté. Eso es justo lo que echábamos en falta cuando el 9 aparecía desplazado. Puedes ver filtros convolucionales reales en los capítulos 03 (Autoencoder) y 04 (Superresolución).

### 🔴 El sobreajuste sí depende del tamaño de la red
[54:02](https://www.youtube.com/watch?v=lE2Z-ayxwzU&t=3242s)

**Se dijo:** el overfitting «no es exactamente con el número de neuronas, sino con el entrenamiento». La solución sería dividir el dataset.

**Lo correcto:** la intuición de la pregunta era acertada. El **sobreajuste** (*overfitting*) aparece cuando la red memoriza los ejemplos de entrenamiento en lugar de aprender la regla general. Depende de varias cosas a la vez:

- **Capacidad de la red frente a los datos:** muchos parámetros para pocos ejemplos facilitan memorizar.
- **Variedad de los datos:** si todos los ceros se parecen, solo reconocerá ceros parecidos.
- **Tiempo de entrenamiento:** entrenar demasiado tiempo sobre los mismos ejemplos.

El conjunto de **validación** no evita el sobreajuste: lo **detecta**. Si el error de entrenamiento baja mientras el de validación sube, la red está memorizando. Para reducirlo se usan más datos y más variados, una red más pequeña o parar el entrenamiento antes.

### 🟡 El sesgo no es «la importancia de la neurona»
[16:30](https://www.youtube.com/watch?v=lE2Z-ayxwzU&t=990s), [18:01](https://www.youtube.com/watch?v=lE2Z-ayxwzU&t=1081s) y [49:30](https://www.youtube.com/watch?v=lE2Z-ayxwzU&t=2970s)

**Se dijo:** el sesgo es «cómo de importante sería esta célula en la toma de decisiones».

**Lo correcto:** el sesgo funciona como un **umbral**: indica lo fácil o difícil que es que la neurona se active. Un sesgo alto hace que se active con poca señal; uno muy negativo exige mucha. En el capítulo 01 se ve muy bien: mover el sesgo **desplaza** la recta sin girarla. La importancia de cada entrada la dan sus **pesos**.

### 🟡 GPT significa *Generative* Pre-trained Transformer
[13:00](https://www.youtube.com/watch?v=lE2Z-ayxwzU&t=780s)

**Se dijo:** «GPT es el general pre-trained transformer».

**Lo correcto:** **G**enerative **P**re-trained **T**ransformer. *Generativo* porque produce contenido nuevo, token a token. *Preentrenado* porque primero aprende de enormes cantidades de texto. *Transformer* es el tipo de arquitectura. Lo veremos en la próxima sesión.

### 🟡 Cifras del conjunto de dígitos
[33:00](https://www.youtube.com/watch?v=lE2Z-ayxwzU&t=1980s) y [41:02](https://www.youtube.com/watch?v=lE2Z-ayxwzU&t=2462s)

**Se dijo:** que se entrena con 2.500 imágenes, después con 2.000, y que se valida con «las 1.000 que no ha visto». También que cada píxel va «de cero a 256».

**Lo correcto:** de las 3.000 imágenes, **2.000 son de entrenamiento, 500 de validación y 500 de prueba final**. Hay 300 por dígito, repartidas de forma equilibrada. Cada píxel se guarda como un valor de **0 a 255** y la red lo recibe normalizado. Detalles en la [guía de desarrollo](DEVELOPMENT.md#datos-mnist).

### 🟡 La neurona no es una «regresión lineal»
[20:01](https://www.youtube.com/watch?v=lE2Z-ayxwzU&t=1201s)

**Se dijo:** peso₁ · entrada₁ + peso₂ · entrada₂ + sesgo es «una función de regresión lineal».

**Lo correcto:** es una **combinación lineal**. Con la función de activación escalón, la neurona es un **clasificador lineal**: separa los datos con una recta. La regresión lineal es otra técnica, que ajusta una recta para *predecir un número*, no para separar categorías. La idea importante del vídeo es correcta: una neurona es una función matemática y su frontera es una recta.

### 🔵 Un poco de historia
[15:02](https://www.youtube.com/watch?v=lE2Z-ayxwzU&t=902s)

La fecha de 1956 corresponde a la conferencia de Dartmouth, donde se acuñó el término «inteligencia artificial». La neurona artificial es anterior: McCulloch y Pitts la propusieron en **1943**. El **perceptrón**, la neurona que aprende ajustando sus pesos, es de Frank Rosenblatt, en **1958**.

### 🔵 Hay muchas soluciones válidas
[22:30](https://www.youtube.com/watch?v=lE2Z-ayxwzU&t=1350s)

A la pregunta de por qué distintos valores dan el mismo resultado: cualquier recta que deje los puntos en el lado correcto resuelve la puerta lógica, así que hay infinitas combinaciones de pesos y sesgo válidas. En redes grandes pasa lo mismo: dos entrenamientos pueden llegar a pesos distintos que funcionan igual de bien.

### 🔵 Más capas no hacen que la red «piense de más»
[52:31](https://www.youtube.com/watch?v=lE2Z-ayxwzU&t=3151s)

Añadir capas sin necesidad tiene costes reales: más parámetros, entrenamiento más lento y más difícil, y más facilidad para sobreajustar si hay pocos datos. Decir que la red «sobrepiensa» es una metáfora. El problema concreto suele ser el sobreajuste o un entrenamiento que no converge bien.

### 🔵 Un modelo son los pesos *y* su descripción
[56:00](https://www.youtube.com/watch?v=lE2Z-ayxwzU&t=3360s)

Los pesos son la parte grande de un modelo descargado, pero no bastan por sí solos. También hace falta la **arquitectura** (capas, activaciones, tamaños) y las convenciones de entrada y salida. En los modelos de lenguaje, además, hace falta el **tokenizador**. El proyecto [`unity-cars`](../unity-cars/docs/COMO-FUNCIONA.md) lo muestra con dos archivos: `network.json` (descripción) y `weights.json` (parámetros).

## IA 02 · Imágenes, algoritmos genéticos y coches

[Ver el vídeo](https://www.youtube.com/watch?v=jS0QtadL5fo)

### 🔵 La convolución, un poco más despacio
[1:30](https://www.youtube.com/watch?v=jS0QtadL5fo&t=90s)

El vídeo lo resume como «coge un trocito de la imagen como si fuera un filtro, lo va aplicando y lo guarda en un mapa». Es correcto. Falta una idea clave: **el filtro usa los mismos pesos en todas las posiciones**. Una red convolucional necesita así muchos menos parámetros que una densa y reconoce un patrón aunque cambie de sitio. Recuerda también que la red de dígitos de IA 01 **no** era convolucional (ver arriba).

### 🟡 El código interno del autoencoder no es una imagen de 16 × 16
[2:30](https://www.youtube.com/watch?v=jS0QtadL5fo&t=150s) y [4:31](https://www.youtube.com/watch?v=jS0QtadL5fo&t=271s)

**Se dijo:** la imagen de 64 × 64 se guarda en algo que «puede ser considerado una imagen de 16 × 16».

**Lo correcto:** el código interno son **4 mapas de 16 × 16**, es decir, 1.024 activaciones frente a 4.096 píxeles. La reducción es de 4 veces, no de 16. Esos mapas no son una imagen reducida: son números que solo el decodificador sabe interpretar.

### 🔵 Qué se puede esperar de la superresolución
[7:30](https://www.youtube.com/watch?v=jS0QtadL5fo&t=450s) y [8:00](https://www.youtube.com/watch?v=jS0QtadL5fo&t=480s)

La red supera a la ampliación por bloques y a la bilineal **en imágenes parecidas a las de su entrenamiento**: formas simples en escala de grises. Con imágenes de otro tipo, por ejemplo en color o con texturas, puede inventar detalles extraños. Para usarla como herramienta en un juego, hay que entrenarla con imágenes de ese mismo juego y revisar el resultado. La red **estima** detalle, no lo recupera. Es la misma idea que cierra el vídeo sobre las «alucinaciones» de los modelos de lenguaje ([35:23](https://www.youtube.com/watch?v=jS0QtadL5fo&t=2123s)).

La imagen de entrada no se reduce «a lo bruto»: cada píxel pequeño es la **media** de un bloque de 2 × 2 píxeles de la original.

### 🟡 En el laberinto, los genes son movimientos, no pesos
[13:34](https://www.youtube.com/watch?v=jS0QtadL5fo&t=814s)

**Se dijo:** «tiene un 1 % por cada uno de estos pesos de que tenga una mutación».

**Lo correcto:** en el laberinto no hay red neuronal. El ADN son **100 movimientos** y cada uno tiene un 1 % de probabilidad de cambiar por otro. Los **pesos** pasan a ser el ADN en el capítulo de coches ([22:09](https://www.youtube.com/watch?v=jS0QtadL5fo&t=1329s)).

### 🔵 Comparar redes en una carrera
[28:05](https://www.youtube.com/watch?v=jS0QtadL5fo&t=1685s)–[33:54](https://www.youtube.com/watch?v=jS0QtadL5fo&t=2034s)

Los tipos de coche cambian **varias cosas a la vez**: entradas (con o sin velocidad), capas, activación (sigmoide o ReLU) y acciones de salida. Además, cada entrenamiento depende del azar. Una sola carrera no permite saber cuál de esos cambios explica la diferencia. Para atribuir una mejora a la activación, por ejemplo, hay que cambiar solo eso y repetir con varias semillas.

### 🔵 Un coche que no se mueve
[19:01](https://www.youtube.com/watch?v=jS0QtadL5fo&t=1141s) y [21:31](https://www.youtube.com/watch?v=jS0QtadL5fo&t=1291s)

Con pesos aleatorios, la red puede activar a la vez acelerar y frenar. En el simulador **el freno tiene prioridad** sobre el acelerador, por eso el coche se queda quieto. Izquierda y derecha a la vez se anulan.

### 🔵 «Conducción autónoma de Tesla en tu juego»
[31:00](https://www.youtube.com/watch?v=jS0QtadL5fo&t=1860s)

Es una broma. Los coches del curso usan 5 o 6 sensores y redes de unas decenas de parámetros, en un circuito 2D sin tráfico. La idea de fondo sí es real: una red pequeña puede controlar personajes o vehículos de un juego y ejecutarse en el propio dispositivo.

---

# Errata (English)

Corrections and clarifications for the talks. Each item links to the exact minute. 🔴 major · 🟡 minor · 🔵 clarification.

**IA 01 · Introduction to neural networks** ([video](https://www.youtube.com/watch?v=lE2Z-ayxwzU))

- 🔴 **The digits network is not convolutional** ([31:31](https://www.youtube.com/watch?v=lE2Z-ayxwzU&t=1891s), [49:30](https://www.youtube.com/watch?v=lE2Z-ayxwzU&t=2970s)). All chapter 02 networks are *dense*: every neuron sees every pixel. A convolutional layer slides a small shared filter across the image; see chapters 03 and 04.
- 🔴 **Overfitting does depend on network size** ([54:02](https://www.youtube.com/watch?v=lE2Z-ayxwzU&t=3242s)). It depends on capacity versus data, data variety and training time. A validation set *detects* overfitting; it does not prevent it.
- 🟡 **Bias is a threshold**, not "the neuron's importance" ([16:30](https://www.youtube.com/watch?v=lE2Z-ayxwzU&t=990s)). It shifts the decision line; the weights set how much each input matters.
- 🟡 **GPT = *Generative* Pre-trained Transformer** ([13:00](https://www.youtube.com/watch?v=lE2Z-ayxwzU&t=780s)).
- 🟡 **Digits data:** 2,000 training, 500 validation and 500 test images; pixels range from 0 to 255 ([33:00](https://www.youtube.com/watch?v=lE2Z-ayxwzU&t=1980s)).
- 🟡 **A neuron is a linear combination / linear classifier**, not "linear regression" ([20:01](https://www.youtube.com/watch?v=lE2Z-ayxwzU&t=1201s)).
- 🔵 History: artificial neuron 1943 (McCulloch & Pitts), Dartmouth 1956, perceptron 1958 (Rosenblatt).
- 🔵 Many weight settings solve the same problem; more layers cost parameters and training difficulty rather than making a network "overthink"; a model is weights *plus* its architecture description (and a tokenizer for LLMs).

**IA 02 · Images, genetic algorithms and cars** ([video](https://www.youtube.com/watch?v=jS0QtadL5fo))

- 🔵 Convolution: the key idea is that the **same filter weights are reused at every position**.
- 🟡 The autoencoder code is **4 maps of 16 × 16** (1,024 values versus 4,096 pixels, a 4× reduction), not a 16 × 16 image.
- 🔵 Super-resolution beats block and bilinear upscaling **on images similar to its training data**; it estimates detail, it does not recover it. Inputs are 2 × 2 averages, not crude downscaling.
- 🟡 In the maze the genes are **moves**, not weights; weights become the genome in the cars chapter.
- 🔵 Car types change several things at once (inputs, layers, activation, outputs), so one race cannot attribute an improvement to a single change.
- 🔵 A random network can press accelerate and brake together; braking wins, so the car stays still.
- 🔵 "Tesla self-driving in your game" is a joke: these are tiny networks with a handful of sensors on a 2D track.
