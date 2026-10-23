# Neural Cars en Android

Identidad: `com.jacksparrot.neuralcars` · versión inicial **1.0.0**, código **1**. Compatible con Android 8.0/API 26 o posterior, ARM de 32 y 64 bits.

## Uso

La app se utiliza en horizontal y funciona sin conexión. **Conducir y entrenar** muestra el circuito, los controles y el entrenamiento. **Red y archivos** abre los sensores, las neuronas y el guardado. Desliza para recorrer cada vista.

Pulsa **Cargar ejemplo → Ejecutar** para ver el coche entrenado. En **Red y archivos**, pulsa **Guardar red** y después **Ver archivos**: los JSON completos se muestran dentro de la app. **Comparar original y recargada** comprueba sus salidas para las mismas entradas.

Se conserva la carpeta del último modelo exportado al cerrar la app. **Cargar carpeta** permite recuperarlo después de volver a abrirla. Los archivos están en el almacenamiento propio de la aplicación, bajo `Application.persistentDataPath/Models`; no se requiere un servicio ni acceso general al almacenamiento del teléfono.

## Compilar e instalar

1. Instala **Android Build Support**, SDK/NDK y OpenJDK para Unity **6000.6.2f1**.
2. Selecciona Android y usa **Neural Cars → Build Android APK**. El resultado queda en `Builds/Android/neural-cars-1.0.0-1.apk`.
3. Para una actualización, incrementa `AndroidBuild.VersionCode` y ajusta la versión y las notas. Conserva la identidad de paquete y firma existentes.
4. Copia el APK al teléfono, ábrelo y permite la instalación desde esa fuente cuando Android lo solicite. También puedes instalarlo en un dispositivo o emulador conectado con `adb install -r Builds/Android/neural-cars-1.0.0-1.apk`.

El método de compilación utiliza la firma de depuración del equipo para este ejercicio. Una instalación existente solo se actualiza conservando el paquete y el certificado de firma. Cada equipo puede tener un certificado de depuración distinto. Para distribuir tu propia aplicación, configura tu identidad y firma en Unity. Las claves privadas y los APK generados no forman parte del repositorio.

## English

Package `com.jacksparrot.neuralcars`, first version **1.0.0 / code 1**. Android 8.0/API 26+, ARM32 and ARM64.

Use landscape orientation. **Drive and train** shows the track and training; **Network and files** shows inference and persistence. Swipe to scroll. **Load example → Run** starts the trained network. Save it, then **Open files** to read both complete JSON files inside the app. The last export folder persists across application restarts. **Load folder** recovers it; **Compare original and reloaded** compares outputs for identical inputs. Simulation, training and saving work offline in application-owned storage.

Install the matching Unity Android module, SDK/NDK and OpenJDK; use **Neural Cars → Build Android APK**. Copy the APK to your phone and open it, or install on a connected device/emulator using `adb install -r Builds/Android/neural-cars-1.0.0-1.apk`. Increment the version code for updates and preserve the package and certificate. This educational build method uses the workstation's debug certificate, which can differ between machines. Configure your own identity and signing settings in Unity for your own distribution. Private signing keys and generated APKs are excluded from the repository.
