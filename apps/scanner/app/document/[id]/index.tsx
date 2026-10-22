import { pagesLabelLong, sortedPages, type ScanPage } from '@scanner/document-model';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedRef } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Sortable from 'react-native-sortables';

import { RenameModal } from '../../../src/components/RenameModal';
import { PrimaryButton, ProgressModal, ScreenMessage, TopBar, type ProgressState } from '../../../src/components/ui';
import { useCaptureFlow } from '../../../src/hooks/useCaptureFlow';
import { deletePage, renameDocument, reorderDocument } from '../../../src/services/pages';
import { ensurePdf } from '../../../src/services/pdf';
import { useDocument } from '../../../src/storage/store';
import { colors, fonts, radius } from '../../../src/theme';

const GAP = 10;
const PADDING = 24;

/** 1e · Documento multipágina: miniaturas, reordenar, eliminar, añadir y crear PDF. */
export default function DocumentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const doc = useDocument(id);
  const flow = useCaptureFlow({ docId: id });
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const { width } = useWindowDimensions();
  const [renaming, setRenaming] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<ProgressState | null>(null);
  const pages = useMemo(() => (doc ? sortedPages(doc.pages) : []), [doc]);
  const tileWidth = (width - PADDING * 2 - GAP * 2) / 3;

  const goHome = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (!doc) {
    return (
      <SafeAreaView style={s.root}>
        <TopBar left={{ label: 'Inicio', onPress: goHome }} />
        <ScreenMessage>Este documento ya no existe.</ScreenMessage>
      </SafeAreaView>
    );
  }

  function confirmDelete(page: ScanPage, index: number) {
    Alert.alert(`¿Eliminar la página ${index + 1}?`, undefined, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => void deletePage(doc!.id, page.id) },
    ]);
  }

  function addPages() {
    Alert.alert('Añadir páginas', undefined, [
      { text: 'Escanear', onPress: () => void flow.scan() },
      { text: 'Importar fotos', onPress: () => void flow.importPhotos() },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  async function createPdf() {
    const total = pages.length;
    setPdfProgress({ title: 'Creando PDF…', body: pagesLabelLong(total), progress: 0, icon: '▤' });
    try {
      await ensurePdf(doc!.id, (done, n) => setPdfProgress({ title: 'Creando PDF…', body: pagesLabelLong(n), progress: done / n, icon: '▤' }));
      setPdfProgress(null);
      router.push(`/document/${doc!.id}/done`);
    } catch (err) {
      setPdfProgress(null);
      Alert.alert('No se pudo crear el PDF', err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <SafeAreaView style={s.root} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      <TopBar left={{ label: 'Inicio', onPress: goHome }} right={{ label: 'Renombrar', onPress: () => setRenaming(true) }} />
      <Animated.ScrollView ref={scrollRef} contentContainerStyle={s.content}>
        <Pressable accessibilityRole="button" accessibilityHint="Renombrar" onPress={() => setRenaming(true)}>
          <Text style={s.title} numberOfLines={2}>
            {doc.name}
          </Text>
        </Pressable>
        <Text style={s.subtitle}>
          {pagesLabelLong(pages.length)}
          {pages.length > 1 ? ' · mantén pulsado para reordenar' : ''}
        </Text>

        <View style={{ marginTop: 16 }}>
          <Sortable.Grid
            columns={3}
            data={pages}
            keyExtractor={(p) => p.id}
            rowGap={GAP}
            columnGap={GAP}
            scrollableRef={scrollRef}
            onDragEnd={({ data }) => void reorderDocument(doc.id, data.map((p) => p.id))}
            renderItem={({ item, index }) => (
              <PageTile
                page={item}
                number={index + 1}
                onOpen={() => router.push(`/document/${doc.id}/page/${item.id}`)}
                onDelete={() => confirmDelete(item, index)}
              />
            )}
          />
        </View>

        <Pressable accessibilityRole="button" onPress={addPages} style={[s.addTile, { width: tileWidth, marginTop: pages.length ? GAP : 0 }]}>
          <Text style={s.addPlus}>+</Text>
          <Text style={s.addLabel}>Añadir</Text>
        </Pressable>
      </Animated.ScrollView>

      <View style={s.footer}>
        <PrimaryButton label="Crear PDF" disabled={pages.length === 0} onPress={() => void createPdf()} />
      </View>

      <RenameModal
        visible={renaming}
        initial={doc.name}
        onCancel={() => setRenaming(false)}
        onSave={(name) => {
          setRenaming(false);
          void renameDocument(doc.id, name);
        }}
      />
      <ProgressModal state={pdfProgress} />
      {flow.overlay}
    </SafeAreaView>
  );
}

function PageTile({ page, number, onOpen, onDelete }: { page: ScanPage; number: number; onOpen: () => void; onDelete: () => void }) {
  return (
    <View style={s.tile}>
      <Sortable.Touchable onTap={onOpen} style={StyleSheet.absoluteFill}>
        <Image source={{ uri: page.thumbUri }} style={s.tileImage} resizeMode="cover" accessibilityLabel={`Página ${number}`} />
      </Sortable.Touchable>
      <View style={s.badge} pointerEvents="none">
        <Text style={s.badgeText}>{number}</Text>
      </View>
      <Sortable.Touchable onTap={onDelete} style={s.remove}>
        <Text style={s.removeText} accessibilityLabel={`Eliminar página ${number}`}>
          ✕
        </Text>
      </Sortable.Touchable>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: PADDING, paddingBottom: 140 },
  title: { fontFamily: fonts.condBold, fontSize: 34, lineHeight: 36, color: colors.head },
  subtitle: { fontFamily: fonts.regular, fontSize: 15, color: colors.muted, marginTop: 4 },
  tile: {
    aspectRatio: 3 / 4,
    borderRadius: radius.tile,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  tileImage: { width: '100%', height: '100%' },
  badge: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.head,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { color: colors.white, fontFamily: fonts.semibold, fontSize: 13 },
  remove: {
    position: 'absolute',
    right: 6,
    top: 6,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FCFAF5ee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { fontSize: 15, color: colors.muted },
  addTile: {
    aspectRatio: 3 / 4,
    borderRadius: radius.tile,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  addPlus: { fontSize: 34, lineHeight: 36, color: colors.primary },
  addLabel: { fontFamily: fonts.medium, fontSize: 15, color: colors.primary },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 34, backgroundColor: colors.bg },
});
