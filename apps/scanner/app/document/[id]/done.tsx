import { formatBytes, isPdfStale, pagesLabelLong, sortedPages } from '@scanner/document-model';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RenameModal } from '../../../src/components/RenameModal';
import { PrimaryButton, ProgressModal, ScreenMessage, SecondaryButton, TextLink, TopBar, type ProgressState } from '../../../src/components/ui';
import { deleteDocument, renameDocument } from '../../../src/services/pages';
import { ensurePdf, savePdfCopy, sharePdf } from '../../../src/services/pdf';
import { useDocument } from '../../../src/storage/store';
import { colors, fonts } from '../../../src/theme';

function showError(title: string, err: unknown) {
  Alert.alert(title, err instanceof Error ? err.message : String(err));
}

/** 1f / 2h · PDF creado: compartir, guardar, editar, renombrar y eliminar. */
export default function DoneScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const doc = useDocument(id);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [busy, setBusy] = useState<'share' | 'save' | null>(null);
  const stale = doc ? isPdfStale(doc) : false;

  const fresh = useCallback(
    () =>
      ensurePdf(id, (done, n) => setProgress({ title: 'Creando PDF…', body: pagesLabelLong(n), progress: done / n, icon: '▤' })).finally(() =>
        setProgress(null),
      ),
    [id],
  );

  // Tras renombrar (o editar páginas) el PDF queda desactualizado: se regenera aquí mismo.
  useEffect(() => {
    if (stale && doc && doc.pages.length > 0) fresh().catch((err) => showError('No se pudo crear el PDF', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stale]);

  const goHome = () => router.dismissTo('/');

  if (!doc) {
    return (
      <SafeAreaView style={s.root}>
        <TopBar left={{ label: 'Inicio', onPress: goHome }} />
        <ScreenMessage>Este documento ya no existe.</ScreenMessage>
      </SafeAreaView>
    );
  }
  const first = sortedPages(doc.pages)[0];

  async function share() {
    setBusy('share');
    try {
      await sharePdf(await fresh());
    } catch (err) {
      showError('No se pudo compartir', err);
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    setBusy('save');
    try {
      const result = await savePdfCopy(await fresh());
      if (result === 'saved') Alert.alert('PDF guardado', 'Se ha guardado una copia en la carpeta elegida.');
    } catch (err) {
      showError('No se pudo guardar', err);
    } finally {
      setBusy(null);
    }
  }

  function remove() {
    Alert.alert('¿Eliminar el documento?', 'Se borrarán sus páginas y el PDF. No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          goHome();
          void deleteDocument(doc!.id);
        },
      },
    ]);
  }

  const meta = `${pagesLabelLong(doc.pages.length)} · PDF${doc.pdfSize && !stale ? ` · ${formatBytes(doc.pdfSize)}` : ''}`;

  return (
    <SafeAreaView style={s.root} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      <TopBar left={{ label: 'Inicio', onPress: goHome }} right={{ label: 'Renombrar', onPress: () => setRenaming(true) }} />
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.preview}>
          {first && <Image source={{ uri: first.processedUri }} style={s.previewImage} resizeMode="cover" accessibilityLabel="Primera página" />}
          <View style={s.check}>
            <Text style={s.checkText}>✓</Text>
          </View>
        </View>

        <Text style={s.name} numberOfLines={2}>
          {doc.name}
        </Text>
        <Text style={s.meta}>{meta}</Text>

        <View style={s.actions}>
          <PrimaryButton label="Compartir" onPress={() => void share()} busy={busy === 'share'} disabled={!!busy} />
          <View style={s.row}>
            <SecondaryButton
              label={Platform.OS === 'android' ? 'Guardar' : 'Guardar en Archivos'}
              onPress={() => void save()}
              disabled={!!busy}
              style={{ flex: 1 }}
            />
            <SecondaryButton
              label="Editar páginas"
              onPress={() => (router.canGoBack() ? router.back() : router.replace(`/document/${doc.id}`))}
              disabled={!!busy}
              style={{ flex: 1 }}
            />
          </View>
          <TextLink label="Eliminar" danger onPress={remove} />
        </View>
      </ScrollView>

      <RenameModal
        visible={renaming}
        initial={doc.name}
        onCancel={() => setRenaming(false)}
        onSave={(name) => {
          setRenaming(false);
          void renameDocument(doc.id, name);
        }}
      />
      <ProgressModal state={progress} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 24, paddingBottom: 40 },
  preview: {
    alignSelf: 'center',
    marginTop: 6,
    width: 210,
    height: 280,
    borderRadius: 6,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#d9d2c1',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  previewImage: { width: '100%', height: '100%', borderRadius: 6 },
  check: {
    position: 'absolute',
    right: -12,
    top: -12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.ok,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: { color: colors.white, fontSize: 20 },
  name: { marginTop: 24, textAlign: 'center', fontFamily: fonts.condBold, fontSize: 32, lineHeight: 34, color: colors.head },
  meta: { marginTop: 6, textAlign: 'center', fontFamily: fonts.regular, fontSize: 16, color: colors.muted },
  actions: { marginTop: 26, gap: 12 },
  row: { flexDirection: 'row', gap: 12 },
});
