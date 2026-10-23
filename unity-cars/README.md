# Neural Cars · Unity

Un laboratorio 2D para ver **qué es código, qué son los pesos y cómo se usa una red entrenada dentro de un juego**. C# pequeño y legible, sin librerías de IA ni servicios externos. Interfaz en español e inglés.

Empieza por la [guía explicativa: del entrenamiento al juego](docs/COMO-FUNCIONA.md). Responde dónde se guarda lo aprendido, quién lo ejecuta y qué hace falta para llevarlo a otro motor. Este README contiene el recorrido completo y los detalles opcionales del código.

## Abrir y ejecutar

1. En Unity Hub, **Add → Add project from disk** y selecciona **esta carpeta `unity-cars`**, no la raíz del curso.
2. Usa **Unity 6.6 / 6000.6.2f1**, la versión del proyecto. La primera apertura descarga los paquetes normales de Unity.
3. Abre `Assets/NeuralCars/Scenes/NeuralCars.unity` y pulsa **Play**. El menú **Neural Cars → Open laboratory** también abre la escena; si falta, la crea.
4. Pulsa **Cargar ejemplo** y **Ejecutar** para ver una red ya entrenada. **Pausar** y **Un paso** permiten observar el proceso con calma.
5. **Neural Cars → Build Windows** genera el ejecutable en `Builds/Windows/NeuralCars.exe`. Distribuye **toda** esa carpeta, incluyendo los datos del juego y sus DLL.

Tras descargar las dependencias, la simulación, el entrenamiento y el guardado funcionan localmente. El juego construido no necesita Unity instalado ni conexión. No hacen falta cuentas de una API, un servidor Python ni una GPU para la red.

## La duda que resuelve

**«He entrenado una IA en una herramienta. ¿Cómo llevo lo aprendido a Unity o Godot? ¿Es un archivo estándar? ¿Necesito un plugin?»**

Hay tres piezas:

| Pieza | Aquí | Para qué sirve |
| --- | --- | --- |
| Código que ejecuta la red | [`Neuron.cs`](Assets/NeuralCars/Runtime/Core/Neuron.cs) y [`NeuralNetwork.cs`](Assets/NeuralCars/Runtime/Core/NeuralNetwork.cs) | Multiplica entradas por pesos, suma sesgos, aplica la activación y conecta las capas. |
| Descripción del modelo | `network.json` | Indica capas, activación, significado y orden de entradas y salidas, escala y umbral. |
| Parámetros aprendidos | `weights.json` | Contiene los pesos de cada conexión y los sesgos de cada neurona. |

La red no tiene por qué ser un componente especial del motor. Aquí es una **clase C# normal**. [`LabController`](Assets/NeuralCars/Runtime/LabController.cs) es el componente Unity que conecta los botones y el tiempo del juego con la simulación. [`NeuralCar`](Assets/NeuralCars/Runtime/Simulation/NeuralCar.cs) traduce las distancias a entradas y las salidas a controles.

Los pesos no son código ejecutable ni una lista de rutas memorizadas. Son números. Un archivo de pesos necesita código que sepa interpretarlo y las mismas convenciones que se usaron al entrenar. Cambiar el orden de los sensores puede producir otro comportamiento aunque el número de entradas coincida.

## El recorrido de una decisión

```text
Circuito → cinco distancias → dividir por 220 → NeuralNetwork.Infer
          → Neuron.Infer en cada capa → cuatro salidas → umbral > 0,5
          → acelerar / frenar / izquierda / derecha → mover el coche
```

En `Neuron.Infer`, una neurona hace esto:

```csharp
float sum = bias;
for (int i = 0; i < weights.Length; i++)
    sum += inputs[i] * weights[i];
return (float)(1 / (1 + Math.Exp(-sum)));
```

No hace falta calcularlo a mano: pulsa una neurona en el diagrama y observa sus números. La red **5 → 6 → 4 tiene 64 parámetros**: 30 pesos y 6 sesgos en la capa oculta, 24 pesos y 4 sesgos en la salida. Las activaciones que cambian al conducir son resultados temporales; no son nuevos pesos.

El freno tiene prioridad sobre el acelerador. Izquierda y derecha simultáneas se cancelan. Los coches no chocan entre sí. La física avanza a pasos fijos de 1/60 s: el selector de ritmo cambia cuántos pasos se intentan por segundo real, sin agrandar el paso. El equipo puede limitar el ritmo efectivo.

## Ejercicio de diez minutos: demostrar el guardado

1. **Cargar ejemplo → Ejecutar → Pausar**. Mira sensores, salidas y pesos. Los sensores cambian; los pesos permanecen iguales.
2. **Guardar red**. **Ver archivos** abre la carpeta en escritorio; en Android muestra `network.json` y `weights.json` completos dentro de la app, en la vista **Red y archivos**.
3. Lee ambos archivos, en un editor de texto o dentro de la app Android. La descripción y los pesos comparten `modelId`: deben viajar juntos.
4. **Comparar original y recargada** serializa la red actual, crea otra instancia a partir de ambos JSON y les pasa las mismas cinco entradas. La diferencia máxima debe ser cero o insignificante por redondeo numérico.
5. **Pesos al azar → Ejecutar**. El comportamiento cambia.
6. **Cargar carpeta** recupera los archivos de la ruta que aparece en pantalla. **Repetir salida → Ejecutar** repite el comportamiento cargado.
7. Cierra y abre el juego. La última carpeta guardada queda recordada: pulsa **Cargar carpeta**. También puedes pegar la ruta de otra exportación. Lo aprendido no dependía de que el entrenador siguiera vivo.
8. **Cambiar circuito** conserva los pesos y cambia el entorno. Un buen resultado en el óvalo no garantiza conducir bien en otro circuito.

El botón de comparar realiza una ida y vuelta en memoria. Los pasos de guardar, cambiar de red y cargar carpeta comprueban por separado el recorrido por disco.

Los archivos se guardan en una nueva subcarpeta de `Application.persistentDataPath/Models` en cada exportación. En Windows normalmente está bajo `%USERPROFILE%/AppData/LocalLow/Neural Labs/Neural Cars/Models`. La ruta exacta aparece en la interfaz. **Se guarda el campeón evaluado en modo entrenamiento y el coche actual en modo inferencia.** No se guarda la población completa, su historial, el estado del coche ni el estado aleatorio para reanudar una búsqueda.

La exportación escribe primero una carpeta temporal y solo publica la carpeta definitiva al completar ambos archivos. No sobrescribe exportaciones anteriores. La carga valida versión, dimensiones, valores finitos, identidad de los archivos y el contrato de sensores y acciones antes de sustituir la red actual.

## Entrenar desde cero

1. **Nueva población** crea 24 redes aleatorias con semilla 42.
2. **Ejecutar** evalúa cuánto avanzan por el óvalo. **Pausar** y **Un paso** funcionan también aquí.
3. Al terminar una evaluación, **Siguiente generación** conserva dos élites, crea veinte copias mutadas a partir de las seis mejores redes y añade dos redes nuevas. **Ejecutar** evalúa esa generación.
4. **Automático** repite evaluación y reproducción; el ritmo ×8 o ×64 permite acelerar según la capacidad del equipo.
5. **Usar campeón** copia la mejor red a un solo coche y pasa a inferencia. Entonces puedes probar y guardar esa red.

El entrenador recibe una puntuación del entorno, no las acciones correctas de un conductor. **No hay corrección del error ni retropropagación dentro de `Neuron`.** El entrenamiento genético ajusta pesos y sesgos desde [`GeneticTrainer`](Assets/NeuralCars/Runtime/Training/GeneticTrainer.cs); la inferencia no depende del entrenador. Entrenar una red de otra manera también puede terminar produciendo pesos que se ejecuten así.

La puntuación es `1000 × mejor fracción de vuelta`, con 200 puntos por completar, hasta 100 por rapidez al completar, −25 por choque y −15 por quedarse sin avance durante tres segundos. Se termina al chocar, completar una vuelta, quedarse sin avance o llegar a 22 segundos simulados. Retroceder y recuperar el mismo terreno no acumula recompensa. Los puntos del recorrido solo los utiliza el evaluador; la red recibe exclusivamente sus cinco sensores.

El ejemplo incluido se genera con **Neural Cars → Train bundled example (seed 42)**. Los JSON y `training-record.json` están en `Assets/NeuralCars/Resources/Example`. Ese registro identifica el presupuesto y resultado de la búsqueda. No es una promesa de generalización. El segundo circuito se excluye del entrenamiento; si utilizas su resultado para ajustar o elegir modelos, pasa a ser validación y necesitarás otro circuito para una prueba final.

## ¿Es JSON un formato universal de IA?

**JSON es un formato de datos; no define cómo representar una red neuronal.** Estos dos archivos usan un esquema propio, documentado en [`ModelFiles.cs`](Assets/NeuralCars/Runtime/Persistence/ModelFiles.cs). Unity los lee con su `JsonUtility`, que serializa datos pero no ejecuta redes. Newtonsoft.Json sería otra herramienta de serialización, no un motor de inferencia.

Existe [ONNX](https://onnx.ai/onnx/intro/concepts.html), un formato de intercambio de modelos que describe operaciones, conexiones y parámetros. Para ejecutar uno necesitas un runtime compatible con las operaciones y la versión del modelo. ONNX no convierte cualquier fichero de pesos en algo utilizable automáticamente. **Este proyecto no necesita ni incluye ONNX** porque toda su red cabe en dos clases legibles.

Para una red pequeña puedes escribir el cálculo como aquí. Para modelos grandes suele resultar más práctico exportar desde la herramienta de entrenamiento y usar un runtime compatible. En ambos casos se mantienen el significado, el orden y la escala de entradas y salidas.

En Godot puedes trasladar las dos clases de `Core` a un proyecto C# y adaptar la lectura JSON y el movimiento al motor. No necesitas reentrenar si conservas exactamente la red, los sensores, las unidades y las convenciones. Una física o un entorno diferentes sí pueden cambiar el resultado.

Referencias: [serialización JSON en Unity](https://docs.unity3d.com/6000.0/Documentation/Manual/JSONSerialization.html) y [conceptos de ONNX](https://onnx.ai/onnx/intro/concepts.html).

## Leer el código sin perderse

| Orden | Archivo | Pregunta |
| --- | --- | --- |
| 1 | `Runtime/Core/Neuron.cs` | ¿Qué hace una neurona con sus pesos? |
| 2 | `Runtime/Core/NeuralNetwork.cs` | ¿Cómo conecta varias capas? |
| 3 | `Runtime/Simulation/NeuralCar.cs` | ¿Cómo llegan los sensores y cómo se mueve el coche? |
| 4 | `Runtime/Persistence/ModelFiles.cs` | ¿Qué se escribe y cómo se reconstruye una red? |
| 5 | `Runtime/Training/GeneticTrainer.cs` | ¿Quién cambia los parámetros y cuándo? |
| 6 | `Runtime/LabController.cs` | ¿Qué componente enlaza todo con Unity? |
| Opcional | `Runtime/Presentation/` | ¿Cómo se dibujan la pista, los sensores y el inspector? |

Todas las rutas de la tabla parten de `Assets/NeuralCars/`. `Neuron` y `NeuralNetwork` solo utilizan C# estándar. No contienen referencias a Unity. El resto separa simulación, entrenamiento, persistencia y presentación. El dibujo usa UI Toolkit; no se requiere arte descargado.

Es una adaptación didáctica del capítulo de coches: conserva sensores de reloj, red sigmoide, acciones, selección y mutación. Simplifica el taller a un óvalo de entrenamiento, un circuito reservado y una topología inicial. **No importa directamente los campeones exportados por el taller web**: su esquema, configuración y circuitos son distintos. La explicación del cálculo es compartida.

## Comprobar el proyecto

En **Window → General → Test Runner → EditMode → Run All**, la suite `NeuralCars.Tests` comprueba cálculo, conservación de parámetros, ida y vuelta JSON/disco, datos incompatibles, errores de guardado, sensores, determinismo y élites. El registro de validación de esta entrega está en [`VALIDATION.md`](VALIDATION.md).

Código bajo licencia MIT, igual que el repositorio principal.

## Android

La versión Android utiliza dos vistas táctiles en horizontal y permite consultar los JSON dentro de la app. Conserva la carpeta del último guardado entre sesiones. Consulta la [guía de uso y compilación para Android](docs/ANDROID.md).

---

## English

This 2D lab answers: **what is code, what are learned weights, and how does a game use them?** Open this `unity-cars` folder in Unity **6000.6.2f1**, open `Assets/NeuralCars/Scenes/NeuralCars.unity`, press Play, then **ES / EN**. Choose **Load example → Run**. **Neural Cars → Build Windows** produces a standalone Windows game; distribute its entire output folder. The first Editor import needs Unity packages; the built game runs locally and offline.

Start with the [explanatory guide: from training to the game](docs/COMO-FUNCIONA.md#english) for the short explanation of stored parameters, execution and moving a model between engines.

### Three pieces

- `Neuron.cs` / `NeuralNetwork.cs`: ordinary C# code performing inference. They do not depend on Unity or an AI library.
- `network.json`: architecture, sigmoid activation, ordered sensor/action meanings, normalization and threshold.
- `weights.json`: connection weights and neuron biases. Both files share a `modelId` and must match.

Five distances, looking toward 10, 11, 12, 1 and 2 o'clock, are divided by 220 and passed to a **5 → 6 → 4** network. Its **64 parameters** are fixed during driving. The four outputs trigger acceleration, braking, left and right above **0.5**. Braking wins over acceleration; opposite turns cancel. Fixed simulation steps are 1/60 second regardless of playback speed. Cars do not collide with each other.

Click a neuron to see its weights, bias, weighted sum and sigmoid output. Changing activations are temporary results, not learning. `LabController` is the Unity component connecting the lab to the engine; `NeuralCar` converts sensors to inputs and outputs to motion.

### Save/load exercise

1. **Load example → Run → Pause**; observe changing inputs and fixed weights.
2. **Save network → Open files**; inspect the two complete, readable JSON files. Desktop opens their folder; Android displays their contents inside **Network and files**.
3. **Compare original and reloaded** reconstructs a separate network in memory and compares outputs for identical inputs.
4. **Random weights** changes the network; **Load folder** recovers the files on disk. Restart and drive again.
5. Restart the application and **Load folder**: the last saved folder is remembered. You can also paste another export's path.
6. **Switch track** keeps the weights and changes the environment. Training success does not guarantee generalization.

Each save creates a new folder under `Application.persistentDataPath/Models`; the UI shows the exact path. On Windows this is normally `%USERPROFILE%/AppData/LocalLow/Neural Labs/Neural Cars/Models`. A staging folder prevents partial exports from appearing as complete ones. Previous exports are not overwritten. Loading validates versions, dimensions, finite numbers, paired IDs and input/output conventions before replacing the current model. Saving exports the evaluated champion during training, or the current car in inference. It does not save the full population, random state, history or car position.

### Train

Choose **New population → Run**. Each generation evaluates 24 networks on the oval. **Next generation** keeps 2 elites, mutates 20 copies of parents selected from the top 6, and introduces 2 random networks. **Automatic** repeats; ×8/×64 increase the requested pace within the machine's capacity. The deterministic initial seed is 42. **Use champion** copies the best evaluated network into inference mode.

The score rewards best forward progress, completing a lap and completing quickly; it penalizes collisions and three seconds without progress. An attempt ends on collision, a lap, stalling, or 22 simulated seconds. Retracing old ground does not farm progress. Only the evaluator sees route coordinates; the neural network sees five distances. **Training uses selection and mutation, not error backpropagation.** `GeneticTrainer` changes parameters; `Neuron.Infer` never trains.

The bundled JSON example is genuinely evolved using **Neural Cars → Train bundled example (seed 42)**. Its `training-record.json` records the run. The second circuit is excluded from training. If you tune models based on its result, it becomes validation and a fresh track is needed for a final test.

### Formats and engines

JSON is a data container, not a universal neural model schema. This example defines its own schema in `ModelFiles.cs`; Unity's `JsonUtility` serializes it but does not run inference. Newtonsoft.Json would also only handle serialization.

[ONNX](https://onnx.ai/onnx/intro/concepts.html) is a model exchange format describing operations, connections and parameters. Executing it requires a runtime supporting the model's operations and version. This tiny educational network uses its own readable C# code instead. Larger models usually benefit from an existing compatible runtime.

To use this model in a C# Godot project, move the engine-independent `Core` classes and adapt file loading and the driver. Preserve architecture, input/action order, scaling and activation. Different physics or environments can still change behavior.

Read `Neuron` → `NeuralNetwork` → `NeuralCar` → `ModelFiles` → `GeneticTrainer` → `LabController`. Presentation is optional reading. This lab simplifies the web workshop to an oval, one held-out track and an initial topology. It does not directly import web champions, whose schema and environment differ.

Use **Window → General → Test Runner → EditMode → Run All** to run `NeuralCars.Tests`. See [`VALIDATION.md`](VALIDATION.md) for delivery evidence. Source is MIT licensed.

**Android:** the landscape mobile interface separates driving/training from the network/files inspector. Saved JSON files can be read inside the app, and the last export folder persists between sessions. See the [Android guide](docs/ANDROID.md) for usage and building.
