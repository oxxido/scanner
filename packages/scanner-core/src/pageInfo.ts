import { randomUUID } from 'expo-crypto';
import { File } from 'expo-file-system';
import { Image } from 'react-native';

import type { CapturedPage, CaptureSource, ScannerErrorCode, ScannerErrorInfo } from './types';

export function newId(): string {
  return randomUUID();
}

/** Algunos wrappers devuelven rutas absolutas sin esquema; File e Image esperan file://. */
export function toFileUri(pathOrUri: string): string {
  if (/^(file|content):\/\//.test(pathOrUri)) return pathOrUri;
  if (pathOrUri.startsWith('/')) return `file://${pathOrUri}`;
  return pathOrUri;
}

export function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

export function fileSizeOf(uri: string): number | undefined {
  try {
    const file = new File(uri);
    return file.exists ? file.size : undefined;
  } catch {
    return undefined;
  }
}

export function guessMime(uri: string): string {
  return /\.png$/i.test(uri) ? 'image/png' : 'image/jpeg';
}

export async function describeFile(uri: string, source: CaptureSource): Promise<CapturedPage> {
  const fileUri = toFileUri(uri);
  const { width, height } = await getImageSize(fileUri);
  return { id: newId(), uri: fileUri, width, height, fileSize: fileSizeOf(fileUri), mimeType: guessMime(fileUri), source };
}

export function toErrorInfo(err: unknown, fallback: ScannerErrorCode = 'native_error'): ScannerErrorInfo {
  const message =
    err instanceof Error
      ? err.message
      : typeof err === 'object' && err && 'errorMessage' in err
        ? String((err as { errorMessage: unknown }).errorMessage)
        : String(err);
  if (/permission|denied|not authori[sz]ed/i.test(message)) return { code: 'permission_denied', message };
  if (/not available|unavailable|unsupported|play services|google play/i.test(message)) return { code: 'unavailable', message };
  return { code: fallback, message };
}

/**
 * Borra los ficheros temporales de páginas capturadas. Llamarlo después de copiarlas
 * a su destino definitivo (o al descartarlas) para no dejar basura en caché.
 */
export function releaseCapturedPages(pages: readonly CapturedPage[]): void {
  for (const page of pages) {
    try {
      const file = new File(page.uri);
      if (file.exists) file.delete();
    } catch {
      // El sistema puede haberlo limpiado ya; no es un error.
    }
  }
}
