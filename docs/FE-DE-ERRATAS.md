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

## IA 03 · Tokens, embeddings y atención

[Ver el vídeo](https://www.youtube.com/watch?v=wP1iQaprQ8s)

### 🟡 Los modelos no se entrenan con 100 frases
[31:06](https://www.youtube.com/watch?v=wP1iQaprQ8s&t=1866s), [32:52](https://www.youtube.com/watch?v=wP1iQaprQ8s&t=1972s) y [33:15](https://www.youtube.com/watch?v=wP1iQaprQ8s&t=1995s)

**Se dijo:** que la red se entrena con «100 frases».

**Lo correcto:** son bastantes más. El tokenizador y la red del capítulo 08 se entrenan con **1.400 frases** (700 en español y 700 en inglés) y se validan con otras 240. El capítulo 09 añade **600 historias** de dos frases. El preentrenamiento del capítulo 10 usa **2.380 líneas**. Siguen siendo muy pocas al lado de un LLM real, que es lo importante.

### 🟡 El error de entrenamiento no es un porcentaje
[21:30](https://www.youtube.com/watch?v=wP1iQaprQ8s&t=1290s)

**Se dijo:** que el error de entrenamiento era «del 1,5 %» y el de validación «poco más del 2 %».

**Lo correcto:** la gráfica muestra el **error** (la *pérdida*) como un número, no como un porcentaje. Mide lo sorprendida que está la red con el token correcto: cuanto más bajo, mejor. Empieza cerca de **6** porque, sin entrenar, la red reparte la probabilidad casi por igual entre los 389 tokens de su vocabulario (ln 389 ≈ 6). El porcentaje que aparece al lado es el **acierto en validación**.

### 🟡 La activación de estas redes es tanh, no ReLU
[31:46](https://www.youtube.com/watch?v=wP1iQaprQ8s&t=1906s)

**Se dijo:** «imagino que la que se está utilizando es una ReLU».

**Lo correcto:** la capa oculta del capítulo 08 y el bloque de atención del 09 y el 10 usan **tanh**, una curva suave entre −1 y 1. La respuesta de fondo sí es acertada: hay varias funciones de activación y unas funcionan mejor que otras según la red. Los LLM grandes suelen usar variantes suaves de ReLU, como GELU o SwiGLU.

### 🔵 De dónde salen los 45 caracteres
[5:07](https://www.youtube.com/watch?v=wP1iQaprQ8s&t=307s)

El vocabulario por caracteres no son «24 minúsculas y 24 mayúsculas». Son los caracteres que aparecen en el texto de entrenamiento: las 26 minúsculas, 3 mayúsculas (E, L, T), 3 vocales con tilde (á, ó, ú), los 10 dígitos, el espacio y el punto. En total, 45.

### 🔵 Un tokenizador de otro idioma gasta más del doble
[17:03](https://www.youtube.com/watch?v=wP1iQaprQ8s&t=1023s)

La idea es correcta. En el curso, el texto en inglés con un tokenizador entrenado solo en español ocupa **casi el triple** de tokens (2,7 ×) que con el tokenizador bilingüe. La cifra exacta depende del texto y de los idiomas.

### 🔵 El tamaño de los modelos grandes
[27:02](https://www.youtube.com/watch?v=wP1iQaprQ8s&t=1622s)

Los modelos abiertos publican su tamaño, que va desde unos pocos miles de millones de parámetros hasta más de un billón. Los modelos comerciales, como los de ChatGPT, no lo publican, así que sus cifras son estimaciones. La red del capítulo 08 tiene **35.669** parámetros.

### 🔵 Cómo funcionan las preferencias en la práctica
[33:00](https://www.youtube.com/watch?v=wP1iQaprQ8s&t=1980s) y [36:44](https://www.youtube.com/watch?v=wP1iQaprQ8s&t=2204s)

El capítulo 10 lo simplifica: el evaluador elige una respuesta y se reentrena con las elegidas. En los asistentes reales, las comparaciones suelen hacerlas evaluadores contratados con instrucciones, y se usan para entrenar un **modelo de recompensa** que después puntúa millones de respuestas (*RLHF*). Las valoraciones de los usuarios, como el pulgar arriba, también se usan; OpenAI señaló ese peso como una de las causas del caso de GPT-4o. Tampoco se preentrena con «todo internet»: los datos se filtran y se mezclan con libros, código y otras fuentes.

### 🔵 La atención reparte, no elige
[39:06](https://www.youtube.com/watch?v=wP1iQaprQ8s&t=2346s)

Cada token no se queda solo con el token anterior «más relevante». Reparte su atención en porcentajes entre todos los anteriores y mezcla su información según esos pesos. Es lo que se ve en el capítulo 09 cuando «al» mira sobre todo a «desierto», pero no solo a él.

## IA 04 · Razonamiento, herramientas, caché y arnés

[Ver el vídeo](https://www.youtube.com/watch?v=X4obf9aygwY)

### 🔴 Pensar no evita que se invente datos
[4:08](https://www.youtube.com/watch?v=X4obf9aygwY&t=248s)

**Se dijo:** que pensar «permitió en 2024 a los modelos tener menos alucinaciones», es decir, respuestas menos inventadas.

**Lo correcto:** razonar ayuda en problemas de **varios pasos**, como seguir la bola en el trile. Pero pensar no crea datos: si un precio o un resultado no está en lo que aprendió ni en la pregunta, ningún razonamiento lo encuentra. Es la idea con la que abre el capítulo 12. Lo que evita inventar un dato es una **herramienta** que lo consulte, como se ve después en la charla con la grapadora y el partido.

### 🔴 La inyección de prompt sigue sin estar resuelta
[22:43](https://www.youtube.com/watch?v=X4obf9aygwY&t=1363s)

**Se dijo:** que, avisando de que el texto de fuera puede traer instrucciones, «la mayoría de los modelos de hoy en día no las siguen».

**Lo correcto:** los modelos actuales caen **menos**, pero siguen cayendo a veces, y no hay forma fiable de saber cuándo. Marcar lo que viene de fuera ayuda, pero no basta. Por eso el arnés tiene que **limitar** lo que puede hacer el agente y **pedirte confirmación** antes de lo importante (capítulos 12 y 14).

### 🔴 Guardar el contexto en un archivo sí cuesta
[48:03](https://www.youtube.com/watch?v=X4obf9aygwY&t=2883s)

**Se dijo:** a la pregunta de si guardar el contexto en un archivo para que otro paso lo lea tiene un coste extra, que «en temas de costes es irrelevante».

**Lo correcto:** lo que se lee de ese archivo entra como **tokens de entrada** en cada llamada que lo usa, así que sí se paga. Aun así suele salir **más barato** que arrastrar toda la conversación: el paso siguiente arranca con un contexto pequeño y solo con lo que necesita. Es la idea de los sub-agentes del capítulo 17. En la misma respuesta hay un lapsus: los tokens que tú envías son de **entrada**, no de salida ([48:08](https://www.youtube.com/watch?v=X4obf9aygwY&t=2888s)).

### 🟡 Repaso de las sesiones anteriores
[0:22](https://www.youtube.com/watch?v=X4obf9aygwY&t=22s) y [2:26](https://www.youtube.com/watch?v=X4obf9aygwY&t=146s)

**Se dijo:** que la red del capítulo 02 aprendió a identificar «letras escritas», que el autoencoder hacía «un escalado hacia arriba» y que en 2023 llegó ChatGPT 3.5.

**Lo correcto:** el capítulo 02 reconoce **dígitos** (del 0 al 9). El autoencoder **comprime y reconstruye** la imagen; ampliarla es la superresolución del capítulo 04. ChatGPT, con GPT-3.5, salió a **finales de 2022**.

### 🟡 Los números de la caché KV
[28:24](https://www.youtube.com/watch?v=X4obf9aygwY&t=1704s)

**Se dijo:** que con caché el primer paso calcula «seis posiciones».

**Lo correcto:** la frase empieza con 3 palabras. Sin caché son 1 + 2 + 3 = **6** posiciones; con caché, **3**. Desde ahí, con caché cada token nuevo cuesta **1** posición, y sin caché hay que repasar todos: 36 con 8 palabras, 45 con 9.

### 🟡 El modelo es Claude Sonnet 5.5 y las cifras son céntimos
[29:21](https://www.youtube.com/watch?v=X4obf9aygwY&t=1761s) y [33:14](https://www.youtube.com/watch?v=X4obf9aygwY&t=1994s)

**Se dijo:** «Claude Sonnet 5», y que la petición costaría «uno y trece» frente a unos once.

**Lo correcto:** los precios del capítulo 13 son los de **Claude Sonnet 5.5** (2 $ por millón de tokens de entrada, 10 $ de salida y 0,20 $ leídos de la caché). La petición del ejemplo cuesta **1,13 céntimos** de dólar con caché, frente a unos **11 céntimos** si cambian las instrucciones. La proporción, unas 10 veces, es la correcta.

### 🔵 Arnés y agente no son lo mismo
[36:46](https://www.youtube.com/watch?v=X4obf9aygwY&t=2206s)

En la charla se dice que el arnés es «lo que antes se llamaban los agentes». En el curso, el **arnés** es el programa que rodea al modelo. El **agente** es ese programa y el modelo trabajando juntos en bucle. Claude Code, por ejemplo, es un agente; su arnés es la parte que no es el modelo.

### 🔵 El agente no suma de dos en dos
[39:50](https://www.youtube.com/watch?v=X4obf9aygwY&t=2390s)

Se describe una «herramienta que suma» a la que se llama con cada par de valores. En el capítulo 14, el agente pide **ejecutar un pequeño programa** que hace todas las cuentas de una vez y le devuelve el resultado como texto. La idea de fondo es la misma: no suma de cabeza.

### 🔵 La segunda partida del trile
[7:33](https://www.youtube.com/watch?v=X4obf9aygwY&t=453s)

Al leer la diapositiva se dicen 4 cambios, pero la partida tiene los mismos **6** que al principio. Con los 6, la bola acaba en el **vaso 1**, como responde el modelo que piensa.

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

**IA 03 · Tokens, embeddings and attention** ([video](https://www.youtube.com/watch?v=wP1iQaprQ8s))

- 🟡 **The models are not trained on 100 sentences** ([31:06](https://www.youtube.com/watch?v=wP1iQaprQ8s&t=1866s)). Chapter 08 trains on 1,400 sentences (700 Spanish, 700 English) and validates on 240; chapter 09 adds 600 two-sentence stories; chapter 10 pre-trains on 2,380 lines.
- 🟡 **The training error is not a percentage** ([21:30](https://www.youtube.com/watch?v=wP1iQaprQ8s&t=1290s)). The chart shows the loss as a number. It starts near 6 because an untrained network spreads its probability over 389 tokens (ln 389 ≈ 6). The percentage next to it is validation accuracy.
- 🟡 **These networks use tanh, not ReLU** ([31:46](https://www.youtube.com/watch?v=wP1iQaprQ8s&t=1906s)). Large LLMs usually use smooth ReLU variants such as GELU or SwiGLU.
- 🔵 The 45 characters are those in the training text: 26 lowercase, 3 uppercase, á ó ú, 10 digits, space and full stop.
- 🔵 English text with a Spanish-only tokenizer takes about 2.7 × the tokens of the bilingual one ("about double" in the talk).
- 🔵 Open models publish their size (a few billion to over a trillion parameters); commercial models such as ChatGPT's do not. The chapter 08 network has 35,669.
- 🔵 Real preference tuning usually trains a reward model on comparisons by hired raters (RLHF), plus user feedback; pre-training data is filtered and mixed, not "the whole internet".
- 🔵 Attention spreads percentages over all previous tokens and mixes them; it does not pick a single "most relevant" one.

**IA 04 · Reasoning, tools, cache and harness** ([video](https://www.youtube.com/watch?v=X4obf9aygwY))

- 🔴 **Thinking does not stop a model from inventing facts** ([4:08](https://www.youtube.com/watch?v=X4obf9aygwY&t=248s)). Reasoning helps with multi-step problems such as the cups game, but it cannot create data the model never saw. Tools fix that (chapter 12).
- 🔴 **Prompt injection is still unsolved** ([22:43](https://www.youtube.com/watch?v=X4obf9aygwY&t=1363s)). Current models fall for it less often, not "mostly never". Marking outside text helps but is not enough; the harness must limit what the agent can do and ask before anything important.
- 🔴 **Context saved to a file does cost money** ([48:03](https://www.youtube.com/watch?v=X4obf9aygwY&t=2883s)). Whatever is read from it is billed as input tokens on every call that uses it, though it is usually cheaper than carrying the whole conversation (the subagents idea in chapter 17). The tokens you send are *input*, not output.
- 🟡 Recap slips: chapter 02 reads **digits**, not letters; the autoencoder compresses and rebuilds (enlarging is chapter 04); ChatGPT with GPT-3.5 launched in **late 2022**.
- 🟡 KV cache demo: starting from 3 words, the first step is **6** positions without the cache and **3** with it ([28:24](https://www.youtube.com/watch?v=X4obf9aygwY&t=1704s)).
- 🟡 The prices are **Claude Sonnet 5.5**'s, and the example request costs **1.13 cents** with the cache versus about 11 cents ([33:14](https://www.youtube.com/watch?v=X4obf9aygwY&t=1994s)).
- 🔵 The **harness** is the program around the model; the **agent** is harness and model working in a loop.
- 🔵 In chapter 14 the agent runs one small program for all the sums, not a "sum tool" called pair by pair.
- 🔵 The second cups slide is read with 4 swaps; the game has 6, and with them the ball ends under cup 1.
