import { launchScanner } from '@dariyd/react-native-document-scanner';

import { fileSizeOf, newId, toErrorInfo, toFileUri } from '../pageInfo';
import type { CapturedPage, ScannerAdapter, ScanOptions, ScanResult } from '../types';

const ENGINE = '@dariyd/react-native-document-scanner';

/**
 * VisionKit (iOS) + ML Kit Document Scanner (Android).
 * Decisión y alternativas: docs/fase-0-spike.md.
 */
export const dariydAdapter: ScannerAdapter = {
  name: ENGINE,

  async scan(options: ScanOptions): Promise<ScanResult> {
    try {
      const max = options.maxDimension ?? 0;
      const res = await launchScanner({
        // < 1 para que iOS entregue JPEG y no PNG.
        quality: Math.min(options.quality ?? 0.9, 0.95),
        maxWidth: max,
        maxHeight: max,
        includeBase64: false,
        includeExif: false,
        includeLocationExif: false,
        includePdf: false,
        // Solo Android:
        pageLimit: options.mode === 'single-page' ? 1 : options.maxPages ?? 50,
        galleryImportAllowed: options.allowGalleryImport ?? false,
        scannerMode: options.androidScannerMode ?? 'full',
      });

      if (res?.didCancel) return { status: 'cancelled', engine: ENGINE };
      if (res?.error) return { status: 'error', engine: ENGINE, error: toErrorInfo(new Error(res.errorMessage ?? 'Error del escáner')) };

      const images = res?.images ?? [];
      if (images.length === 0) return { status: 'cancelled', engine: ENGINE };

      const pages: CapturedPage[] = images.map((img) => {
        const uri = toFileUri(img.uri);
        return {
          id: newId(),
          uri,
          width: img.width,
          height: img.height,
          fileSize: img.fileSize ?? fileSizeOf(uri),
          mimeType: img.type || 'image/jpeg',
          source: 'scanner',
        };
      });
      return { status: 'success', engine: ENGINE, pages };
    } catch (err) {
      // launchScanner rechaza con { error, errorMessage } si el módulo nativo no está enlazado.
      return { status: 'error', engine: ENGINE, error: toErrorInfo(err) };
    }
  },
};
