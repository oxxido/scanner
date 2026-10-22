import { pageIndex, rotateBy, SCAN_FILTERS, sortedPages, type ScanFilter } from '@scanner/document-model';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, type IconName } from '../../../../src/components/Icon';
import { ScreenMessage, TopBar } from '../../../../src/components/ui';
import { deletePage, updatePageSettings, type PageSettings } from '../../../../src/services/pages';
import { useDocument } from '../../../../src/storage/store';
import { colors, filterSwatches, fonts } from '../../../../src/theme';

/** 1d · Editor de página: filtros, esquinas, giro y borrado. */
export default function PageEditor() {
  const { id, pageId } = useLocalSearchParams<{ id: string; pageId: string }>();
  const router = useRouter();
  const doc = useDocument(id);
  const [busy, setBusy] = useState(false);
  const pages = useMemo(() => (doc ? sortedPages(doc.pages) : []), [doc]);
  const index = doc ? pageIndex(doc, pageId) : -1;
  const page = pages[index];

  if (!doc || !page) {
    return (
      <SafeAreaView style={s.root}>
        <TopBar left={{ label: 'Atrás', onPress: () => router.back() }} />
        <ScreenMessage>Esta página ya no existe.</ScreenMessage>
      </SafeAreaView>
    );
  }

  async function apply(settings: PageSettings) {
    if (busy) return;
    setBusy(true);
    try {
      await updatePageSettings(id, pageId, settings);
    } catch (err) {
      Alert.alert('No se pudo aplicar el cambio', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    Alert.alert(`¿Eliminar la página ${index + 1}?`, undefined, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          router.back();
          void deletePage(id, pageId);
        },
      },
    ]);
  }

  const go = (delta: number) => {
    const target = pages[index + delta];
    if (target && !busy) router.setParams({ pageId: target.id });
  };

  const tools: { icon: IconName; label: string; color: string; onPress: () => void }[] = [
    { icon: 'corners', label: 'Esquinas', color: colors.ink, onPress: () => router.push(`/document/${id}/corners/${pageId}`) },
    { icon: 'rotate', label: 'Rotar', color: colors.ink, onPress: () => void apply({ rotation: rotateBy(page.rotation, 90) }) },
    { icon: 'trash', label: 'Eliminar', color: colors.danger, onPress: remove },
  ];

  return (
    <SafeAreaView style={s.root} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      <TopBar
        left={{ label: 'Atrás', onPress: () => router.back() }}
        title={`Página ${index + 1} de ${pages.length}`}
        right={{ label: 'Listo', onPress: () => router.back(), disabled: busy }}
      />

      <View style={s.previewArea}>
        <Image key={page.processedUri} source={{ uri: page.processedUri }} style={s.preview} resizeMode="contain" accessibilityLabel={`Página ${index + 1}`} />
        {busy && (
          <View style={s.busy}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}
        {index > 0 && <Arrow side="left" onPress={() => go(-1)} />}
        {index < pages.length - 1 && <Arrow side="right" onPress={() => go(1)} />}
      </View>

      <View style={s.filters} accessibilityRole="radiogroup">
        {SCAN_FILTERS.map((f) => (
          <FilterSwatch key={f} filter={f} selected={page.filter === f} disabled={busy} onPress={() => page.filter !== f && void apply({ filter: f })} />
        ))}
      </View>

      <View style={s.tools}>
        {tools.map((t) => (
          <Pressable key={t.label} accessibilityRole="button" disabled={busy} onPress={t.onPress} style={({ pressed }) => [s.tool, (pressed || busy) && { opacity: 0.5 }]}>
            <Icon name={t.icon} size={28} color={t.color} />
            <Text style={[s.toolLabel, { color: t.color }]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

function FilterSwatch({ filter, selected, disabled, onPress }: { filter: ScanFilter; selected: boolean; disabled: boolean; onPress: () => void }) {
  const sw = filterSwatches[filter];
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={`Filtro ${sw.label}`}
      disabled={disabled}
      onPress={onPress}
      style={s.filter}
    >
      <View style={[s.swatch, { backgroundColor: sw.bg }, selected ? s.swatchSelected : null]}>
        {filter === 'bw' && <View style={s.swatchHalf} />}
      </View>
      <Text style={[s.filterLabel, selected && { color: colors.primary, fontFamily: fonts.semibold }]}>{sw.label}</Text>
    </Pressable>
  );
}

function Arrow({ side, onPress }: { side: 'left' | 'right'; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={side === 'left' ? 'Página anterior' : 'Página siguiente'}
      onPress={onPress}
      hitSlop={8}
      style={[s.arrow, side === 'left' ? { left: 4 } : { right: 4 }]}
    >
      <Text style={s.arrowText}>{side === 'left' ? '‹' : '›'}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  previewArea: { flex: 1, marginHorizontal: 24, marginTop: 6, justifyContent: 'center' },
  preview: { width: '100%', height: '100%' },
  busy: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F6F1E799' },
  arrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FCFAF5dd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: { fontSize: 30, lineHeight: 32, color: colors.head },
  filters: { flexDirection: 'row', gap: 10, paddingHorizontal: 24, paddingTop: 18, paddingBottom: 14 },
  filter: { flex: 1, alignItems: 'center', gap: 6 },
  swatch: { width: '100%', height: 64, borderRadius: 10, borderWidth: 1, borderColor: '#d9d2c1', overflow: 'hidden' },
  swatchSelected: { borderWidth: 2, borderColor: colors.primary },
  swatchHalf: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '50%', backgroundColor: '#222' },
  filterLabel: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted },
  tools: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 16,
    paddingBottom: 34,
  },
  tool: { alignItems: 'center', gap: 6, minWidth: 80 },
  toolLabel: { fontFamily: fonts.medium, fontSize: 14 },
});
