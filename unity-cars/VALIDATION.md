# Validación · 23 de octubre de 2026

Proyecto: Unity **6000.6.2f1**, Windows, URP, UI Toolkit. Escena: `Assets/NeuralCars/Scenes/NeuralCars.unity`.

## Comprobaciones realizadas

- **22/22 pruebas EditMode dentro de Unity.** Cálculo de una neurona, 64 parámetros, inferencia sin modificar pesos, JSON y disco, identidad y compatibilidad de archivos, datos inválidos, copia independiente, fallo de guardado, sensores, determinismo y conservación de élites. Incluye una vuelta del modelo distribuido.
- **19/19 comprobaciones en Play mode.** Eventos de puntero sintéticos de UI Toolkit accionaron los botones de ejemplo, guardado, red aleatoria, carga, comparación, paso, población, automático, generaciones, campeón, circuito e idioma. Se verificó también que un fallo al cargar conservase la red actual. Son pruebas automatizadas de la interfaz, no una sesión manual de un alumno.
- **Entrenamiento real en el editor.** Semilla 42, población 24, generación 4: el campeón completó el óvalo sin chocar con **1253,967 puntos**. Los archivos finales fueron generados por `ExampleTraining` dentro de Unity. Su registro está junto a los JSON en `Resources/Example/training-record.json`.
- **Inferencia tras guardar y cargar.** Se guardaron ambos JSON, se sustituyó la red por otra aleatoria y se recuperó desde disco. Los parámetros coincidieron. Para las mismas entradas, la diferencia máxima entre la red original y la reconstruida fue **0**.
- **Ejecución y revisión visual.** Se comprobó que avanzaba el contador de frames y se inspeccionaron capturas a 1600 × 1000 en español e inglés. Se corrigieron la conexión del panel, el espacio entre textos y el desplazamiento del inspector.
- **Compilación Windows desde una copia limpia.** Se copió únicamente el proyecto distribuible, sin `Library`, herramientas de automatización ni archivos de comprobación. Unity importó sus dependencias y generó `NeuralCars.exe` y su carpeta de datos con salida satisfactoria.
- **Arranque del ejecutable.** Se inició la compilación Windows con un registro propio y se comprobó la inicialización de gráficos, entrada y escena, sin excepciones del juego. El recorrido de botones y la vuelta completa se probaron en el editor; no se presenta este arranque como una partida manual del ejecutable.
- **Revisión de archivos.** Los recursos tienen sus `.meta`; las capturas, registros, descargas y cachés quedan fuera del proyecto distribuible. El proyecto solo depende de los paquetes de Unity para entrada, URP, UI y pruebas. No necesita un plugin de inferencia ni un servicio externo.

El análisis estático de rendimiento señaló tres coincidencias de `Mathf.Min` / `Mathf.Max` como si fueran LINQ. Se revisaron: son operaciones matemáticas escalares, sin enumeradores. La inferencia reutiliza sus buffers; la presentación actualiza textos diez veces por segundo.

## Alcance de la evidencia

El campeón demuestra una vuelta en el **óvalo de entrenamiento**. No demuestra generalización al circuito reservado, a otros circuitos ni a otra física. No se ha realizado una prueba con el público de las charlas.

La versión web y su HTML portable no se modificaron. Este proyecto es un acompañamiento independiente y usa un esquema de archivos propio; no importa directamente los campeones del taller web.

## English

Validated on **Unity 6000.6.2f1 / Windows**, with URP and UI Toolkit:

- **22/22 EditMode tests** inside Unity, including the bundled model completing a lap.
- **19/19 Play mode checks** using synthetic UI Toolkit pointer events and the actual simulation. This is automated interaction, not a manual learner playtest.
- The real Editor training run used seed 42 and 24 networks; generation 4 completed the training oval without crashing, scoring **1253.967**. Final JSON files were generated inside Unity.
- Saving, replacing the network and loading from disk recovered its parameters; identical inputs produced a maximum output difference of **0** after JSON reconstruction.
- Advancing frames and Spanish/English screenshots at 1600 × 1000 were verified. Panel attachment, spacing and scrolling were corrected.
- A clean copy without caches, authoring automation or verification files successfully imported and built the Windows player.
- The standalone player launched and initialized graphics, input and scene without game exceptions in its log. The full button exercise and lap were tested in the Editor; the standalone startup is not claimed as a manual playthrough.
- Assets retain their `.meta` files. Only normal Unity input/render/UI/test packages remain; no inference plugin or external service is required.

Training-oval success does not establish generalization to the held-out track, other tracks or different physics. Learner acceptance has not been tested. The browser course and portable HTML are unchanged. This companion uses its own file schema and does not directly import web champions.

## Android · 1.0.0 / 1

- Compilación IL2CPP satisfactoria con Unity 6000.6.2f1: paquete `com.jacksparrot.neuralcars`, ARMv7 y ARM64, Android mínimo 26 y destino 36. APK de **48.858.666 bytes**. La compilación terminó con 0 errores y 6 avisos; el tamaño total del informe de Unity incluye productos adicionales y no es el tamaño del APK.
- **22/22 pruebas EditMode** en la copia utilizada para Android. La última corrección posterior solo afecta al tamaño del panel de la interfaz.
- Instalación y ejecución del APK final en un emulador Android 15/API 35, pantalla horizontal 2712 × 1220, con traducción ARM64. Se accionaron controles mediante toques y deslizamientos de Android: ambas vistas, desplazamiento, cargar ejemplo, ejecutar, guardar, cargar, comparar, ver los JSON e idioma ES/EN.
- El ejemplo terminó la vuelta: **100,2 % de avance en 10,5 s**. Se guardaron los dos JSON y se extrajeron del almacenamiento de la app para inspección. La comparación mostró diferencia máxima **0**.
- Con modo avión activado, se cerró el proceso, se abrió de nuevo y se recuperó la carpeta persistida. Tras cargarla, la comparación volvió a mostrar **0**. Los JSON completos se visualizaron dentro de la app.

Las capturas y los informes de compilación están en `Verification` y `Builds/Android`, ambos excluidos de la distribución del proyecto. No se ha probado en un teléfono físico. El registro inicial contiene una consulta opcional de Unity a Play Asset Delivery, no utilizado por este APK; no se observó cierre fatal durante el recorrido.

### Android validation (English)

The final IL2CPP APK (48,858,666 bytes, ARM32/64, minimum API 26, target 36) built successfully with zero errors and six warnings. All 22 EditMode tests passed on the Android staging project; the final subsequent change only fixes UI panel sizing. Real Android touch/swipe commands exercised both views, scrolling, example inference, saving/loading, comparison, JSON viewing and ES/EN on an Android 15/API 35 emulator with ARM64 translation. The example completed a lap (100.2%, 10.5 seconds). After saving, force-stopping and relaunching in airplane mode, the persisted folder loaded successfully and output comparison again showed a maximum difference of zero. This is emulator evidence, not a physical-device test. Unity's optional Play Asset Delivery probe appears in startup logs; no fatal exit was observed during these checks.
