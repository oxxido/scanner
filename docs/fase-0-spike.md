# Fase 0 · Spike de escaneo — informe

**Estado:** investigación documental hecha y prueba mínima escrita. Faltan las pruebas en dispositivo
(sección 8). La decisión de librería es provisional hasta rellenar esa tabla.

**Fecha:** octubre de 2026 · Expo SDK 57 (React Native 0.86), New Architecture obligatoria.

---

## 1. Decisión propuesta

1. **Enfoque:** usar el escáner del sistema — VisionKit en iOS y ML Kit Document Scanner en Android —
   envuelto en `scanner-core`. Nada de visión artificial propia en el MVP.
2. **Librería para Fases 1–2:** `@dariyd/react-native-document-scanner` (motor B), detrás de `ScannerAdapter`.
3. **Reserva preparada:** `react-native-document-scanner-plugin` (motor A). Su adaptador ya está en el spike.
   Como `scanner-core` elige adaptador en tiempo de ejecución, se puede usar uno distinto por plataforma
   si alguno falla solo en iOS o solo en Android.
4. **Previsión para Fases 3 y 5:** módulo Expo propio y pequeño (Swift + Kotlin) para lo que ningún
   wrapper ofrece: corrección de perspectiva con esquinas manuales y detección en fotos importadas.

**Por qué B y no A.** Los dos envuelven los mismos motores (VisionKit y ML Kit), así que con la misma
configuración la calidad de detección y recorte debería ser equivalente. La diferencia está en lo que
exponen:

| | A · plugin | B · @dariyd |
|---|---|---|
| Calidad JPEG | ✅ | ✅ |
| Límite de páginas | Solo Android | Solo Android |
| Modo ML Kit (base / filtros / completo) | ❌ | ✅ |
| Importar de galería (Android) | ❌ | ✅ |
| Tamaño máximo de salida | ❌ (hay que redimensionar después) | ✅ maxWidth / maxHeight |
| Devuelve ancho, alto y peso | ❌ (solo rutas) | ✅ |
| Config plugin de Expo | ✅ oficial | ❌ (Info.plist vía `app.json`, suficiente) |
| New Architecture | TurboModule en ambas | iOS TurboModule · Android bridge clásico vía interop |
| Comunidad | ~460 ★, 46 issues abiertas | ~39 ★, un mantenedor, usada en apps publicadas |

La estrategia de tamaño de archivo (sección 7) y la decisión sobre filtros dependen de opciones que solo
expone B. El punto débil de B es el mantenimiento y el bridge clásico en Android; si el spike muestra
problemas ahí, se usa A en Android y se redimensiona después con `expo-image-manipulator`.

---

## 2. Alternativas evaluadas

| Opción | Qué es | Veredicto |
|---|---|---|
| **A** `react-native-document-scanner-plugin` | Wrapper VisionKit + ML Kit, TurboModule, config plugin Expo | Reserva |
| **B** `@dariyd/react-native-document-scanner` | Wrapper VisionKit + ML Kit con más opciones | **Elegida (provisional)** |
| **C** `@infinitered/react-native-mlkit-document-scanner` | Módulo Expo bien hecho, pero ML Kit no tiene escáner de documentos en iOS | Descartada: solo Android |
| **D** `@preeternal/react-native-document-scanner-plugin` | Fork orientado a New Architecture con OCR y códigos de barras, versión 0.4.x | No evaluada a fondo: inmadura y el OCR está fuera de alcance |
| **E** Módulo Expo propio | Swift (VisionKit) + Kotlin (ML Kit), ~100–200 líneas por plataforma | Recomendado a medio plazo (Fase 3/5) |
| **F** Cámara propia | `react-native-vision-camera` + detección con OpenCV o frame processors | Descartada para el MVP: alto coste y riesgo. Es la única vía para la cámara personalizada de los diseños 1b/1c |
| **G** SDK comerciales | Scanbot (ahora parte de Apryse), Genius Scan, Dynamsoft | Reserva si la calidad nativa no basta. Licencia de pago |

---

## 3. Hallazgo principal: qué hacen y qué no hacen las APIs nativas

**Hacen:** abrir la cámara, detectar el documento, capturar automáticamente, recortar y corregir
perspectiva, permitir al usuario ajustar el recorte en una pantalla de revisión y escanear varias páginas.
ML Kit además rota, reordena, aplica filtros y limpia sombras o manchas según el modo, puede importar
desde la galería y no necesita permiso de cámara de nuestra app. VisionKit incluye sus propios filtros
en la revisión (color, gris, blanco y negro, foto).

**No hacen:**

- **No devuelven la foto original ni las cuatro esquinas detectadas.** Solo la imagen final recortada.
  No podemos "volver a ajustar las esquinas sobre la foto original" más tarde.
- **No permiten personalizar su interfaz** (colores, textos, contador, botones).
- VisionKit no permite limitar el número de páginas ni importar fotos.
- Los filtros de VisionKit no se pueden desactivar.

### Impacto en los diseños

| Pantalla | Diseño actual | Con escáner nativo |
|---|---|---|
| 1b Cámara · documento detectado | Cámara propia con marco, flash y "Listo · 2" | Será la UI del sistema (distinta en iOS y Android). El diseño solo es viable con la opción F |
| 1c Ajuste de perspectiva | Pantalla propia tras capturar | Lo cubre la revisión nativa. Nuestra 1c solo hace falta para **fotos importadas** (Fase 5) y para re-recortar después |
| 1d Editor · Esquinas | Ajustar esquinas | Trabaja sobre la página **ya corregida**, no sobre el original. Alternativa más simple: "Volver a escanear esta página" |
| 1d Editor · Filtros | Original / Magic / Gris / B&N | "Original" pasa a significar "salida del escáner nativo", que ya viene realzada. Riesgo de doble filtrado (ver pregunta 3) |
| 2a Cámara sin documento | Estado propio | Lo gestiona la UI nativa |
| 2c Error de procesamiento | "La imagen salió borrosa" | Los escáneres nativos no informan de desenfoque. El estado sirve para errores nativos y de nuestro post-proceso |
| 2e Permiso de cámara | Pantalla propia | En Android probablemente innecesaria (ML Kit usa el permiso de Play services). En iOS sí: hay que comprobar el permiso antes de abrir VisionKit |
| 2f Permiso de fotos | Pantalla propia | Probablemente innecesaria: los selectores de fotos del sistema (PHPicker / Photo Picker) no piden permiso. Verificar en Fase 5 |

---

## 4. Dependencias nativas

- **iOS:** framework VisionKit (del sistema) a través del wrapper. Clave `NSCameraUsageDescription`.
- **Android:** ML Kit Document Scanner de Google Play services (lo añade el wrapper). Los modelos y la UI
  los entrega Play services, así que el impacto en el tamaño del APK es bajo.
- **Expo:** Development Build con `expo-dev-client` y `prebuild` (CNG). Nada de esto funciona en Expo Go.

---

## 5. Implicaciones en Android

- **Requiere Google Play services.** No funcionará en dispositivos sin GMS (Huawei recientes, AOSP,
  tablets Fire). Necesitamos un estado "escáner no disponible" y una salida alternativa (importar foto).
- **Sin permiso de cámara.** Si quitamos `android.permission.CAMERA` del manifest desaparece la pantalla 2e
  en Android. Ojo: otras librerías (`expo-camera`, la cámara de `expo-image-picker`) lo añaden; se controla
  con `blockedPermissions` en `app.json`. El caso 9 del protocolo prueba exactamente esto.
- **Modos de edición.** `base` (recortar, rotar, reordenar), `base_with_filter` (+ filtros) y `full`
  (+ limpieza con ML). Google documenta que `full` incorpora funciones nuevas automáticamente con las
  actualizaciones de Play services: el comportamiento puede cambiar sin publicar versión nuestra.
- **Importar de galería** dentro del flujo de ML Kit: resuelve la Fase 5 en Android casi sin trabajo,
  pero con una experiencia distinta a iOS.
- **Salida siempre JPEG.** ML Kit puede generar PDF, pero no lo usaremos: el PDF tiene que regenerarse a
  partir de nuestras páginas (filtros, orden) y ser igual en las dos plataformas.
- **Motor B usa el bridge clásico** sobre la capa de interoperabilidad de la New Architecture. Vigilar avisos
  en Logcat durante el spike.
- **Primera ejecución:** Play services puede necesitar descargar el módulo del escáner. Probar con un
  dispositivo recién configurado y sin conexión para ver qué error devuelve.

## 6. Implicaciones en iOS

- `VNDocumentCameraViewController`: UI de Apple, siempre multipágina, sin límite de páginas ni importación.
  `scanner-core` recorta a una página cuando se pide modo `single-page` (caso 10).
- **Filtros propios** en la pantalla de revisión, no desactivables. Por defecto la salida viene en "color"
  con realce.
- **Formato:** con `quality = 1.0` el motor B guarda PNG (mucho más pesado). Usar siempre < 1.
- **El simulador no sirve**; hace falta iPhone físico.
- **Permiso denegado:** comprobar el estado del permiso de cámara antes de abrir VisionKit para mostrar 2e.
  Si se usa la API de permisos de `expo-camera`, bloquear el permiso de cámara que añade en Android.
- **Importar fotos (Fase 5) requiere trabajo propio:** Vision (`VNDetectDocumentSegmentationRequest` o
  `VNDetectRectanglesRequest`) para proponer esquinas y `CIPerspectiveCorrection` para enderezar.
  Es el motivo principal del módulo Expo propio (opción E).

---

## 7. Limitaciones y riesgos que siguen abiertos

1. **Esquinas manuales.** Ningún wrapper las expone. El editor de esquinas será propio y solo tendrá sentido
   para fotos importadas y para re-recortar una página ya escaneada. La corrección de perspectiva puede
   hacerse sin OpenCV: `CIPerspectiveCorrection` en iOS y `Matrix.setPolyToPoly` en Android.
2. **Mantenimiento.** Ambos wrappers son proyectos pequeños. Mitigación: contrato `ScannerAdapter`,
   adaptadores intercambiables y módulo propio previsto.
3. **Tamaño de archivo.** Desconocido hasta medir. Solo B permite limitar la resolución en origen; con A
   habrá un paso de `compress()` en `scanner-core`.
4. **Comportamiento cambiante de ML Kit** en modo `full` (llega por Play services).
5. **Licencia de B:** el README dice MIT y el repositorio indica Apache-2.0. Ambas son compatibles, pero hay
   que confirmarla antes de depender de ella.

---

## 8. Resultados en dispositivo (pendiente)

Dispositivos: iPhone ____ (iOS __) · Android ____ (Android __, Play services __) · un Android de gama baja.

| Caso | iOS · A | iOS · B | Android · A | Android · B base | Android · B full |
|---|---|---|---|---|---|
| 1 Folio sobre mesa oscura | | | | | |
| 2 Folio sobre mesa clara | | | | | |
| 3 Hoja inclinada | | | | | |
| 4 Ticket largo | | | | | |
| 5 Hoja arrugada / sombra | | | | | |
| 6 Poca luz | | | | | |
| 7 Diez páginas | | | | | |
| 8 Cancelar | | | | | |
| 9 Permiso denegado / sin permiso | | | | | |
| 10 Modo una página | | | | | |
| Resolución de salida | | | | | |
| KB por página (media) | | | | | |
| Formato | | | | | |
| Avisos New Architecture | | | | | |

Pegar debajo el registro JSON que muestra la pantalla del spike.

## 9. Cómo cerrar la decisión

- B funciona en las dos plataformas sin errores ni avisos graves → **B**.
- B falla solo en Android → A en Android, B en iOS (o A en ambas) y `compress()` obligatorio.
- La detección falla en los casos 1–3 con ambos motores → evaluar G (comercial) antes que F (cámara propia).
- Si producto exige la cámara de los diseños 1b/1c → solo F lo permite; replanificar.

## 10. Preguntas para producto y diseño

1. ¿Aceptamos en el MVP la interfaz de cámara nativa en lugar de 1b, 1c y 2a? **Recomendado: sí.**
2. "Esquinas" en el editor: ¿re-recorte sobre la página ya corregida, o sustituirlo por
   "Volver a escanear esta página"?
3. Android: ¿modo `full` (mejor limpieza, pero el usuario ve dos juegos de filtros: los de ML Kit y los
   nuestros) o `base` (solo nuestros filtros, comportamiento igual en las dos plataformas)?
4. ¿Hay que soportar Android sin Google Play services?
5. La vista de escritorio (3a): el handoff solo cubre Android e iOS. ¿Es para tablet?

---

## Fuentes

- WebsiteBeaver/react-native-document-scanner-plugin — https://github.com/websitebeaver/react-native-document-scanner-plugin
- dariyd/react-native-document-scanner — https://github.com/dariyd/react-native-document-scanner
- Infinite Red, documentación del escáner ML Kit — https://docs.infinite.red/react-native-mlkit/document-scanner
- Google, ML Kit Document Scanner — https://developers.google.com/ml-kit/vision/doc-scanner
- Expo SDK 57 — https://expo.dev/changelog/sdk-57
