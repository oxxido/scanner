/** Tokens del diseño (Scanner App · canvas). */
export const colors = {
  bg: '#F6F1E7',
  card: '#FCFAF5',
  line: '#E3DCCB',
  ink: '#252B2D',
  head: '#183F50',
  primary: '#245C73',
  primaryTint: '#DCEBF0',
  muted: '#747773',
  ok: '#718C72',
  okTint: '#DCE5D8',
  danger: '#9a3b2e',
  dangerTint: '#F3DDD8',
  dark: '#1B1F20',
  darkRaised: '#2a2e2f',
  scanLine: '#7FD0F0',
  scanFill: '#8EC9DD33',
  white: '#FFFFFF',
} as const;

export const fonts = {
  regular: 'Barlow_400Regular',
  medium: 'Barlow_500Medium',
  semibold: 'Barlow_600SemiBold',
  condMedium: 'BarlowCondensed_500Medium',
  condSemibold: 'BarlowCondensed_600SemiBold',
  condBold: 'BarlowCondensed_700Bold',
} as const;

export const radius = { card: 16, cta: 32, tile: 8 } as const;

/** Muestras de color de los filtros, como en el diseño. */
export const filterSwatches = {
  original: { label: 'Original', bg: '#eee9dc' },
  magic: { label: 'Magic', bg: '#fffdf6' },
  grayscale: { label: 'Gris', bg: '#c9c9c6' },
  bw: { label: 'B&N', bg: '#ffffff' },
} as const;
