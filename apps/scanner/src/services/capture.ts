import { createScanner, ensureCameraPermission, importImages, isScannerAvailable, type CapturedPage } from '@scanner/scanner-core';

/**
 * Android: modo completo de ML Kit (recorte, filtros y limpieza de manchas/dedos).
 * Las páginas escaneadas entran con el filtro "original" para no filtrar dos veces.
 * Cambiar a 'base' si producto prefiere que los únicos filtros sean los de la app.
 */
const ANDROID_SCANNER_MODE = 'full' as const;

/** Resolución de la imagen fuente que se guarda. La procesada se reduce después a 2340 px. */
const SOURCE_MAX_DIMENSION = 3000;

const scanner = createScanner();

export type AcquireOutcome =
  | { kind: 'pages'; pages: CapturedPage[] }
  | { kind: 'cancelled' }
  | { kind: 'permission' }
  | { kind: 'unavailable'; message: string }
  | { kind: 'error'; message: string };

const UNAVAILABLE = 'Este dispositivo no puede abrir el escáner. Puedes crear el documento importando fotos.';

export async function acquireFromScanner(): Promise<AcquireOutcome> {
  if (!isScannerAvailable()) return { kind: 'unavailable', message: UNAVAILABLE };
  if ((await ensureCameraPermission()) === 'denied') return { kind: 'permission' };

  const result = await scanner.scan({
    mode: 'multi-page',
    maxPages: 50,
    quality: 0.9,
    maxDimension: SOURCE_MAX_DIMENSION,
    androidScannerMode: ANDROID_SCANNER_MODE,
  });
  switch (result.status) {
    case 'success':
      return { kind: 'pages', pages: result.pages };
    case 'cancelled':
      return { kind: 'cancelled' };
    case 'error':
      if (result.error.code === 'permission_denied') return { kind: 'permission' };
      if (result.error.code === 'unavailable') return { kind: 'unavailable', message: UNAVAILABLE };
      return { kind: 'error', message: result.error.message };
  }
}

export async function acquireFromLibrary(): Promise<AcquireOutcome> {
  const result = await importImages({ maxDimension: SOURCE_MAX_DIMENSION });
  switch (result.status) {
    case 'success':
      return { kind: 'pages', pages: result.pages };
    case 'cancelled':
      return { kind: 'cancelled' };
    case 'error':
      return { kind: 'error', message: result.error.message };
  }
}
