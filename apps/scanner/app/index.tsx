import { documentMeta, sortedPages, type Document } from '@scanner/document-model';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '../src/components/Icon';
import { useCaptureFlow } from '../src/hooks/useCaptureFlow';
import { useDocuments } from '../src/storage/store';
import { colors, fonts } from '../src/theme';

export default function Home() {
  const router = useRouter();
  const docs = useDocuments();
  const flow = useCaptureFlow({ onCreated: (id) => router.push(`/document/${id}`) });

  return (
    <SafeAreaView style={s.root} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      <FlatList
        data={docs}
        keyExtractor={(d) => d.id}
        contentContainerStyle={s.content}
        ListHeaderComponent={
          <View>
            <Text style={s.title} accessibilityRole="header">
              ScannerTest
            </Text>
            <Pressable accessibilityRole="button" onPress={() => void flow.scan()} style={({ pressed }) => [s.scanCard, pressed && { opacity: 0.9 }]}>
              <Icon name="scan" size={34} color={colors.white} />
              <Text style={s.scanLabel}>Escanear</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => void flow.importPhotos()} style={({ pressed }) => [s.importRow, pressed && { opacity: 0.85 }]}>
              <Icon name="image" color={colors.primary} />
              <Text style={s.importLabel}>Importar fotos</Text>
            </Pressable>
            {docs.length > 0 && <Text style={s.section}>Recientes</Text>}
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => <RecentRow doc={item} onPress={() => router.push(`/document/${item.id}`)} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <View style={s.emptyIcon}>
              <Text style={{ fontSize: 40, color: colors.primary }}>▭</Text>
            </View>
            <Text style={s.emptyTitle}>Nada escaneado todavía</Text>
            <Text style={s.emptyBody}>Pulsa Escanear para crear tu primer PDF.</Text>
          </View>
        }
      />
      {flow.overlay}
    </SafeAreaView>
  );
}

function RecentRow({ doc, onPress }: { doc: Document; onPress: () => void }) {
  const first = sortedPages(doc.pages)[0];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${doc.name}, ${documentMeta(doc)}`}
      onPress={onPress}
      style={({ pressed }) => [s.row, pressed && { opacity: 0.85 }]}
    >
      {first ? <Image source={{ uri: first.thumbUri }} style={s.rowThumb} resizeMode="cover" /> : <View style={s.rowThumb} />}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.rowName} numberOfLines={1}>
          {doc.name}
        </Text>
        <Text style={s.rowMeta}>{documentMeta(doc)}</Text>
      </View>
      <Text style={s.chevron}>›</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 40 },
  title: { fontFamily: fonts.condBold, fontSize: 44, lineHeight: 46, color: colors.head },
  scanCard: {
    marginTop: 28,
    height: 132,
    borderRadius: 22,
    padding: 22,
    backgroundColor: colors.primary,
    justifyContent: 'space-between',
  },
  scanLabel: { fontFamily: fonts.condSemibold, fontSize: 34, lineHeight: 36, color: colors.white },
  importRow: {
    marginTop: 12,
    height: 60,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
  },
  importLabel: { fontFamily: fonts.medium, fontSize: 18, color: colors.head },
  section: { marginTop: 34, marginBottom: 10, fontFamily: fonts.condSemibold, fontSize: 22, letterSpacing: 1.3, color: colors.muted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 10,
  },
  rowThumb: { width: 48, height: 62, borderRadius: 5, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  rowName: { fontFamily: fonts.semibold, fontSize: 17, color: colors.ink },
  rowMeta: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, marginTop: 2 },
  chevron: { fontSize: 22, color: colors.muted },
  empty: { alignItems: 'center', marginTop: 56, gap: 12, paddingHorizontal: 20 },
  emptyIcon: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: fonts.condBold, fontSize: 30, color: colors.ink, textAlign: 'center' },
  emptyBody: { fontFamily: fonts.regular, fontSize: 17, color: colors.muted, textAlign: 'center' },
});
