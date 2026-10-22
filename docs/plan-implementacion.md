# Plan de implementación por fases (propuesta)

Parte de la decisión provisional de `fase-0-spike.md`. Tamaños relativos: **S** días, **M** una o dos
semanas, **L** más de dos semanas. Ninguna fase empieza sin cerrar la anterior.

---

## Arquitectura

```
apps/
  scanner/                 Expo Router · pantallas · flujo · historial · PDF · compartir
packages/
  scanner-core/            adquisición y procesamiento de páginas; no conoce Document ni PDF
  document-model/          tipos Document / ScanPage / ScanFilter + funciones puras
  scanner-ui/              (Fase 3) editor de esquinas y vista de filtros reutilizables
```

Monorepo con workspaces desde Fase 1 (configuración de Metro según la guía de monorepos de la SDK vigente).
Regla de dependencias: `apps/*` → `packages/*`; `document-model` no depende de nada; `scanner-core`
no depende de `document-model`.

### API objetivo de `scanner-core`

```ts
scan(options: ScanOptions): Promise<ScanResult>                    // Fase 1
compress(page, { maxDimension, quality }): Promise<CapturedPage>    // Fase 1
rotate(page, degrees): Promise<CapturedPage>                       // Fase 3
applyFilter(page, filter): Promise<CapturedPage>                   // Fase 3
perspectiveCorrect(page, quad): Promise<CapturedPage>              // Fase 3/5 · módulo nativo propio
detectDocument(imageUri): Promise<Quad | null>                     // Fase 5 · módulo nativo propio
importImages(uris): Promise<CapturedPage[]>                        // Fase 5
```

Todas reciben y devuelven páginas neutrales. Así quedan los dos consumidores:

```ts
// Scanner App
const result = await scanner.scan({ mode: 'multi-page' });
if (result.status === 'success') await createPdf(toDocumentPages(result.pages));

// Mamanager Capture (futuro)
if (result.status === 'success') await ingestCapture(result.pages);
```

### Ficheros

```
Paths.cache/scanner/<sessionId>/            temporales del escáner (propiedad de scanner-core)
Paths.document/scanner/docs/<docId>/
  pages/<pageId>.source.jpg                 salida del escáner, inmutable
  pages/<pageId>.jpg                        procesada: filtro + rotación (regenerable)
  thumbs/<pageId>.jpg                       miniatura (regenerable)
  export/<nombre>.pdf                       PDF (regenerable)
SQLite (expo-sqlite): tablas documents y pages
```

Reglas:

- `source` nunca se modifica; `processed`, miniatura y PDF se derivan de ella. Los filtros son no destructivos.
- La app copia de `cache/scanner/<sessionId>` a `docs/<docId>` al aceptar las páginas y borra la sesión.
- Al arrancar: borrar sesiones de caché con más de 24 h y reconciliar SQLite con las carpetas
  (carpetas sin fila → borrar; filas sin fichero → marcar página dañada).
- Borrar un documento borra su carpeta completa.

### Tamaño de archivo (valores iniciales, se ajustan con los datos del spike)

| Recurso | Lado mayor | Formato |
|---|---|---|
| Página procesada | 2340 px (≈ A4 a 200 ppp) | JPEG 0.8 |
| Miniatura | 360 px | JPEG 0.6 |
| PDF | Embeber la página procesada sin recodificar | — |

Objetivo orientativo: menos de 0,5 MB por página en color y un documento de 20 páginas por debajo de 10 MB.
Para B&N, medir en Fase 3 si un PNG en escala de grises pesa menos que el JPEG.

### Pruebas

- Unitarias (Jest) en `document-model` y en la normalización de `scanner-core`.
- `FakeScannerAdapter` que devuelve páginas de ejemplo: permite probar todo el flujo de la app en
  simulador y en CI sin cámara. Es una ventaja directa del contrato de adaptadores.
- El escaneo real se prueba a mano con el protocolo del spike en cada release.

---

## Fase 0 · Spike — cerrar (S)

- Ejecutar el protocolo en un iPhone, un Android de gama media y uno de gama baja.
- Rellenar la tabla y firmar la decisión de librería.
- Respuesta de producto y diseño a las cinco preguntas del informe.

**Salida:** librería decidida y diseños 1b/1c/1d/2e ajustados a la UI nativa (o decisión explícita de ir a cámara propia).

## Fase 1 · Escáner mínimo usable (M)

- Monorepo; mover `scanner-core`; crear `document-model` con los tipos del handoff.
- `compress()` con `expo-image-manipulator` (redimensionar + JPEG).
- Pantallas: Home mínima (botón Escanear), vista de la página escaneada, Crear PDF, pantalla 1f.
- **PDF:** probar primero `expo-print` (HTML con una imagen por página, sin dependencias nativas nuevas)
  y medir memoria y tiempo con 20 páginas. Si no da la talla, generar el PDF en nativo
  (`PdfDocument` en Android, `UIGraphicsPDFRenderer` en iOS) dentro del módulo propio o con una
  librería existente que se evalúe entonces. Descartado `pdf-lib`: carga todas las imágenes en memoria JS.
- Compartir con `expo-sharing` (Share Sheet del sistema, tipo `application/pdf`).
- Sin historial todavía: el documento vive en memoria.

**Salida:** un folio físico se convierte en PDF y se comparte, en iOS y Android.

## Fase 2 · Multipágina (M)

- Pantalla 1e: cuadrícula de miniaturas, reordenar arrastrando (`react-native-gesture-handler` +
  `react-native-reanimated`), eliminar, añadir (un nuevo escaneo se anexa al final), abrir una página.
- Funciones puras en `document-model` con tests: `addPages`, `removePage`, `movePage`, `renumber`.
- El orden canónico es el nuestro aunque ML Kit permita reordenar dentro de su flujo.

**Salida:** flujo completo de documento multipágina.

## Fase 3 · Filtros y corrección (L)

- **Filtros** con `@shopify/react-native-skia` en renderizado fuera de pantalla, siempre desde `source`:
  - `original`: salida del escáner nativo, sin tocar.
  - `grayscale`: matriz de color.
  - `bw`: umbral con un shader (RuntimeEffect); evaluar umbral adaptativo si el global falla con sombras.
  - `magic`: normalización de niveles + contraste + algo de saturación. Objetivo del handoff: fondo limpio,
    texto legible, colores razonables. No replicar CamScanner.
- **Rotación** con `expo-image-manipulator` o en el mismo pase de Skia.
- **Esquinas** (según la respuesta de diseño): editor 1c propio (gestos + overlay en Skia) y
  `perspectiveCorrect()` en un módulo Expo propio: `CIPerspectiveCorrection` (iOS) y
  `Matrix.setPolyToPoly` (Android). Sin OpenCV.
- OpenCV solo entra si en Fase 5 hace falta detección automática en fotos importadas en Android y ML Kit
  con importación de galería no basta.

**Salida:** los cuatro filtros y la rotación en menos de 1 s por página en gama media (medir); esquinas
según lo decidido.

## Fase 4 · Persistencia (M)

- Esquema `expo-sqlite`: `documents (id, name, created_at, updated_at, pdf_uri, pdf_generated_at)` y
  `pages (id, document_id, source_uri, processed_uri, thumb_uri, width, height, rotation, filter, sort_order)`.
- Migraciones versionadas desde el primer día.
- Home con recientes (1a), estado vacío (2d), renombrar, borrar, reabrir.
- El PDF se marca obsoleto si `updated_at > pdf_generated_at` y se regenera al compartir.

**Salida:** el criterio "volver a encontrar el documento desde Home" se cumple tras cerrar la app.

## Fase 5 · Importar imágenes (M–L)

- `expo-image-picker` con selección múltiple (selector del sistema; comprobar si 2f es necesaria).
- `importImages()` → `detectDocument()` propone esquinas (iOS: Vision; Android: esquinas al borde por
  defecto o detección según Fase 3) → confirmación en 1c → `perspectiveCorrect()` → mismo pipeline que
  las páginas escaneadas.
- Alternativa en Android: abrir ML Kit con importación de galería activada. Más simple, pero la
  experiencia difiere de iOS.

**Salida:** fotos de la galería se convierten en páginas indistinguibles de las escaneadas.

## Fase 6 · Pulido (M)

- Estados del diseño: 2b procesando, 2c error, 2e/2f permisos, 2g creando PDF, 2h PDF creado,
  y "escáner no disponible" en Android sin Play services.
- Recuperación ante cierre: guardar el documento como borrador en cuanto hay una página aceptada.
- Limpieza de temporales, memoria con 20+ páginas, tamaños finales, calidad del PDF.
- Accesibilidad: tamaños táctiles, lector de pantalla en la cuadrícula y el editor.

---

## Criterios de aceptación del MVP → fase

| Criterio | Fase |
|---|---|
| Abrir la app y tocar "Escanear" | 1 |
| Capturar una hoja y obtener un recorte corregido | 1 (nativo) |
| Capturar más páginas y cambiar su orden | 2 |
| Aplicar un filtro | 3 |
| Crear un PDF y compartirlo | 1 |
| Volver a encontrar el documento desde Home | 4 |

## Fuera de alcance (sin cambios respecto al handoff)

Backend, autenticación, sincronización, OCR, búsqueda, firma, anotaciones, monetización, carpetas,
colaboración.
