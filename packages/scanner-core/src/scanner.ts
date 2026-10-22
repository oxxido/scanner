import * as Device from 'expo-device';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { dariydAdapter } from './adapters/dariyd';
import { releaseCapturedPages } from './pageInfo';
import type { ScannerAdapter, ScanOptions, ScanResult } from './types';

export type CameraPermission = 'granted' | 'denied';

/**
 * iOS: VisionKit usa la cámara de la app, así que hace falta permiso.
 * Android: el escáner de ML Kit corre dentro de Google Play services y NO necesita
 * el permiso de cámara de la app (por eso lo bloqueamos en app.json).
 */
export async function ensureCameraPermission(): Promise<CameraPermission> {
  if (Platform.OS !== 'ios') return 'granted';
  const current = await ImagePicker.getCameraPermissionsAsync();
  if (current.granted) return 'granted';
  if (!current.canAskAgain) return 'denied';
  const asked = await ImagePicker.requestCameraPermissionsAsync();
  return asked.granted ? 'granted' : 'denied';
}

/** El simulador de iOS no tiene cámara; en Android la ausencia de Play services solo se sabe al intentarlo. */
export function isScannerAvailable(): boolean {
  if (Platform.OS === 'ios') return Device.isDevice;
  return Platform.OS === 'android';
}

export type Scanner = {
  readonly engine: string;
  scan(options: ScanOptions): Promise<ScanResult>;
};

/**
 * Punto de entrada para cualquier consumidor:
 *
 *   const result = await createScanner().scan({ mode: 'multi-page' });
 *   if (result.status === 'success') capture.receive(result.pages);
 */
export function createScanner(adapter: ScannerAdapter = dariydAdapter): Scanner {
  return {
    engine: adapter.name,
    async scan(options) {
      if (!isScannerAvailable()) {
        return {
          status: 'error',
          engine: adapter.name,
          error: { code: 'unavailable', message: 'El escáner necesita un dispositivo con cámara.' },
        };
      }
      const result = await adapter.scan(options);
      if (result.status !== 'success') return result;

      // VisionKit no permite limitar páginas: en modo una página nos quedamos con la primera.
      if (options.mode === 'single-page' && result.pages.length > 1) {
        releaseCapturedPages(result.pages.slice(1));
        return { ...result, pages: result.pages.slice(0, 1) };
      }
      return result;
    },
  };
}
