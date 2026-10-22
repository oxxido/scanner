# ScannerTest

App de escaneo de documentos para iOS y Android: escanear → corregir → mejorar → PDF → compartir.
React Native + Expo SDK 57 + TypeScript, local-first, sin backend.

## Estado

**Verificado en el entorno de desarrollo:**

- Tipos de TypeScript correctos en los tres paquetes, contra las versiones reales de todas las librerías (`npm run typecheck`).
- 20 pruebas automáticas en verde: modelo de documento, geometría del recorte y generador de PDF (`npm test`).
- El PDF generado pasa `qpdf --check`; `pdfinfo` confirma tamaño A4, título con tildes y JPEG incrustados sin recomprimir.
- Los cuatro shaders de procesado compilan y producen el resultado esperado en Skia (CanvasKit). Ver `docs/validacion-filtros.jpg`.
- Metro empaqueta la app completa para Android sin errores (`npx expo export`).

**No verificado:** no se ha compilado ni ejecutado en un iPhone ni en un Android. Ver "Primera compilación".

## Arrancar

Requisitos: Node 22.13+, Xcode (iOS) o Android Studio (Android), un **dispositivo físico**
(el simulador de iOS no tiene cámara; el escáner de Android necesita Google Play services).

```bash
npm install                     # en la raíz: instala todo el monorepo
cd apps/scanner
npx expo prebuild               # genera ios/ y android/
npx expo run:ios --device       # o: npx expo run:android --device
```

Identificador: `com.scannertest.app` (iOS y Android). No lo cambies después de repartir la app: el sistema la trataría como otra distinta y se perderían los documentos guardados.

### Compilar para repartir (EAS, en la nube)

No hace falta Mac ni Android Studio. Necesitas una cuenta gratuita en expo.dev y, para iPhone, la cuenta de Apple Developer.

```bash
cd apps/scanner
npm install -g eas-cli
eas login
eas init                                  # vincula el proyecto a tu cuenta (solo la primera vez)

eas build -p android --profile preview    # APK instalable en cualquier Android
eas device:create                         # registra cada iPhone de prueba
eas build -p ios --profile preview        # instalación directa en esos iPhone

eas build -p all --profile production     # versiones para las tiendas
eas submit -p ios                         # sube a TestFlight / App Store
eas submit -p android                     # sube a Google Play
```

### Iconos

Generados a partir del logo de 200 px en `apps/scanner/assets/`:

- `icon.png`: 1024 px, sin transparencia (iOS).
- `adaptive-icon.png`: Android; el logo va dentro de la zona segura para que la máscara circular no corte la cinta "Test".
- `splash-icon.png`: pantalla de inicio.

Con un logo de mayor resolución (1024 px o vectorial) se ven más nítidos: basta con regenerarlos.

```bash
npm run typecheck               # en la raíz
npm test                        # en la raíz
```

## Estructura

```
apps/scanner/                   la app (Expo Router)
  app/                          pantallas
    index.tsx                   1a Inicio · 2d estado vacío
    permission.tsx              2e permiso de cámara
    document/[id]/index.tsx     1e documento multipágina
    document/[id]/page/…        1d editor de página
    document/[id]/corners/…     1c ajuste de esquinas
    document/[id]/done.tsx      1f / 2h PDF creado
  src/
    hooks/useCaptureFlow.tsx    escanear/importar → 2b procesando → 2c error
    services/                   captura, páginas, PDF
    storage/                    SQLite, rutas en disco, caché en memoria, limpieza
    pdf/jpegPdf.ts              generador de PDF (TypeScript puro)
packages/
  scanner-core/                 escaneo nativo, importación y procesado de imagen
  document-model/               tipos y lógica pura del documento
docs/                           informe del spike y plan por fases
```

`scanner-core` no depende de nada de la app: Mamanager Capture puede usarlo tal cual.

```ts
const result = await createScanner().scan({ mode: 'multi-page' });
if (result.status === 'success') await ingestCapture(result.pages);
```

## Cómo funciona

- **Escaneo:** el escáner del sistema (VisionKit en iOS, ML Kit en Android) mediante
  `@dariyd/react-native-document-scanner`. Detecta, recorta y corrige la perspectiva.
- **Procesado:** Skia en GPU, sin OpenCV ni código nativo propio. Una sola pasada aplica el recorte
  en perspectiva, el giro y la reducción de tamaño; después se aplica el filtro.
  - "Magic" y "B&N" eliminan sombras estimando el color del papel y dividiendo por él.
  - Todo se recalcula desde la imagen fuente, así que cambiar un filtro o un recorte nunca pierde calidad.
- **PDF:** escritor propio en TypeScript que incrusta cada JPEG tal cual, página a página, sin cargar el documento entero en memoria.
  - Lado corto de la página = A4; el lado largo sigue la proporción de la imagen, para que un ticket largo no quede diminuto.
- **Tamaños:**
  - Fuente: hasta 3000 px.
  - Página procesada: 2340 px (≈ A4 a 200 ppp), JPEG 0,8.
  - Miniatura: 360 px.
- **Datos:** metadatos en SQLite y ficheros en `Documents/scanner/docs/<id>/`.
  - Las rutas se guardan relativas, porque en iOS la ruta absoluta cambia al actualizar la app.
  - Al arrancar se borran documentos vacíos, carpetas huérfanas y revisiones antiguas.
  - El documento se guarda tras cada página procesada: si la app se cierra a mitad, no se pierde lo ya hecho.

## Decisiones tomadas por defecto

Eran las preguntas abiertas del spike. Todas se pueden cambiar.

| Pregunta | Decisión | Dónde cambiarla |
|---|---|---|
| ¿Cámara propia (1b/1c) o la del sistema? | La del sistema | Cambiarlo implica una cámara propia (Fase F del informe) |
| ¿Qué hace "Esquinas"? | Recorte en perspectiva sobre la imagen fuente: re-recorte en páginas escaneadas, corrección completa en fotos importadas | `app/document/[id]/corners` |
| Modo de ML Kit en Android | `full` (limpia manchas y dedos). Las páginas escaneadas entran con filtro "Original"; las importadas, con "Magic" | `ANDROID_SCANNER_MODE` en `src/services/capture.ts` |
| Android sin Google Play services | Aviso y opción de importar fotos | `src/hooks/useCaptureFlow.tsx` |
| Vista de escritorio (3a) | No implementada | — |

**Permisos:**

- En Android se bloquean `CAMERA`, `RECORD_AUDIO` y los permisos de ubicación.
  - ML Kit no necesita la cámara de la app.
  - La librería de escaneo declara ubicación aunque no la usamos.
- El permiso de fotos (2f) no hace falta: el selector del sistema no lo pide.

## Primera compilación: qué revisar si algo falla

1. **El escáner de Android da error de permiso.** Quita `android.permission.CAMERA` de `blockedPermissions` en `app.json`.
2. **Avisos de la New Architecture con el escáner en Android.** La librería usa el bridge clásico en Android. Si da problemas, hay un adaptador alternativo documentado en `docs/fase-0-spike.md` (`react-native-document-scanner-plugin`). Se cambia en `packages/scanner-core/src/scanner.ts`.
3. **Módulos nativos no encontrados.** Ejecuta `npx expo install --fix` en `apps/scanner` y vuelve a hacer `prebuild --clean`. Expo detecta el monorepo automáticamente desde la SDK 52.
4. **Procesado lento o error de memoria en móviles de gama baja.** Baja `SOURCE_MAX_DIMENSION` (3000) en `src/services/capture.ts` y `DEFAULT_MAX_DIMENSION` (2340) en `scanner-core`.
5. **"Guardar" en Android.** Usa el selector de carpetas del sistema. Si no funciona en algún dispositivo, el botón Compartir sigue siendo válido.

## Fases del handoff

| Fase | Contenido | Estado |
|---|---|---|
| 0 | Spike: elección de librería | Hecho (falta probar en dispositivo) |
| 1 | Escanear, PDF y compartir | Hecho |
| 2 | Multipágina: miniaturas, reordenar arrastrando, borrar, añadir | Hecho |
| 3 | Filtros, giro y esquinas | Hecho |
| 4 | Persistencia, recientes, renombrar, borrar y reabrir | Hecho |
| 5 | Importar fotos con corrección de perspectiva | Hecho. Sin detección automática de bordes en fotos importadas: las esquinas se ajustan a mano |
| 6 | Estados, permisos, temporales y recuperación ante cierre | Hecho, salvo la medición de rendimiento en dispositivo |

Fuera de alcance, como en el handoff: backend, cuentas, OCR, búsqueda, firma, carpetas y monetización.
