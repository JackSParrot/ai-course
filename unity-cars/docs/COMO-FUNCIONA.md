[Volver al proyecto](../README.md)

# Del entrenamiento al juego: ¿dónde están los pesos y quién los ejecuta?

**Lo aprendido se conserva como números. El juego carga esos números y utiliza código para calcular qué hacer con las entradas de cada momento.** Entrenar, guardar y ejecutar son tres pasos distintos. Este laboratorio permite verlos sin necesitar un servicio de IA.

## «Ya he entrenado la red. ¿Qué tengo que guardar?»

En este ejemplo guardamos dos archivos que deben viajar juntos:

| Archivo | Qué contiene | Ejemplo |
| --- | --- | --- |
| `network.json` | La descripción de la red y cómo interpretar sus entradas y salidas. | Cinco sensores, una capa intermedia de seis neuronas, cuatro salidas, activación y escala de las distancias. |
| `weights.json` | Los parámetros: pesos de las conexiones y sesgos de las neuronas. | Los 64 números ajustables de esta red. |

Los dos comparten un identificador, `modelId`, para evitar mezclar la descripción de una exportación con los pesos de otra. Guardar no almacena el coche, un vídeo de su recorrido ni el programa C#. Tampoco guarda una sesión completa de entrenamiento: aquí se exporta una red para volver a usarla.

Mientras conduce, los valores de los sensores y las activaciones cambian. **Los pesos permanecen fijos durante la inferencia.** El entrenamiento es el proceso que los modifica; aquí lo hace mediante selección y mutación de redes.

## «¿Cómo se ejecuta ese archivo dentro de Unity?»

Un archivo de pesos necesita código que lo interprete. En este proyecto:

1. [`ModelFiles.Load`](../Assets/NeuralCars/Runtime/Persistence/ModelFiles.cs) lee ambos JSON, comprueba su compatibilidad y construye una `NeuralNetwork` con esos parámetros.
2. [`NeuralCar.Step`](../Assets/NeuralCars/Runtime/Simulation/NeuralCar.cs) mide cinco distancias a los bordes y las divide por 220, igual que durante el entrenamiento.
3. [`NeuralNetwork.Infer`](../Assets/NeuralCars/Runtime/Core/NeuralNetwork.cs) pasa esas entradas por las capas; [`Neuron.Infer`](../Assets/NeuralCars/Runtime/Core/Neuron.cs) realiza los cálculos de cada neurona.
4. El coche interpreta las cuatro salidas como acelerar, frenar, izquierda y derecha. Una salida superior a 0,5 activa su control; el código del juego aplica el movimiento.

```text
Al cargar:   network.json + weights.json → crear la red en memoria
Al conducir: sensores actuales → ejecutar la red → controles → mover el coche
```

Este fragmento utiliza las clases reales del proyecto; `carpetaDelModelo` es la carpeta que muestra **Guardar red**:

```csharp
NeuralNetwork red = ModelFiles.Load(carpetaDelModelo); // Se carga una vez.

// En cada decisión, el juego obtiene otras cinco distancias normalizadas.
float[] entradas = { 0.4f, 0.7f, 1.0f, 0.6f, 0.3f };
float[] salidas = red.Infer(entradas);
bool acelerar = salidas[0] > 0.5f;
// El juego interpreta también freno, izquierda y derecha y aplica la física.
```

`Infer` reutiliza su array de salida: si necesitas conservar una decisión para compararla más tarde, copia esos valores antes de la siguiente llamada. El recorrido completo, incluidos los controles que tienen prioridad, está en `NeuralCar.Step`.

[`LabController`](../Assets/NeuralCars/Runtime/LabController.cs) es el componente de Unity que conecta todo con los botones y el tiempo del juego. **No necesitas mantener el entrenador ejecutándose para conducir con una red ya entrenada.** El ejecutable contiene el código; los archivos proporcionan los parámetros.

## «¿Necesito un plugin? ¿Sirve cualquier archivo de IA?»

Para esta red pequeña hemos escrito el cálculo en C# normal. No requiere un plugin de IA. Unity lee los JSON con `JsonUtility`, que convierte datos entre texto y objetos; quien ejecuta la red es nuestro código C#.

**JSON es un contenedor de datos, no un formato universal de redes.** Un JSON de otra herramienta puede tener otra estructura y otras operaciones. No basta con cambiarle el nombre a `weights.json`.

Si entrenas en otra herramienta, debes exportar un modelo que el código o runtime de destino pueda interpretar: arquitectura, operaciones, pesos y convenciones de entrada y salida compatibles. [ONNX](https://onnx.ai/onnx/intro/concepts.html) es un formato de intercambio para modelos compatibles; necesita un runtime que soporte sus operaciones. Este ejercicio utiliza su propio esquema legible y no incluye ONNX. El [README](../README.md#es-json-un-formato-universal-de-ia) amplía esa distinción.

En un proyecto Godot con C# puedes reutilizar `Neuron` y `NeuralNetwork`, que no dependen de Unity. Debes adaptar la lectura de archivos, los sensores y el movimiento al motor. Conservar los pesos no garantiza el mismo resultado si cambian la física, las unidades o el entorno. Tampoco se importan directamente los modelos del taller web: utiliza otro esquema y otros circuitos.

## Una comprobación que puedes hacer tú

1. Abre `unity-cars` con Unity 6000.6.2f1, abre la escena y pulsa **Play**; o inicia el juego ya compilado. Los [pasos de apertura](../README.md#abrir-y-ejecutar) y la [guía Android](ANDROID.md) explican cómo.
2. Pulsa **Cargar ejemplo → Ejecutar → Pausar**. Es una red ya entrenada incluida con el juego.
3. Pulsa **Guardar red → Ver archivos**. En escritorio se abre su carpeta; en Android encontrarás ambos JSON dentro de **Red y archivos**. La interfaz muestra la ruta exacta del guardado.
4. Pulsa **Pesos al azar** y observa que cambia el comportamiento.
5. Pulsa **Cargar carpeta → Ejecutar** para recuperar el modelo que guardaste.
6. Cierra y abre la aplicación. Recuerda la última carpeta exportada; vuelve a pulsar **Cargar carpeta**. Así compruebas que la red sobrevive al cierre del programa.
7. **Comparar original y recargada** reconstruye otra red a partir de los JSON en memoria y compara las salidas para las mismas entradas. Debe mostrar diferencia cero o insignificante por redondeo. Este botón comprueba la serialización; los pasos anteriores comprueban además el guardado real en disco.

No tienes que entrenar de nuevo cada vez que abres el juego. Si quieres ver quién cambia los pesos, sigue [Entrenar desde cero](../README.md#entrenar-desde-cero). Una red que conduce bien por el óvalo aún puede fallar en otro circuito.

## English

**Learned parameters are numbers. Game code loads them and calculates actions from the current inputs.** Training, saving and running inference are separate steps.

- **What is saved?** `network.json` describes architecture and input/output conventions; `weights.json` contains the 64 weights and biases. Their `modelId` must match. This exports a network, not the C# program, car position, driving recording or complete training session.
- **Who runs it?** `ModelFiles.Load` reconstructs a `NeuralNetwork`. `NeuralCar.Step` reads five distances, divides them by 220 and calls `NeuralNetwork.Infer`. Each `Neuron.Infer` performs its calculation; four outputs activate acceleration, braking, left and right above 0.5. The game applies movement. `LabController` connects this to Unity. Load once, then infer for each decision. The returned output buffer is reused; copy it if retaining a past decision.
- **Does driving keep training?** No. Sensors and activations change, while weights stay fixed during inference. `GeneticTrainer` modifies parameters through selection and mutation. Driving a saved model does not need the trainer running.
- **Is a plugin required?** This small network runs in ordinary C#. Unity's `JsonUtility` handles serialization, not inference. JSON is not a universal model schema. Exporting from another training tool requires compatible architecture, operations, parameters and input/output conventions. ONNX is a model exchange format requiring a compatible runtime; this lab uses its own readable schema.
- **Can it move to Godot?** The `Core` C# classes are engine independent. Adapt JSON loading, sensors and movement. Different physics or units can change the result. Web workshop exports use a different schema and cannot be imported directly.

Try **Load example → Run → Pause**, then **Save network → Open files**. Desktop opens the folder; Android shows the full JSON in **Network and files**. Choose **Random weights**, then **Load folder → Run** to recover the saved model. Close and reopen the application and load the remembered folder again. **Compare original and reloaded** checks a separate in-memory JSON round trip for identical inputs; saving, replacing and loading tests disk persistence. There is no need to retrain on every launch, and oval success does not guarantee success on a different track.

See the [project README](../README.md#english) for opening Unity, the code reading order and training, and the [Android guide](ANDROID.md) for mobile usage and builds.
