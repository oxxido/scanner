# Scanner App — Engineering Handoff v0.1

## Objetivo

Planificar e implementar una aplicación independiente de escaneo de documentos para Android e iOS.

Stack preferido:

- React Native;
- Expo;
- TypeScript.

El proyecto debe diseñarse pensando en reutilizar posteriormente el motor de escaneo dentro de Mamanager Capture.

No comenzar implementando visión artificial propia salvo que sea necesario.

Priorizar APIs nativas y librerías existentes para detección y corrección de documentos.

---

# Arquitectura deseada

Separar claramente:

## scanner-core

Responsable del procesamiento y adquisición de imágenes.

Debe poder utilizarse sin depender de la navegación o de la lógica documental de esta app.

Responsabilidades posibles:

- scanDocument;
- importImages;
- detectDocument;
- adjustCorners;
- perspectiveCorrection;
- applyFilter;
- rotate;
- compress.

Debe devolver datos neutrales como páginas procesadas.

No debe crear automáticamente documentos ni PDFs.

---

## scanner-app

Responsable de:

- navegación;
- UI;
- historial;
- agrupación de páginas;
- generación PDF;
- almacenamiento;
- compartir.

---

## packages o estructura sugerida

Explorar una arquitectura como:

```text
apps/
  scanner/

packages/
  scanner-core/
  scanner-ui/
  document-model/
```

No es obligatorio utilizar monorepo en el primer commit, pero la separación conceptual debe mantenerse.

La arquitectura debe facilitar que en el futuro exista:

```text
apps/
  scanner/
  mamanager/

packages/
  scanner-core/
```

---

# Modelo conceptual

## Document

```ts
type Document = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  pages: ScanPage[]
  pdfUri?: string
}
```

## ScanPage

```ts
type ScanPage = {
  id: string
  sourceUri: string
  processedUri: string
  width: number
  height: number
  rotation: number
  filter: ScanFilter
  sortOrder: number
}
```

## ScanFilter

```ts
type ScanFilter =
  | 'original'
  | 'magic'
  | 'grayscale'
  | 'bw'
```

Estos tipos pueden evolucionar.

---

# Persistencia

El MVP es local-first.

No utilizar backend.

Guardar:

- metadata de documentos;
- imágenes procesadas;
- PDFs.

Elegir una solución ligera para metadata, por ejemplo:

- SQLite;
- almacenamiento local estructurado equivalente.

Los archivos grandes deben guardarse en filesystem, no dentro de una base de datos.

---

# Pipeline de escaneo

Flujo esperado:

```text
camera
  ↓
image
  ↓
document detection
  ↓
corner detection
  ↓
perspective correction
  ↓
filter
  ↓
compression
  ↓
processed page
```

Evaluar primero soluciones basadas en:

### iOS

VisionKit / APIs de document scanning de Apple.

### Android

Google ML Kit Document Scanner.

Buscar una abstracción React Native / Expo mantenida que permita utilizar ambas.

Aceptar Expo Development Build y módulos nativos.

No imponer compatibilidad con Expo Go.

---

# PDF

El PDF debe crearse localmente.

Debe soportar:

- 1..N páginas;
- orden configurable;
- tamaño razonable;
- calidad suficiente para documentos;
- nombre personalizado.

No hace falta edición interna del PDF después de generarlo.

Si se modifica alguna página, el PDF puede regenerarse.

---

# Compartir

Usar exclusivamente el Share Sheet nativo del sistema.

No implementar clientes específicos para:

- Gmail;
- WhatsApp;
- Drive;
- Outlook;
- etc.

---

# Fases de implementación

## Fase 0 — Spike técnico

Objetivo:

validar el principal riesgo tecnológico antes de construir la app.

Crear una pantalla mínima que permita:

1. abrir scanner;
2. escanear una hoja;
3. obtener una imagen corregida;
4. mostrarla en pantalla.

Evaluar:

- calidad de detección;
- calidad de perspectiva;
- estabilidad;
- comportamiento Android;
- comportamiento iOS;
- compatibilidad con Expo.

La decisión de librería de escaneo debe tomarse después de este spike.

---

## Fase 1 — Scanner mínimo usable

Implementar:

- Home mínima;
- cámara / scanner;
- una página;
- edición básica;
- generar PDF;
- compartir.

Resultado esperado:

un documento físico puede convertirse en PDF y compartirse.

---

## Fase 2 — Multipágina

Añadir:

- capturar varias páginas;
- miniaturas;
- ordenar;
- eliminar;
- añadir;
- editar página individual.

Resultado:

flujo completo de documentos multipágina.

---

## Fase 3 — Filtros y corrección

Implementar:

- original;
- color/magic;
- gris;
- B&N;
- rotación;
- ajuste manual de esquinas cuando sea posible.

Evaluar si estas operaciones deben hacerse:

- mediante APIs nativas;
- librería existente;
- módulo propio;
- OpenCV.

No introducir OpenCV si no aporta una ventaja concreta.

---

## Fase 4 — Persistencia

Añadir:

- documentos recientes;
- guardar imágenes;
- guardar PDFs;
- renombrar;
- borrar;
- reabrir documentos.

---

## Fase 5 — Importar imágenes

Añadir:

- seleccionar una o varias fotos;
- convertirlas en páginas;
- procesarlas igual que páginas capturadas;
- generar PDF.

---

## Fase 6 — Pulido

Trabajar:

- errores;
- permisos;
- loading;
- procesamiento;
- archivos temporales;
- rendimiento;
- tamaño de imágenes;
- calidad de PDF;
- UX de cámara;
- recuperación ante cierre.

---

# Riesgos técnicos a investigar primero

## 1. Librería scanner

Investigar:

- mantenimiento activo;
- Expo New Architecture;
- iOS;
- Android;
- multipágina;
- crop manual;
- retorno de imágenes individuales;
- nivel de control sobre procesamiento.

---

## 2. Ajuste manual de esquinas

Las APIs nativas pueden realizar escaneo automáticamente pero no necesariamente exponer el editor exactamente como queremos.

Determinar si necesitamos implementar nuestra propia UI de crop/perspectiva.

---

## 3. Filtros

Evaluar qué librería aplicar para:

- contraste;
- saturación;
- brillo;
- grayscale;
- threshold;
- sharpen.

“Magic Color” no necesita replicar exactamente el algoritmo de CamScanner.

Debe buscar:

- fondo limpio;
- texto legible;
- contraste alto;
- colores conservados razonablemente.

---

## 4. Tamaño de archivos

Una foto móvil puede ocupar varios MB.

Un documento de 20 páginas no debería producir un PDF absurdamente grande.

Definir una estrategia de:

- resolución;
- JPEG quality;
- compresión;
- thumbnails.

---

## 5. Filesystem

Definir claramente:

- temporales;
- fuentes;
- imágenes procesadas;
- thumbnails;
- PDFs.

Evitar acumular archivos huérfanos.

---

# Criterios de aceptación del MVP

Debe ser posible:

1. abrir la app;
2. tocar “Escanear”;
3. capturar una hoja;
4. obtener un recorte corregido;
5. capturar más páginas;
6. cambiar su orden;
7. aplicar un filtro;
8. crear un PDF;
9. compartirlo mediante el sistema;
10. volver a encontrar el documento desde Home.

---

# Restricciones de alcance

No implementar inicialmente:

- backend;
- autenticación;
- sincronización;
- OCR;
- búsqueda;
- firma;
- anotaciones;
- monetización;
- suscripción;
- publicidad;
- carpetas;
- colaboración.

---

# Reutilización en Mamanager

Todo aquello relacionado con captura y procesamiento de páginas debe intentar quedar fuera de la lógica específica de la app.

El objetivo futuro debe ser poder hacer algo conceptualmente equivalente a:

```ts
const result = await scanner.scan({
  mode: 'multi-page'
})

capture.receive(result.pages)
```

Scanner App utilizaría las mismas páginas para:

```ts
const pdf = await createPdf(result.pages)
```

Mamanager Capture podría utilizarlas para:

```ts
await ingestCapture(result.pages)
```

Esta separación es un requisito arquitectónico importante.

---

# Primera tarea para el agente de implementación

No comenzar construyendo todas las pantallas.

Primero realizar el spike técnico de la Fase 0.

Comparar las opciones actuales para document scanning compatibles con React Native / Expo y crear una prueba mínima de escaneo real.

Documentar:

- opción elegida;
- alternativas evaluadas;
- limitaciones;
- dependencias nativas;
- implicaciones para Android;
- implicaciones para iOS.

Después proponer el plan concreto de implementación por fases antes de continuar con el resto del producto.