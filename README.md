# Neural Labs

Un curso interactivo para entender las redes neuronales: de una sola neurona a reconocer dígitos, conducir coches y entender cómo funcionan los modelos de lenguaje. **Español e inglés**, con ejercicios visuales y entrenamiento real en el navegador.

## Abrir el curso sin instalar nada

1. Descarga el repositorio: **Code → Download ZIP**.
2. Descomprime el ZIP.
3. Abre **[Neural-Labs.html](Neural-Labs.html)** con doble clic en un navegador actualizado.

Ese único archivo incluye el curso completo, ambos idiomas y los datos de entrenamiento. **Funciona sin servidor, sin Node.js y sin internet.** Puedes copiarlo a otro ordenador. En GitHub, el enlace al HTML muestra su código; descarga el archivo para ejecutarlo.

## Qué puedes explorar

| Capítulo | Experimento |
| --- | --- |
| **01 · Perceptrones** | Ajusta pesos y sesgo para NAND y OR; descubre el límite de una recta con XOR y resuélvelo con una red. |
| **02 · Dígitos** | Dibuja números, entrena con 3.000 imágenes de MNIST y explora la red completa con sus pesos, entradas y contribuciones. |
| **03 · Autoencoder** | Comprime imágenes de 64 × 64 en 1024 activaciones, reconstruye y modifica el código interno. Inspecciona todas las capas, filtros y contribuciones. |
| **04 · Superresolución** | Entrena una red de 32 × 32 a 64 × 64 y compara con ampliación por bloques e interpolación bilineal en dibujos nuevos. |
| **05 · Laberinto** | Descubre los algoritmos genéticos con ADN de movimientos, evaluación, selección probabilística, cruce y mutación. |
| **06 · Coches** | Diseña circuitos y redes; observa cómo aprenden a conducir mediante selección y mutación. |
| **07 · Tokens** | Mira paso a paso cómo un tokenizador convierte texto en números y de dónde salen sus piezas (BPE). Construye uno y descubre qué rarezas de los LLM explican los tokens. |
| **08 · Siguiente token** | Qué es un embedding, cómo una red decide y aprende el siguiente token. Entrénala, explora sus embeddings y genera texto con temperatura. |
| **09 · Atención** | Por qué una ventana fija no basta y cómo funciona la atención, paso a paso. Entrena un transformer diminuto junto a la red del 08 y mira a quién presta atención cada token. |
| **10 · Del modelo al asistente** | Preentrena, ajusta con instrucciones y con preferencias. Descubre cómo un modelo aprende a dar la razón aunque mienta si los evaluadores premian que se la den. |
| **11 · Pensar antes de responder** | Con el trile, comprueba por qué escribir los pasos ayuda: de golpe el modelo apenas supera el azar y pensando acierta. Mira a qué cambio atiende cada paso, equivócate tú y descubre cómo aprende a pensar cuando se premian las respuestas que se pueden comprobar. |
| **12 · Herramientas y agentes** | Un modelo que memoriza se inventa las vidas de los enemigos que no vio; uno que usa una herramienta las copia. Haz de programa y miéntele, comprueba cómo un modelo que obedece correcciones cae en una inyección y juega como un agente en una mazmorra que solo ves en texto. |
| **13 · Caché y coste** | Mira qué guarda el KV cache y compruébalo con la red del capítulo 09: las mismas probabilidades con 528 posiciones calculadas o con 32. Cambia un bloque del prompt para ver qué se recalcula y cuánto cuesta, y compara la factura de un agente con y sin caché. |
| **14 · El arnés** | Por qué Claude Code hace cosas que el chat no puede: 40 tickets de un viaje de trabajo y el mismo encargo, «clasifícalos y hazme la tabla de gastos», con respuestas reales en un chat y en un agente. Descubre las piezas del programa que rodea al modelo (instrucciones, herramientas, el bucle, permisos y la conversación) y monta tu propio asistente pieza a pieza. |
| **15 · Skills y MCP** | Las reglas de la casa que el modelo no puede adivinar: una política de gastos inventada y el mismo encargo con y sin la skill, con respuestas reales de Claude Code. Mira cómo el modelo ve solo un menú y abre lo que necesita, prueba cuatro formas de presentar la skill en ese menú y conecta un servidor MCP para que pueda consultar el presupuesto y enviar la nota. |

Usa **ES / EN** para cambiar el idioma. Los cálculos ocurren en tu navegador. Exporta tus experimentos para llevarlos a otro equipo o entre la web y el archivo portable.

### Charlas y fe de erratas

Este curso acompaña una serie de charlas en vídeo: [IA 01 · Introducción a redes neuronales](https://www.youtube.com/watch?v=lE2Z-ayxwzU) e [IA 02 · Imágenes, algoritmos genéticos y coches](https://www.youtube.com/watch?v=jS0QtadL5fo). Las correcciones y aclaraciones de lo que se dijo en directo, con enlace al minuto exacto, están en la **[fe de erratas](docs/FE-DE-ERRATAS.md)**.

### Los coches dentro de Unity

La carpeta **[`unity-cars/`](unity-cars/README.md)** contiene un proyecto Unity 2D en C# para ver cómo se ejecuta una red neuronal dentro de un juego y cómo se guardan y cargan sus pesos. Incluye entrenamiento genético, un inspector visual y dos JSON legibles: descripción de la red y parámetros. Empieza por la [guía explicativa](unity-cars/docs/COMO-FUNCIONA.md). Abre esa carpeta en Unity 6000.6.2f1; permite compilar para Windows y Android. Es un ejercicio adicional al curso del navegador.

## Modificar el proyecto

Necesitas Node.js 20 o posterior:

```sh
npm ci
npm run build
npm test
```

El build actualiza `Neural-Labs.html` y genera la versión web en `public/`. Para servir esta última, ejecuta `npm start` y abre **http://127.0.0.1:5200/**.

| Carpeta | Contenido |
| --- | --- |
| `course/`, `digits/`, `autoencoder/`, `superresolution/`, `maze/`, `cars/`, `tokens/`, `predictor/`, `attention/`, `assistant/`, `reasoning/`, `tools/`, `cache/`, `harness/`, `skills/` | Los quince capítulos y sus datos. |
| `shell/`, `i18n/` | Portada, navegación, estilos comunes y traducciones. |
| `scripts/` | Generación del HTML portable, build web, servidor y lanzadores. |
| `tests/` | Pruebas del curso; el taller de coches también tiene `cars/tests/`. |
| `docs/` | [Instrucciones técnicas, datos y publicación](docs/DEVELOPMENT.md). |

Edita las fuentes y regenera el HTML; no edites el archivo generado directamente. Incluye el HTML actualizado en los commits que cambien el curso.

## English

An interactive course about neural networks, from a single neuron to handwritten digits, self-driving cars and next-word prediction. Switch between **English and Spanish** using **EN / ES**.

**No installation:** download the repository ZIP, extract it and double-click **`Neural-Labs.html`**. The single file contains all fifteen chapters, training data and training code. It works offline, with no server or Node.js required. Chapters 3 and 4 explore convolutional autoencoders and image super-resolution, with every layer and activation available for inspection. Then come genetic algorithms in a maze and neural networks that drive cars. Chapters 7 to 9 are the bridge to large language models: step by step, a BPE tokenizer turns text into tokens, a tiny network predicts the next token, a tiny transformer shows what attention adds, chapter 10 turns it into an assistant, showing how rater preferences can make it sycophantic, chapter 11 shows with a shell game why writing the steps helps and how a model learns to think from verifiable rewards, chapter 12 shows what a tool is, why an agent believes what a tool returns and how an injection takes control of it, and chapter 13 shows what the KV cache keeps and how prompt caching makes using a model cheaper.

**Talks and errata:** the course accompanies a video series ([AI 01](https://www.youtube.com/watch?v=lE2Z-ayxwzU), [AI 02](https://www.youtube.com/watch?v=jS0QtadL5fo)). Corrections and clarifications, linked to the exact minute, are in the [errata](docs/FE-DE-ERRATAS.md#errata-english).

**Development:** with Node.js 20+, run `npm ci`, `npm run build` and `npm test`. The build updates the portable HTML and creates `public/`. Use `npm start` to serve the web version locally. Source code is organized by chapter; build tools live in `scripts/`.

**Unity companion:** [`unity-cars/`](unity-cars/README.md) is a separate 2D C# project for Unity 6000.6.2f1. Inspect inference, train by selection and mutation, and save/reload the network description and parameters as two readable JSON files. Start with the [explanatory guide](unity-cars/docs/COMO-FUNCIONA.md#english). It runs in the Unity Editor and builds for Windows and Android.

## Licencias · Licenses

Código: **[MIT](LICENSE)**. Imágenes MNIST y su adaptación: **CC BY-SA 3.0**, de Yann LeCun, Corinna Cortes y Christopher J. C. Burges. Consulta la [procedencia y atribución](digits/data/PROVENANCE.md).
