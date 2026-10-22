/**
 * Shaders SkSL. Se ejecutan en GPU por cada píxel de salida.
 * Uniformes: se pasan como array plano de floats en el orden de declaración.
 * Hijos (uniform shader): se pasan en el orden de declaración.
 */

/**
 * Geometría: recorte en perspectiva + giro + escala en una sola pasada.
 * hx, hy, hz son las filas de la homografía salida→fuente (ver geometry.ts).
 */
export const WARP_SKSL = `
uniform shader image;
uniform float3 hx;
uniform float3 hy;
uniform float3 hz;

half4 main(float2 p) {
  float3 q = float3(p, 1.0);
  float w = dot(hz, q);
  float2 s = float2(dot(hx, q), dot(hy, q)) / w;
  return image.eval(s);
}
`;

/** Escala de grises perceptual. */
export const GRAYSCALE_SKSL = `
uniform shader image;

half4 main(float2 p) {
  half3 c = image.eval(p).rgb;
  half l = dot(c, half3(0.299, 0.587, 0.114));
  return half4(half3(l), 1.0);
}
`;

/**
 * Normalización de fondo compartida por "magic" y "bw".
 * Divide cada píxel por una estimación del papel (imagen pequeña, dilatada y desenfocada):
 * el papel queda blanco aunque tenga sombras, el texto conserva su contraste.
 * El mínimo de 0.45 evita que zonas oscuras grandes (logos, fotos) se conviertan en papel.
 */
const NORMALIZE = `
uniform shader image;
uniform shader background;
uniform float2 bgScale;

half3 normalized(float2 p) {
  half3 c = image.eval(p).rgb;
  half3 bg = background.eval(p * bgScale).rgb;
  half3 n = clamp(c / max(bg, half3(0.45)), 0.0, 1.0);
  // Niveles: lo que queda por debajo de 0.10 es negro, por encima de 0.92 blanco.
  return clamp((n - 0.10) / 0.82, 0.0, 1.0);
}
`;

/** Color mejorado: fondo limpio, texto más oscuro, colores algo más vivos. */
export const MAGIC_SKSL = `${NORMALIZE}
half4 main(float2 p) {
  half3 n = pow(normalized(p), half3(1.35));
  half l = dot(n, half3(0.299, 0.587, 0.114));
  n = clamp(mix(half3(l), n, 1.3), 0.0, 1.0);
  return half4(n, 1.0);
}
`;

/** Blanco y negro: umbral sobre la imagen normalizada, con un borde suave para no pixelar el texto. */
export const BW_SKSL = `${NORMALIZE}
half4 main(float2 p) {
  half l = dot(normalized(p), half3(0.299, 0.587, 0.114));
  half v = smoothstep(0.60, 0.72, l);
  return half4(half3(v), 1.0);
}
`;
