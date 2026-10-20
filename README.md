# Neural Labs

Un curso interactivo para entender las redes neuronales: de una sola neurona a reconocer dígitos y conducir coches. **Español e inglés**, con ejercicios visuales y entrenamiento real en el navegador.

**[Abrir la versión web](https://labs.jacksparrot.com/)** · [English](#english) · [Guía de desarrollo](docs/DEVELOPMENT.md)

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
| **03 · Coches** | Diseña circuitos y redes; observa cómo aprenden a conducir mediante selección y mutación. |

Usa **ES / EN** para cambiar el idioma. Los cálculos ocurren en tu navegador. Exporta tus experimentos para llevarlos a otro equipo o entre la web y el archivo portable.

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
| `course/`, `digits/`, `cars/` | Los tres capítulos y sus datos. |
| `shell/`, `i18n/` | Portada, navegación, estilos comunes y traducciones. |
| `scripts/` | Generación del HTML portable, build web, servidor y lanzadores. |
| `tests/` | Pruebas del curso; el taller de coches también tiene `cars/tests/`. |
| `docs/` | [Instrucciones técnicas, datos y publicación](docs/DEVELOPMENT.md). |

Edita las fuentes y regenera el HTML; no edites el archivo generado directamente. Incluye el HTML actualizado en los commits que cambien el curso.

## English

An interactive course about neural networks, from a single neuron to handwritten digits and self-driving cars. Switch between **English and Spanish** using **EN / ES**.

**No installation:** download the repository ZIP, extract it and double-click **`Neural-Labs.html`**. The single file contains all three chapters, training data and training code. It works offline, with no server or Node.js required.

**Development:** with Node.js 20+, run `npm ci`, `npm run build` and `npm test`. The build updates the portable HTML and creates `public/`. Use `npm start` to serve the web version locally. Source code is organized by chapter; build tools live in `scripts/`.

## Licencias · Licenses

Código: **[MIT](LICENSE)**. Imágenes MNIST y su adaptación: **CC BY-SA 3.0**, de Yann LeCun, Corinna Cortes y Christopher J. C. Burges. Consulta la [procedencia y atribución](digits/data/PROVENANCE.md).
