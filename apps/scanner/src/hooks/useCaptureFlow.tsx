import { useRouter } from 'expo-router';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Alert, Modal } from 'react-native';

import { ProgressModal, StatusScreen, type ProgressState } from '../components/ui';
import { acquireFromLibrary, acquireFromScanner } from '../services/capture';
import { addCapturedPages, retryPages } from '../services/pages';

type Options = {
  /** Documento al que añadir las páginas. Sin él se crea uno nuevo. */
  docId?: string;
  /** Se llama al crear un documento nuevo (para navegar a él). */
  onCreated?: (docId: string) => void;
};

type Failure = { docId: string; pageIds: string[] };

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Orquesta escanear/importar → permisos → procesado con progreso (2b) → error de procesado (2c).
 * Devuelve `overlay`, que la pantalla debe renderizar.
 */
export function useCaptureFlow({ docId, onCreated }: Options = {}) {
  const router = useRouter();
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const running = useRef(false);

  const run = useCallback(
    async (source: 'scanner' | 'import'): Promise<boolean> => {
      if (running.current) return false;
      running.current = true;
      try {
        const outcome = source === 'scanner' ? await acquireFromScanner() : await acquireFromLibrary();
        switch (outcome.kind) {
          case 'cancelled':
            return false;
          case 'permission':
            router.push({ pathname: '/permission', params: docId ? { docId } : {} });
            return false;
          case 'unavailable':
            Alert.alert('Escáner no disponible', outcome.message, [
              { text: 'Cerrar', style: 'cancel' },
              { text: 'Importar fotos', onPress: () => void run('import') },
            ]);
            return false;
          case 'error':
            Alert.alert(source === 'scanner' ? 'No se pudo escanear' : 'No se pudieron importar las fotos', outcome.message);
            return false;
          case 'pages':
            break;
        }

        const total = outcome.pages.length;
        const title = total > 1 ? 'Mejorando páginas' : 'Mejorando página';
        setProgress({ title, body: 'Corrigiendo perspectiva y contraste.', progress: 0, dark: true });
        const result = await addCapturedPages(docId, outcome.pages, (done, n) =>
          setProgress({ title, body: n > 1 ? `Página ${Math.min(done + 1, n)} de ${n}` : 'Corrigiendo perspectiva y contraste.', progress: done / n, dark: true }),
        );
        setProgress(null);
        if (result.failedPageIds.length > 0) setFailure({ docId: result.doc.id, pageIds: result.failedPageIds });
        if (!docId) onCreated?.(result.doc.id);
        return true;
      } catch (err) {
        setProgress(null);
        Alert.alert('Algo ha fallado', messageOf(err));
        return false;
      } finally {
        running.current = false;
      }
    },
    [docId, onCreated, router],
  );

  const retry = useCallback(async () => {
    if (!failure) return;
    const current = failure;
    setFailure(null);
    setProgress({ title: 'Mejorando página', body: 'Nuevo intento.', progress: 0.5, dark: true });
    const still = await retryPages(current.docId, current.pageIds);
    setProgress(null);
    if (still.length > 0) setFailure({ docId: current.docId, pageIds: still });
  }, [failure]);

  const count = failure?.pageIds.length ?? 0;
  const overlay: ReactNode = (
    <>
      <ProgressModal state={progress} />
      <Modal visible={!!failure} animationType="fade" statusBarTranslucent onRequestClose={() => setFailure(null)}>
        <StatusScreen
          icon="!"
          tone="danger"
          title="No se pudo procesar"
          body={
            count === 1
              ? 'Una página no se pudo mejorar. Se ha guardado la imagen original.'
              : `${count} páginas no se pudieron mejorar. Se han guardado las imágenes originales.`
          }
          primary={{ label: 'Repetir', onPress: () => void retry() }}
          secondary={{ label: 'Usar original', onPress: () => setFailure(null) }}
        />
      </Modal>
    </>
  );

  return {
    scan: () => run('scanner'),
    importPhotos: () => run('import'),
    overlay,
  };
}
