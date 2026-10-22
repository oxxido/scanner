import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { fitWithin } from './geometry';
import { fileSizeOf, newId, toErrorInfo } from './pageInfo';
import type { CapturedPage, ImportResult } from './types';

export type ImportOptions = {
  /** Máximo de fotos por selección. 0 = sin límite. */
  limit?: number;
  /** Lado mayor máximo al normalizar. Las fotos de móvil pueden superar los 4000 px. */
  maxDimension?: number;
};

/**
 * Normaliza una imagen a JPEG en caché:
 *  - aplica la orientación EXIF a los píxeles,
 *  - convierte HEIC/PNG a JPEG,
 *  - limita la resolución para no cargar 12 Mpx en memoria al procesar.
 */
export async function normalizeImage(uri: string, width: number, height: number, maxDimension: number): Promise<CapturedPage> {
  const ctx = ImageManipulator.manipulate(uri);
  if (width > 0 && height > 0 && Math.max(width, height) > maxDimension) {
    ctx.resize(fitWithin(width, height, maxDimension));
  }
  const ref = await ctx.renderAsync();
  const saved = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.92 });
  return {
    id: newId(),
    uri: saved.uri,
    width: saved.width,
    height: saved.height,
    fileSize: fileSizeOf(saved.uri),
    mimeType: 'image/jpeg',
    source: 'import',
  };
}

/** Abre el selector de fotos del sistema (no necesita permiso de galería) y normaliza lo elegido. */
export async function importImages(options: ImportOptions = {}): Promise<ImportResult> {
  try {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: options.limit ?? 0,
      orderedSelection: true,
      quality: 1,
      exif: false,
    });
    if (picked.canceled || picked.assets.length === 0) return { status: 'cancelled' };

    const max = options.maxDimension ?? 3000;
    const pages: CapturedPage[] = [];
    for (const asset of picked.assets) {
      pages.push(await normalizeImage(asset.uri, asset.width, asset.height, max));
    }
    return { status: 'success', pages };
  } catch (err) {
    return { status: 'error', error: toErrorInfo(err) };
  }
}
