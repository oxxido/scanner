import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Linking } from 'react-native';

import { StatusScreen } from '../src/components/ui';
import { useCaptureFlow } from '../src/hooks/useCaptureFlow';

/** 2e · Permiso de cámara denegado (solo iOS: en Android el escáner no lo necesita). */
export default function PermissionScreen() {
  const router = useRouter();
  const { docId } = useLocalSearchParams<{ docId?: string }>();
  const flow = useCaptureFlow({ docId, onCreated: (id) => router.replace(`/document/${id}`) });

  async function importInstead() {
    const added = await flow.importPhotos();
    if (added && docId) router.back();
  }

  return (
    <>
      <StatusBar style="light" />
      <StatusScreen
        dark
        icon="◉"
        title="Activa la cámara"
        body="Se usa solo para escanear. Nada sale de tu dispositivo."
        primary={{ label: 'Abrir Ajustes', onPress: () => void Linking.openSettings() }}
        secondary={{ label: 'Importar fotos', onPress: () => void importInstead() }}
        onClose={() => router.back()}
      />
      {flow.overlay}
    </>
  );
}
