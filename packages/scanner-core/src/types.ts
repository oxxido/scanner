/**
 * scanner-core · tipos neutrales
 *
 * No conoce Document, PDF, navegación ni base de datos. Devuelve y procesa páginas;
 * qué hacer con ellas lo decide el consumidor (Scanner App, Mamanager Capture…).
 * Los tipos de recorte son estructuralmente iguales a los de document-model, pero
 * se declaran aquí para que este paquete no dependa de ningún otro.
 */

export type ScanMode = 'single-page' | 'multi-page';

/** Modos de edición del flujo de ML Kit (Android). Ignorado en iOS. */
export type AndroidScannerMode = 'base' | 'base_with_filter' | 'full';

export type ScanOptions = {
  mode: ScanMode;
  /** Máximo de páginas por sesión. Hoy solo lo respeta Android. */
  maxPages?: number;
  /** Calidad JPEG 0..1. Nunca 1.0: en iOS el wrapper pasaría a PNG. */
  quality?: number;
  /** Lado mayor máximo de la imagen que entrega el escáner. */
  maxDimension?: number;
  /** Importar de la galería dentro del flujo nativo (solo Android). */
  allowGalleryImport?: boolean;
  androidScannerMode?: AndroidScannerMode;
};

export type CaptureSource = 'scanner' | 'import';

/**
 * Página recién capturada o importada. El fichero es TEMPORAL: el consumidor debe
 * copiarlo a su almacenamiento y después llamar a releaseCapturedPages().
 */
export type CapturedPage = {
  id: string;
  uri: string;
  width: number;
  height: number;
  fileSize?: number;
  mimeType: string;
  source: CaptureSource;
};

export type ScannerErrorCode =
  | 'unavailable' // simulador, sin Google Play services, dispositivo no soportado
  | 'permission_denied'
  | 'native_error';

export type ScannerErrorInfo = { code: ScannerErrorCode; message: string };

export type ScanResult =
  | { status: 'success'; engine: string; pages: CapturedPage[] }
  | { status: 'cancelled'; engine: string }
  | { status: 'error'; engine: string; error: ScannerErrorInfo };

export type ImportResult =
  | { status: 'success'; pages: CapturedPage[] }
  | { status: 'cancelled' }
  | { status: 'error'; error: ScannerErrorInfo };

export interface ScannerAdapter {
  readonly name: string;
  scan(options: ScanOptions): Promise<ScanResult>;
}

// --- Procesamiento -----------------------------------------------------------

export type PageFilter = 'original' | 'magic' | 'grayscale' | 'bw';
export type PageRotation = 0 | 90 | 180 | 270;
export type NormalizedPoint = { x: number; y: number };
export type NormalizedQuad = { tl: NormalizedPoint; tr: NormalizedPoint; br: NormalizedPoint; bl: NormalizedPoint };

export type ProcessInput = {
  sourceUri: string;
  /** null = imagen completa */
  crop: NormalizedQuad | null;
  rotation: PageRotation;
  filter: PageFilter;
};

export type ProcessTarget = {
  /** file:// donde escribir el JPEG final. Se sobrescribe si existe. */
  outputUri: string;
  /** file:// para la miniatura. Opcional. */
  thumbnailUri?: string;
  /** Lado mayor máximo del resultado. Por defecto 2340 px (A4 a ~200 ppp). */
  maxDimension?: number;
  /** Calidad JPEG 0..1. Por defecto 0.8. */
  quality?: number;
  /** Lado mayor de la miniatura. Por defecto 360 px. */
  thumbnailSize?: number;
};

export type ProcessResult = {
  width: number;
  height: number;
  fileSize: number;
  sourceWidth: number;
  sourceHeight: number;
};
