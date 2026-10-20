# Curso interactivo de redes neuronales

Tres capítulos en HTML, CSS y JavaScript: **Perceptrones**, **Aprender a leer** y **Coches**. Las redes, el entrenamiento y la inferencia se ejecutan en el navegador. No requiere librerías, servicios de IA, cuentas ni claves de API.

Este repositorio contiene las fuentes editables de los tres capítulos, sus datos y sus pruebas. La web existente está en [labs.jacksparrot.com](https://labs.jacksparrot.com/); hacer un commit o un push aquí no actualiza ni reinicia ese servicio.

## Instalación y ejecución

Necesitas **Node.js 20 o posterior** y Git. No hay dependencias npm que instalar.

```sh
git clone https://github.com/JackSParrot/ai-course.git
cd ai-course
npm run build
npm start
```

Abre **http://127.0.0.1:5200/**. Detén el servidor con **Ctrl+C**. En PowerShell, si la política de scripts bloquea `npm`, utiliza `npm.cmd` con los mismos argumentos; no hace falta cambiar esa política.

También puedes preparar el contenido y arrancar el servidor con un solo lanzador:

- **macOS/Linux:** ejecuta `./serve.sh` desde la carpeta del proyecto.
- **macOS, con doble clic:** abre `START.command`; se ejecutará en Terminal.
- **Windows:** ejecuta `START.cmd`.

Los lanzadores funcionan desde cualquier directorio, regeneran el contenido antes de servirlo y mantienen el servidor abierto hasta pulsar **Ctrl+C**. Requieren Node.js 20 o posterior. Por ejemplo, `LABS_PORT=5201 ./serve.sh` usa otro puerto en macOS/Linux.

También puedes ejecutar `node build.mjs` y después `node server.mjs`. Abrir los HTML directamente con doble clic no sirve: los módulos, los Web Workers y la carga de datos necesitan HTTP.

El servidor escucha solo en este ordenador. Si el puerto está ocupado, elige otro antes de arrancar:

```powershell
$env:LABS_PORT = "5201"
npm.cmd start
```

En macOS/Linux: `LABS_PORT=5201 npm start`.

El curso adapta automáticamente su paleta al modo claro u oscuro del sistema o navegador. La paleta oscura compartida está en `shell/dark.css`: fondos gris verdoso, texto claro y acentos suaves con mayor contraste.

## Los capítulos

1. **Perceptrones — `/perceptrons/`**. Relación entre la neurona biológica y el modelo matemático, tres controles de pesos/sesgo para NAND y una red manual 2→2→1 con nueve parámetros para XOR. Muestra contribuciones, activaciones, fronteras y tablas de verdad.
2. **Aprender a leer — `/digits/`**. Dibujo libre, editor de imágenes, biblioteca de ejemplos y editor de topologías. Backpropagation y SGD escritos desde cero, entrenamiento visible en un Web Worker y comparación de modelos independientes. Incluye las cinco topologías 256→10, 256→32→10, 256→64→10, 256→128→10 y 256→64→32→10, además de topologías editables. El inspector muestra tres imágenes alineadas: **pesos**, **entradas reales** y **productos/contribuciones**, junto con su suma y el sesgo.
3. **Coches — `/cars/`**. Sensores, conducción por red neuronal, editor de circuitos, biblioteca de mapas, editor de tipos/topologías e inspector. El entrenador compara poblaciones mediante selección y mutación. [Guía detallada](cars/README.md).

Los dos talleres permiten guardar trabajo en el almacenamiento local del navegador. Los guardados pertenecen a su origen completo —protocolo, host y puerto— y no se transfieren automáticamente al cambiar de dirección. Usa las opciones de exportar/importar cuando estén disponibles. El servidor del curso no recibe dibujos, pesos ni experimentos.

## Idiomas

La portada, los tres capítulos y los editores comparten las mismas páginas en **español e inglés**. Usa el selector **ES / EN** para cambiar sin recargar ni perder el ejercicio o entrenamiento en curso. El idioma se recuerda en este navegador; también puedes compartir enlaces con `?lang=en` o `?lang=es`, por ejemplo `/perceptrons/?lang=en#combinar`. El parámetro del enlace tiene prioridad sobre la preferencia guardada.

Las traducciones están en `i18n/en.js`: el texto español original es la clave. `i18n/dom.js` traduce el contenido y los atributos accesibles, incluidos los mensajes que generan los talleres, y conserva el original para volver a español. Los gráficos usan la misma función de traducción. No hay copias de las páginas, peticiones a servicios de traducción ni dependencias adicionales. Al cambiar un texto, actualiza su entrada del catálogo; puedes marcar contenido propio con `data-i18n-ignore` para conservarlo literalmente. Los nombres de usuario, valores de formularios, código, pesos y guardados mantienen sus datos originales.

## Fuentes y estructura

```text
course/           Capítulo 01: HTML, estilos, controles y matemáticas
digits/           Capítulo 02: interfaz, red, entrenamiento, editores y MNIST
cars/             Capítulo 03: fuentes y pruebas del laboratorio de coches
shell/            Portada, estilos comunes y navegación entre capítulos
i18n/             Catálogo inglés, selector y traducción compartida
tests/            Perceptrones, publicación HTTP y restricciones del servidor
digits-tests/     Matemáticas, datos, editores, entrenamiento, guardado e inspector
cars/tests/       Redes, simulación, mapas, topologías y entrenamiento genético
scripts/          Preparación reproducible del subconjunto MNIST
build.mjs         Genera el sitio estático usando solo fuentes del repositorio
server.mjs        Sirve la instantánea comprobada por hashes
peer-guard.mjs    Restricción opcional por dirección TCP para otros alojamientos
public/           Salida generada; no se guarda en Git
publication-manifest.json  Hashes de la salida; generado, no se guarda en Git
```

Edita `course/`, `digits/`, `cars/` o `shell/`, y ejecuta de nuevo `npm run build`. El servidor mantiene una instantánea en memoria: detenlo y vuelve a iniciarlo para ver un nuevo build. No edites `public/` a mano.

Todos los orígenes del build son rutas relativas internas. No necesita otro checkout, un disco concreto, Unity, una instalación de Codex ni los proyectos originales.

## Build y pruebas

```sh
npm run build
npm test
```

`npm test` reconstruye primero el sitio y ejecuta todas las pruebas con el runner incluido en Node. Las suites verifican matemáticas, gradientes por diferencias finitas, separación y hashes de los datos, modelos independientes, entrenamiento real, editores, guardado/recuperación, las tres imágenes del inspector, coches y recursos HTTP. Los servidores de prueba usan puertos efímeros de loopback y se cierran al terminar.

El build genera **60 recursos** mediante una lista explícita y escribe sus tamaños y SHA-256 en `publication-manifest.json`. El servidor valida esos archivos al arrancar y solo expone esa lista: no publica código del servidor, pruebas, Git, variables de entorno ni directorios completos. También comprueba rutas relativas, módulos y ambos Web Workers.

Para generar una salida separada dentro del repositorio:

```sh
node build.mjs --out=releases/local
```

Puedes alojar el contenido de `public/` en un servidor estático con HTTPS, manteniendo sus subcarpetas, tipos MIME y módulos/Workers del mismo origen. Para usar `server.mjs`, conserva también el manifiesto junto a `public/`. Las cabeceras de seguridad y la lista estricta del servidor Node no se configuran automáticamente en un proveedor estático. Este repositorio no incluye credenciales, configuración privada de infraestructura ni un despliegue automático.

## Datos MNIST

El subconjunto incluido contiene **3.000 imágenes de 16×16**, 300 por dígito: **2.000 entrenamiento**, **500 validación** y **500 test**, equilibradas por clase. Los identificadores originales y los hashes permiten comprobar duplicados y separación entre conjuntos. El test procede exclusivamente del conjunto test original de MNIST y solo se carga al abrir la evaluación final; después se congelan los modelos del experimento.

El test se distribuye como archivo estático para poder evaluarlo en el navegador. La reserva para evaluación final es una regla pedagógica del programa, no una medida para ocultar ese archivo. No utilices sus resultados para ajustar hiperparámetros.

Los datos ya están preparados: **no hace falta descargarlos ni regenerarlos para usar el curso o ejecutar las pruebas**. La regeneración opcional descarga los cuatro IDX oficiales, comprueba sus checksums y repite el muestreo y redimensionado deterministas:

```sh
npm run data:prepare
npm test
```

La caché de descargas queda en `.cache/`, excluida de Git. Consulta [procedencia, transformación y licencia](digits/data/PROVENANCE.md) y el [manifiesto de datos](digits/data/manifest.json). Es un subconjunto didáctico; sus métricas no son resultados del benchmark MNIST completo.

## Licencias y atribución

Se conserva la [licencia MIT](LICENSE) que ya existía en este repositorio, con copyright de Francisco Pons Ruiz. Las imágenes MNIST y su adaptación tienen su propia licencia **CC BY-SA 3.0** y atribución a **Yann LeCun, Corinna Cortes y Christopher J. C. Burges**, documentadas en [PROVENANCE.md](digits/data/PROVENANCE.md). La licencia del código no sustituye la de los datos.
