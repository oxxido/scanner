import { clampQuad, FULL_QUAD, isFullQuad, isValidQuad, type Point, type Quad } from '@scanner/document-model';
import { Canvas, Circle, Path } from '@shopify/react-native-skia';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useRef, useState } from 'react';
import { Alert, Image, PanResponder, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton, ScreenMessage, SecondaryButton, TopBar } from '../../../../src/components/ui';
import { updatePageSettings } from '../../../../src/services/pages';
import { useDocument } from '../../../../src/storage/store';
import { colors, fonts } from '../../../../src/theme';

type Corner = keyof Quad;
const CORNERS: Corner[] = ['tl', 'tr', 'br', 'bl'];
const MARGIN = 28; // deja sitio para agarrar las esquinas que están en el borde de la imagen
const TOUCH_RADIUS = 56;

function fitRect(w: number, h: number, areaW: number, areaH: number) {
  const scale = Math.min((areaW - MARGIN * 2) / w, (areaH - MARGIN * 2) / h);
  const width = w * scale;
  const height = h * scale;
  return { x: (areaW - width) / 2, y: (areaH - height) / 2, width, height };
}

/**
 * 1c · Ajuste de esquinas sobre la imagen fuente.
 * Para fotos importadas es la corrección de perspectiva completa; para páginas escaneadas,
 * un recorte adicional sobre lo que ya entregó el escáner del sistema.
 */
export default function CornersScreen() {
  const { id, pageId } = useLocalSearchParams<{ id: string; pageId: string }>();
  const router = useRouter();
  const doc = useDocument(id);
  const page = doc?.pages.find((p) => p.id === pageId);
  const [quad, setQuad] = useState<Quad>(page?.crop ?? FULL_QUAD);
  const [area, setArea] = useState<{ width: number; height: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const fit = useMemo(() => (area && page ? fitRect(page.sourceWidth, page.sourceHeight, area.width, area.height) : null), [area, page]);
  const quadRef = useRef(quad);
  quadRef.current = quad;
  const fitRef = useRef(fit);
  fitRef.current = fit;
  const drag = useRef<{ corner: Corner; start: Point } | null>(null);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          const f = fitRef.current;
          if (!f) return;
          const { locationX, locationY } = e.nativeEvent;
          let best: Corner | null = null;
          let bestDistance = TOUCH_RADIUS;
          for (const c of CORNERS) {
            const p = quadRef.current[c];
            const d = Math.hypot(f.x + p.x * f.width - locationX, f.y + p.y * f.height - locationY);
            if (d < bestDistance) {
              best = c;
              bestDistance = d;
            }
          }
          drag.current = best ? { corner: best, start: quadRef.current[best] } : null;
        },
        onPanResponderMove: (_e, g) => {
          const f = fitRef.current;
          const d = drag.current;
          if (!f || !d) return;
          const next = clampQuad({ ...quadRef.current, [d.corner]: { x: d.start.x + g.dx / f.width, y: d.start.y + g.dy / f.height } });
          // Se ignoran posiciones que cruzarían los lados o dejarían un área mínima.
          if (isValidQuad(next)) setQuad(next);
        },
        onPanResponderRelease: () => {
          drag.current = null;
        },
        onPanResponderTerminate: () => {
          drag.current = null;
        },
      }),
    [],
  );

  if (!doc || !page) {
    return (
      <SafeAreaView style={s.root}>
        <TopBar dark left={{ label: 'Atrás', onPress: () => router.back() }} />
        <ScreenMessage>Esta página ya no existe.</ScreenMessage>
      </SafeAreaView>
    );
  }

  async function confirm() {
    setSaving(true);
    try {
      await updatePageSettings(id, pageId, { crop: isFullQuad(quad) ? null : quad });
      router.back();
    } catch (err) {
      setSaving(false);
      Alert.alert('No se pudo recortar', err instanceof Error ? err.message : String(err));
    }
  }

  const points = fit ? CORNERS.map((c) => ({ key: c, x: fit.x + quad[c].x * fit.width, y: fit.y + quad[c].y * fit.height })) : [];
  const outline = points.length ? `M ${points.map((p) => `${p.x} ${p.y}`).join(' L ')} Z` : '';

  return (
    <SafeAreaView style={s.root}>
      <StatusBar style="light" />
      <TopBar dark left={{ label: 'Cancelar', onPress: () => router.back() }} />
      <Text style={s.title}>Ajustar esquinas</Text>
      <Text style={s.hint}>
        {page.origin === 'import'
          ? 'Arrastra cada esquina hasta el borde del documento.'
          : 'El escáner ya recortó la página. Ajusta solo si sobra algún borde.'}
      </Text>

      <View style={s.area} onLayout={(e) => setArea({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
        {fit && (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Image source={{ uri: page.sourceUri }} style={{ position: 'absolute', left: fit.x, top: fit.y, width: fit.width, height: fit.height }} />
            <Canvas style={StyleSheet.absoluteFill}>
              <Path path={outline} color={colors.scanFill} />
              <Path path={outline} style="stroke" strokeWidth={3} strokeJoin="round" color={colors.scanLine} />
              {points.map((p) => (
                <Circle key={`${p.key}-fill`} cx={p.x} cy={p.y} r={15} color={colors.dark} />
              ))}
              {points.map((p) => (
                <Circle key={`${p.key}-ring`} cx={p.x} cy={p.y} r={15} style="stroke" strokeWidth={3} color={colors.scanLine} />
              ))}
            </Canvas>
          </View>
        )}
        <View style={StyleSheet.absoluteFill} {...responder.panHandlers} />
      </View>

      <View style={s.actions}>
        <SecondaryButton dark label="Restablecer" onPress={() => setQuad(FULL_QUAD)} disabled={saving} style={{ flex: 1 }} />
        <PrimaryButton label="Confirmar" onPress={() => void confirm()} busy={saving} style={{ flex: 1, height: 60 }} />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.dark },
  title: { fontFamily: fonts.condSemibold, fontSize: 26, color: colors.white, paddingHorizontal: 24 },
  hint: { fontFamily: fonts.regular, fontSize: 15, color: '#ffffffaa', paddingHorizontal: 24, marginTop: 4 },
  area: { flex: 1, marginTop: 8 },
  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingBottom: 12, paddingTop: 8 },
});
