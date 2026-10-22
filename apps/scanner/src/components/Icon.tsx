import { Canvas, Group, Path } from '@shopify/react-native-skia';

/** Trazos del diseño (viewBox 24×24), dibujados con Skia para no añadir react-native-svg. */
const PATHS = {
  scan: 'M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3M7 12h10',
  image: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM11 9a2 2 0 1 1-4 0a2 2 0 1 1 4 0zM21 15l-5-5L5 21',
  corners: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
  rotate: 'M20 11a8 8 0 1 0-2.34 5.66M20 4v7h-7',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 24, color, strokeWidth = 1.5 }: { name: IconName; size?: number; color: string; strokeWidth?: number }) {
  return (
    <Canvas style={{ width: size, height: size }} pointerEvents="none">
      <Group transform={[{ scale: size / 24 }]}>
        <Path path={PATHS[name]} style="stroke" strokeWidth={strokeWidth} color={color} strokeCap="round" strokeJoin="round" />
      </Group>
    </Canvas>
  );
}
