[← Volver al README](../README.md)

# Guía de desarrollo de Neural Labs

Dieciséis capítulos en HTML, CSS y JavaScript: **Perceptrones**, **Aprender a leer**, **Autoencoder**, **Superresolución**, **Algoritmos genéticos**, **Coches**, **Tokens**, **Siguiente token**, **Atención**, **Del modelo al asistente**, **Pensar antes de responder**, **Herramientas y agentes**, **Caché y coste**, **El arnés** y **Skills y MCP** y **La memoria**. Las redes, el entrenamiento y la inferencia se ejecutan en el navegador. Los capítulos 14 y 15 enseñan sesiones reales de Claude Code, grabadas una vez y guardadas en el repositorio; la página no llama a ninguna API. No requiere servicios de IA, cuentas ni claves de API.

Este repositorio contiene las fuentes editables de los dieciséis capítulos, sus datos y sus pruebas. La web existente está en [labs.jacksparrot.com](https://labs.jacksparrot.com/); hacer un commit o un push aquí no actualiza ni reinicia ese servicio.

## Abrir sin servidor ni internet

Abre **`Neural-Labs.html` con doble clic** en un navegador actualizado. Es un único archivo portable que incluye los dieciséis capítulos, los dos idiomas, los 3.000 ejemplos de MNIST y los entrenadores. No necesita Node.js, instalación ni conexión para usarlo. Puedes copiar solo ese archivo a otro ordenador.

El archivo se genera automáticamente con `npm run build`, junto a la web habitual. Se incluye en Git para poder abrir el curso tras descargar el repositorio. Para regenerarlo desde un checkout nuevo, sigue los pasos de abajo; `esbuild` se utiliza únicamente durante la generación. El archivo conserva los avisos de licencia y permite descargar la procedencia de MNIST.

Los guardados de la versión portable pertenecen al archivo y al navegador. Usa exportar/importar para llevar tus experimentos entre la versión web, el archivo portable y otros equipos.

## Generar el curso y ejecutarlo como web

Para trabajar con las fuentes necesitas **Node.js 20 o posterior** y Git.

```sh
git clone https://github.com/JackSParrot/ai-course.git
cd ai-course
npm ci
npm run build
npm start
```

Abre **http://127.0.0.1:5200/**. Detén el servidor con **Ctrl+C**. En PowerShell, si la política de scripts bloquea `npm`, utiliza `npm.cmd` con los mismos argumentos; no hace falta cambiar esa política.

También puedes preparar el contenido y arrancar el servidor con un solo lanzador:

- **macOS/Linux:** ejecuta `./scripts/serve.sh` desde la carpeta del proyecto.
- **macOS, con doble clic:** abre `scripts/START.command`; se ejecutará en Terminal.
- **Windows:** ejecuta `scripts/START.cmd`.

Los lanzadores funcionan desde cualquier directorio, regeneran el contenido antes de servirlo y mantienen el servidor abierto hasta pulsar **Ctrl+C**. Requieren Node.js 20 o posterior y haber ejecutado `npm ci` una vez. Por ejemplo, `LABS_PORT=5201 ./scripts/serve.sh` usa otro puerto en macOS/Linux.

También puedes ejecutar `node scripts/build.mjs` y después `node scripts/server.mjs`. Los HTML de las carpetas fuente usan módulos y datos separados y se ejecutan por HTTP. Para abrir el curso sin servir archivos, utiliza el `Neural-Labs.html` generado.

El servidor escucha solo en este ordenador. Si el puerto está ocupado, elige otro antes de arrancar:

```powershell
$env:LABS_PORT = "5201"
npm.cmd start
```

En macOS/Linux: `LABS_PORT=5201 npm start`.

El curso adapta automáticamente su paleta al modo claro u oscuro del sistema o navegador. La paleta oscura compartida está en `shell/dark.css`: fondos gris verdoso, texto claro y acentos suaves con mayor contraste.

## Los capítulos

1. **Perceptrones — `/perceptrons/`**. Cinco slides: introducción al axón y al perceptrón; NAND; OR con la misma neurona, conservando los pesos al cambiar de función; intento de XOR con una sola recta; y una red manual 2→2→1 con nueve parámetros que sí permite resolver XOR. Los controles junto al gráfico y los de la neurona están sincronizados, y cada ejercicio conserva sus ajustes al navegar. Muestra contribuciones, activaciones, fronteras y tablas de verdad.
2. **Aprender a leer — `/digits/`**. Dibujo libre, editor de imágenes, biblioteca de ejemplos y editor de topologías. Backpropagation y SGD escritos desde cero, entrenamiento visible en un Web Worker y comparación de modelos independientes. Incluye las cinco topologías 256→10, 256→32→10, 256→64→10, 256→128→10 y 256→64→32→10, además de topologías editables. El botón «Expandir red» muestra todas las neuronas y conexiones con desplazamiento manual, zoom y el inspector visible junto al gráfico (debajo en pantallas estrechas). Las tres imágenes y los valores exactos se actualizan al seleccionar una neurona; al cerrar, el inspector vuelve al panel original. El inspector muestra tres imágenes alineadas: **pesos**, **entradas reales** y **productos/contribuciones**, junto con su suma y el sesgo.
3. **Autoencoder — `/autoencoder/`**. Red convolucional 64×64×1 → 32×32×4 → 16×16×4 → ampliar ×2 → convolución 32×32×4 → ampliar ×2 → convolución 64×64×1. El cuello contiene 1024 activaciones frente a 4096 píxeles. Se puede editar su código y reconstruir solo con el decodificador; el inspector refleja las activaciones modificadas.
4. **Superresolución — `/superresolution/`**. Otra red, entrenada desde cero con pares 32×32 y 64×64: convolución a 8 mapas → ampliar ×2 → convolución de salida. Compara bloques, bilineal y red, con MSE por imagen cuando existe original. Dibujar en baja resolución elimina la referencia de alta resolución y oculta sus métricas.
5. **Algoritmos genéticos — `/maze/`**. Introducción a la evolución, planteamiento del reto y simulación de generaciones. Dos campos abiertos de 38 × 38 casillas tienen obstáculos y varias rutas mínimas de 70 pasos; cada explorador hereda exactamente 100 movimientos. La población se reproduce simultáneamente con colores, direcciones y rastros sincronizados. Incluye editor, ruleta de selección, cruce visible, mutación independiente, historial y guardado local.
6. **Coches — `/cars/`**. Sensores, conducción por red neuronal, editor de circuitos, biblioteca de mapas, editor de tipos/topologías e inspector. El entrenador compara poblaciones mediante selección y mutación. [Guía detallada](../cars/README.md).
7. **Tokens — `/tokens/`**. Primer paso hacia los modelos de lenguaje. Una explicación guiada (paso a paso, con la frase que elija el usuario) muestra texto → palabras → piezas → números → texto. Después compara trocear por letras, palabras o tokens; una segunda explicación cuenta BPE con cuatro palabras; el usuario construye su propio tokenizador BPE y explora rarezas (contar letras, cifras, mayúsculas, bytes, coste por idioma, ventana de contexto). Tokenizador BPE por caracteres con respaldo de bytes y un espacio inicial pegado a cada palabra, como en GPT. Texto de entrenamiento propio generado con plantillas: 1.400 frases de entrenamiento y 240 de validación, en español e inglés, sin frases compartidas.
8. **Siguiente token — `/predictor/`**. Dos explicaciones guiadas con los números reales de la red: cómo decide (tokens → contexto → embeddings → capa oculta → probabilidades → elegir y repetir) y cómo aprende (una ventana recorre una frase y convierte cada posición en un ejemplo). Después el usuario entrena la red en un Web Worker y compara 1, 2 o 4 tokens de contexto (embeddings de 16 → capa oculta tanh de 64 → softmax, Adam), explora un mapa 2D de embeddings (PCA) y genera texto con temperatura o eligiendo cada token. Reutiliza el corpus, el tokenizador, los estilos y los componentes de `tokens/`.
9. **Atención — `/attention/`**. Un transformer diminuto escrito desde cero: un bloque con atención causal de una cabeza, posición aprendida, capa tanh de 64 y conexiones residuales (unos 34.000 parámetros, como la red del 08). Se entrena en un Web Worker a la vez que la red del 08, con el mismo texto más 600 historias de dos frases cuyo final repite un lugar de la primera («…en el desierto. Después, el mago vuelve al desierto»). La red del 08 acierta ese lugar en torno al 20 % (azar); el transformer llega al 100 % en pocas épocas y su atención pone casi todo el peso en el lugar de la primera frase. Incluye explicaciones paso a paso (el problema; pregunta, clave, porcentajes, mezcla, posición y bloque, con los números reales), comparación y mapa de atención interactivo.
10. **Del modelo al asistente — `/assistant/`**. Las tres fases del entrenamiento con el transformer del capítulo 09, en un Web Worker. Preentrenamiento con el texto de los capítulos anteriores más hechos («El mago está en el desierto.») y charla en la que la gente se da la razón. Ajuste con 120 conversaciones de ejemplo (3 épocas, la pérdida solo cuenta la respuesta) que terminan con un token de fin ⏹. Ajuste por preferencias: 12 respuestas por pregunta a temperatura 1,5, un evaluador simulado elige una (o ninguna) según dos controles —cuánto le gusta que le den la razón y cuánto comprueba los hechos— y se reentrena con las elegidas (técnica de muestreo con rechazo); cada fase empieza con un optimizador nuevo. Mide en 40 preguntas de prueba con una opinión equivocada cuántas respuestas son verdad y cuántas dan la razón: con evaluadores complacientes, el asistente pasa del 100 % de verdad a dar la razón en casi todas en 6 rondas; si comprueban los hechos, sigue en el 100 %.
11. **Pensar antes de responder — `/reasoning/`**. Por qué ayuda razonar, con el trile (la bola y los vasos) y el transformer del capítulo 09 sin cambios. Seis cambios fijos en cada partida. Con tres vasos, dos copias del modelo aprenden con las mismas 1.902 partidas: una responde de golpe y se queda cerca del azar (≈ 40 %); la otra escribe dónde está la bola tras cada cambio y llega al 100 % en unas 4 épocas. Mapa de atención de cada paso (el cambio que toca es el más mirado en el 97 % de los pasos) y «Equivócate tú»: si se fuerza un paso equivocado, la respuesta lo sigue. Después, aprender a pensar con premios comprobables, con nueve vasos para que la suerte cuente poco: desde 100 ejemplos escritos que ya no mejoran solos, 12 rondas de 300 preguntas con 12 respuestas cada una. Comprobando la respuesta suben los razonamientos correctos (del 56 % al 100 % con la semilla de la página); los controles «no comprobar nada» y «repasar los ejemplos» empeoran o se quedan igual. La generación usa una caché de claves y valores (`decoder` en `attention/src/transformer.js`), idéntica a la pasada completa.
12. **Herramientas y agentes — `/tools/`**. Qué es una herramienta, enseñado sin entrenar nada. Ejemplo: Papelería Folio, una tienda inventada con un catálogo de enero y otro de marzo (suben los precios y llegan dos productos nuevos). Cuatro explicaciones guiadas (`Stepper`): lo que pensar no arregla; una llamada es texto («Busco: … ⏸», el programa pega «Resultado: …» y el modelo responde); memoria contra herramienta (el de memoria inventa el precio de lo que no vio, a menudo copiando un producto parecido, y se queda con los precios viejos; el de la herramienta solo copia: le da acceso, no inteligencia), y el bucle de un agente, con la analogía de hacer la compra con una lista. Interactivos instantáneos con respuestas escritas a mano: pregunta por un producto en enero o en marzo; «Tú eres el programa» (devuelve un precio real, falso, absurdo o «no encontrado»); la inyección (una reseña que cualquiera puede escribir trae una orden; el programa puede marcar lo que viene de fuera) y «Haz de agente» en una carpeta compartida de oficina que solo ves como texto (`listar` y `abrir`). Todos los ejemplos y resultados son ilustrativos y la página lo indica. Sin entrenamiento ni worker.
13. **Caché y coste — `/cache/`**. Qué es el KV cache y por qué abarata usar Claude, GPT o Gemini. Un panel genera una frase token a token con y sin caché: la K y la V de los tokens anteriores no cambian y se pueden guardar. «Con la red del capítulo 09» genera 32 tokens con el transformer del capítulo 09 de las dos maneras: 528 posiciones frente a 32 y las mismas probabilidades. Prefill frente a decode y su reflejo en las tarifas. La caché de prompts: cambia un bloque del prompt y mira qué se recalcula y cuánto cuesta. La factura de un agente con y sin caché. Precios de Claude Sonnet 5.5 en octubre de 2026; sin entrenamiento ni worker.
14. **El arnés — `/harness/`**. Del chat al agente: el modelo solo escribe texto y el arnés le da instrucciones, herramientas y un bucle. El ejemplo son 40 tickets inventados de un viaje del equipo a la Gamescom y el encargo de clasificarlos en una tabla de gastos. Respuestas reales grabadas con Claude Code 2.1.287 y Claude Sonnet 5.5 el 27 de octubre de 2026 (`harness/src/session.js`, exportado de las grabaciones, no editado a mano): como chat sin herramientas, con herramientas para leer y escribir archivos, y con el ordenador. Incluye la llamada a una herramienta que el chat escribió como texto, las piezas del arnés, un «monta tu asistente» con esos tres niveles, los 23 intentos (0/3, 10/10, 10/10) y, opcional, el bucle en código. Sin entrenamiento ni worker.
15. **Skills y MCP — `/skills/`**. Cargar solo lo que hace falta: el arnés enseña al modelo un menú (nombre y descripción de cada skill) y el modelo abre la que necesita. Mismos 40 tickets del capítulo 14 y la política de gastos de Brújula, una agencia de comunicación inventada. Analogía de oficina: la mesa (lo que el modelo tiene delante), el archivador (cada skill es un cajón con su etiqueta) y el enchufe (MCP). 80 respuestas reales grabadas con Claude Code 2.1.287 y Claude Sonnet 5.5 el 28 de octubre de 2026, todas con carga diferida de herramientas (`skills/src/session.js`, exportado de las grabaciones, no editado a mano): sin la skill, con la política siempre cargada y con ella en el menú; cuatro etiquetas para la misma skill (10 intentos de cada), y un servidor MCP de contabilidad inventado, con y sin las skills. Incluye la skill completa (etiqueta y contenido) y una carpeta de ejemplo con documentos de consulta y programas. Sin entrenamiento ni worker.
16. **La memoria — `/memory/`**. Lo que no está en el contexto no existe, una mesa demasiado llena cuesta y estorba, y la memoria es un archivo de notas con índices por niveles. Explicaciones paso a paso y ejercicios con ejemplos y cifras **ilustrativos**, marcados como tales en la página (sin grabaciones exportadas). Sin entrenamiento ni worker.

Los talleres permiten guardar trabajo en el almacenamiento local del navegador. Los guardados pertenecen a su origen completo —protocolo, host y puerto— y no se transfieren automáticamente al cambiar de dirección. Usa las opciones de exportar/importar cuando estén disponibles. El servidor del curso no recibe dibujos, pesos ni experimentos.

## Detalles de los experimentos de imágenes

Ambas comparten el motor propio `autoencoder/src/network.js`: convoluciones 3×3, tanh, sigmoid, MSE, backpropagation y Adam con lotes de 8. Los datos procedurales tienen 128 ejemplos de entrenamiento, 24 de validación y 24 de prueba, con semillas separadas y sin imágenes coincidentes. El worker entrena por lotes y admite pausa entre lotes. La curva mide exclusivamente validación. El guardado conserva pesos por capítulo; cargar reinicia el optimizador y la sesión de medidas, sin simular una continuación exacta.

El explorador incluye **todas** las activaciones (37.888 en autoencoder y 46.080 en superresolución), sin muestreo, incluidas las copias de ampliación. Permite zoom, desplazamiento, pantalla ampliada, selección por capa/índice y todas las conexiones reales. El inspector muestra entradas, pesos, productos, sesgo, suma y activación de cualquier neurona; identifica el relleno y las copias sin parámetros aprendidos. Los filtros se comparten entre posiciones. La compresión de activaciones no implica una reducción equivalente de bytes.

Las pruebas de imágenes verifican gradientes por diferencias finitas en cada capa, todos los cálculos del inspector, cambios del código interno, separación de datos, reducción real del error y ejecución de ambos entrenamientos en el worker portable.

## Idiomas

La portada, los dieciséis capítulos y los editores comparten las mismas páginas en **español e inglés**. Usa el selector **ES / EN** para cambiar sin recargar ni perder el ejercicio o entrenamiento en curso. El idioma se recuerda en este navegador; también puedes compartir enlaces con `?lang=en` o `?lang=es`, por ejemplo `/perceptrons/?lang=en#combinar`. El parámetro del enlace tiene prioridad sobre la preferencia guardada.

Las traducciones están en `i18n/en.js`: el texto español original es la clave. `i18n/dom.js` traduce el contenido y los atributos accesibles, incluidos los mensajes que generan los talleres, y conserva el original para volver a español. Los gráficos usan la misma función de traducción. No hay copias de las páginas, peticiones a servicios de traducción ni dependencias adicionales. Al cambiar un texto, actualiza su entrada del catálogo; puedes marcar contenido propio con `data-i18n-ignore` para conservarlo literalmente. Los nombres de usuario, valores de formularios, código, pesos y guardados mantienen sus datos originales.

## Fuentes y estructura

```text
course/           Capítulo 01: HTML, estilos, controles y matemáticas
digits/           Capítulo 02: interfaz, red, entrenamiento, editores y MNIST
autoencoder/      Capítulo 03 y motor compartido de imágenes
superresolution/  Capítulo 04: ampliación aprendida y comparaciones
maze/             Capítulo 05: laberinto y algoritmos genéticos
cars/             Capítulo 06: fuentes y pruebas del laboratorio de coches
tokens/           Capítulo 07: corpus, tokenizador BPE, componentes y estilos compartidos con el 08
predictor/        Capítulo 08: modelo del siguiente token, worker y mapa de embeddings
attention/        Capítulo 09: transformer diminuto y worker que lo entrena junto a la red del 08
assistant/        Capítulo 10: mundo de conversaciones, evaluadores simulados, fases de entrenamiento y worker
reasoning/        Capítulo 11: partidas del trile, experimentos de razonamiento y premios, y worker
tools/            Capítulo 12: la papelería, la llamada como texto, la inyección y la carpeta para hacer de agente
cache/            Capítulo 13: KV cache, caché de prompts y costes
harness/          Capítulo 14: del chat al agente, con los tickets de un viaje y respuestas reales de Claude Code
skills/           Capítulo 15: skills y MCP, con la política de gastos de una agencia inventada y respuestas reales de Claude Code
memory/           Capítulo 16: la memoria, con ejemplos ilustrativos (la mesa, recordar entre conversaciones y el mapa de notas)
shell/            Portada, estilos comunes y navegación entre capítulos
i18n/             Catálogo inglés, selector y traducción compartida
tests/            Perceptrones, publicación HTTP y restricciones del servidor
tests/digits/     Matemáticas, datos, editores, entrenamiento, guardado e inspector
cars/tests/       Redes, simulación, mapas, topologías y entrenamiento genético
scripts/          Build, servidor, lanzadores y preparación del subconjunto MNIST
scripts/portable/ Empaquetado y navegación de la versión de un solo archivo
scripts/build.mjs Genera el sitio estático usando solo fuentes del repositorio
scripts/server.mjs Sirve la instantánea comprobada por hashes
scripts/peer-guard.mjs Restricción opcional por dirección TCP para otros alojamientos
public/           Salida generada; no se guarda en Git
publication-manifest.json  Hashes de la salida; generado, no se guarda en Git
Neural-Labs.html   Curso portable generado y versionado para distribución
```

Edita `course/`, `digits/`, `maze/`, `cars/`, `autoencoder/`, `superresolution/`, `tokens/`, `predictor/`, `attention/`, `assistant/`, `reasoning/`, `tools/`, `cache/`, `harness/`, `skills/`, `memory/` o `shell/`, y ejecuta de nuevo `npm run build`. El mismo build actualiza `Neural-Labs.html`; cierra y vuelve a abrir el archivo para ver los cambios. El servidor mantiene una instantánea en memoria: detenlo y vuelve a iniciarlo para ver un nuevo build. No edites `public/` a mano.

Todos los orígenes del build son rutas relativas internas. No necesita otro checkout, un disco concreto, Unity, una instalación de Codex ni los proyectos originales.

## Build y pruebas

```sh
npm run build
npm test
```

`npm test` reconstruye primero el sitio y ejecuta todas las pruebas con el runner incluido en Node. Las suites verifican matemáticas, gradientes por diferencias finitas, separación y hashes de los datos, modelos independientes, entrenamiento real, editores, guardado/recuperación, las tres imágenes del inspector, coches, el tokenizador BPE (ida y vuelta exacta, determinismo), el modelo del siguiente token, el transformer (gradientes, máscara causal, una tarea de copia que solo resuelve la atención y la generación con caché idéntica a la pasada completa), el razonamiento (pensar supera a responder de golpe y la mecánica de los premios) y recursos HTTP. Las pruebas de la versión portable verifican los datos incrustados, la navegación y la ejecución real de los entrenadores empaquetados. Los servidores de prueba usan puertos efímeros de loopback y se cierran al terminar.

El build genera **`Neural-Labs.html`** y **110 recursos web** mediante una lista explícita. Los tamaños y SHA-256 de los recursos web quedan en `publication-manifest.json`. El servidor valida esos archivos al arrancar y solo expone esa lista: no publica código del servidor, pruebas, Git, variables de entorno ni directorios completos. También comprueba rutas relativas, módulos y los Web Workers.

Para generar una salida separada dentro del repositorio:

```sh
node scripts/build.mjs --out=releases/local
```

La salida separada incluye su propio `Neural-Labs.html`. Puedes alojar el contenido de `public/` en un servidor estático con HTTPS, manteniendo sus subcarpetas, tipos MIME y módulos/Workers del mismo origen. Para usar `scripts/server.mjs`, conserva también el manifiesto junto a `public/`. Las cabeceras de seguridad y la lista estricta del servidor Node no se configuran automáticamente en un proveedor estático. Este repositorio no incluye credenciales, configuración privada de infraestructura ni un despliegue automático.

## Datos MNIST

El subconjunto incluido contiene **3.000 imágenes de 16×16**, 300 por dígito: **2.000 entrenamiento**, **500 validación** y **500 test**, equilibradas por clase. Los identificadores originales y los hashes permiten comprobar duplicados y separación entre conjuntos. El test procede exclusivamente del conjunto test original de MNIST y solo se carga al abrir la evaluación final; después se congelan los modelos del experimento.

El test se distribuye como archivo estático para poder evaluarlo en el navegador. La reserva para evaluación final es una regla pedagógica del programa, no una medida para ocultar ese archivo. No utilices sus resultados para ajustar hiperparámetros.

Los datos ya están preparados: **no hace falta descargarlos ni regenerarlos para usar el curso o ejecutar las pruebas**. La regeneración opcional descarga los cuatro IDX oficiales, comprueba sus checksums y repite el muestreo y redimensionado deterministas:

```sh
npm run data:prepare
npm test
```

La caché de descargas queda en `.cache/`, excluida de Git. Consulta [procedencia, transformación y licencia](../digits/data/PROVENANCE.md) y el [manifiesto de datos](../digits/data/manifest.json). Es un subconjunto didáctico; sus métricas no son resultados del benchmark MNIST completo.

## Licencias y atribución

Se conserva la [licencia MIT](../LICENSE) que ya existía en este repositorio, con copyright de Francisco Pons Ruiz. Las imágenes MNIST y su adaptación tienen su propia licencia **CC BY-SA 3.0** y atribución a **Yann LeCun, Corinna Cortes y Christopher J. C. Burges**, documentadas en [PROVENANCE.md](../digits/data/PROVENANCE.md). La licencia del código no sustituye la de los datos.

## Capítulo del laberinto

`maze/src/evolution.js` contiene el motor determinista de selección por clasificación, cruce de un punto y mutación independiente. Los valores iniciales son 64 exploradores, 100 genes y un 1 % de mutación por gen. El explorador solo ejecuta su ADN; las distancias por casillas libres alrededor de obstáculos pertenecen al evaluador y no se usan para generar instrucciones. La animación muestra todos los recorridos hasta el mismo paso; quienes llegan al tesoro se detienen y conservan los genes sobrantes sin ejecutar. El automático sigue tras la primera llegada para descubrir alternativas.

`maze/src/app.js` presenta las fases, los sorteos, la ascendencia, las repeticiones y el editor. Se conservan estadísticas de cada generación y el ADN de la primera y las 60 últimas evaluadas para volver a reproducirlas. El archivo de generaciones codifica cada gen como un dígito para limitar el uso de almacenamiento. El estado usa `neural-maze.evolution.v2`, separado de los otros capítulos y del experimento anterior de pasillos (`v1`, que no se sobrescribe). Editar el mapa reinicia el experimento y exige una ruta de 100 pasos o menos; los 70 pasos solo se garantizan en los mapas originales. Las pruebas comprueban rutas independientes de 70 pasos, espacios abiertos y rincones sin salida, mejora y llegada real por evolución, diversidad de rutas físicas, conservación de élites, reproducción determinista y recuperación de experimentos e historial.
