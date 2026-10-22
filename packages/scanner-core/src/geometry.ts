/**
 * Geometría pura para el recorte en perspectiva. Sin dependencias: se prueba en Node.
 *
 * El render recorre cada píxel de SALIDA y pregunta "¿de qué píxel de la FUENTE viene?".
 * Esa pregunta la responde una única matriz 3×3 (homografía) que combina:
 *   salida → (rotación + escala) → contenido normalizado (u, v) → cuadrilátero en la fuente.
 */

export type Vec2 = { x: number; y: number };
export type QuadPoints = { tl: Vec2; tr: Vec2; br: Vec2; bl: Vec2 };
export type QuarterTurn = 0 | 90 | 180 | 270;
/** Matriz 3×3 por filas. */
export type Mat3 = [number, number, number, number, number, number, number, number, number];

export const UNIT_QUAD: QuadPoints = {
  tl: { x: 0, y: 0 },
  tr: { x: 1, y: 0 },
  br: { x: 1, y: 1 },
  bl: { x: 0, y: 1 },
};

export function multiply(a: Mat3, b: Mat3): Mat3 {
  const r = new Array<number>(9) as Mat3;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      r[i * 3 + j] = a[i * 3]! * b[j]! + a[i * 3 + 1]! * b[3 + j]! + a[i * 3 + 2]! * b[6 + j]!;
    }
  }
  return r;
}

export function apply(m: Mat3, p: Vec2): Vec2 {
  const w = m[6] * p.x + m[7] * p.y + m[8];
  return {
    x: (m[0] * p.x + m[1] * p.y + m[2]) / w,
    y: (m[3] * p.x + m[4] * p.y + m[5]) / w,
  };
}

/**
 * Homografía que lleva el cuadrado unidad (u, v) ∈ [0,1]² al cuadrilátero q:
 * (0,0)→tl, (1,0)→tr, (1,1)→br, (0,1)→bl. Método de Heckbert.
 */
export function squareToQuad(q: QuadPoints): Mat3 {
  const { x: x0, y: y0 } = q.tl;
  const { x: x1, y: y1 } = q.tr;
  const { x: x2, y: y2 } = q.br;
  const { x: x3, y: y3 } = q.bl;
  const sx = x0 - x1 + x2 - x3;
  const sy = y0 - y1 + y2 - y3;

  if (Math.abs(sx) < 1e-12 && Math.abs(sy) < 1e-12) {
    // Paralelogramo: transformación afín.
    return [x1 - x0, x3 - x0, x0, y1 - y0, y3 - y0, y0, 0, 0, 1];
  }

  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (sx * dy2 - dx2 * sy) / den;
  const h = (dx1 * sy - sx * dy1) / den;
  return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h, 1];
}

const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

export function quadToPixels(q: QuadPoints, width: number, height: number): QuadPoints {
  const s = (p: Vec2): Vec2 => ({ x: p.x * width, y: p.y * height });
  return { tl: s(q.tl), tr: s(q.tr), br: s(q.br), bl: s(q.bl) };
}

/** Tamaño natural del contenido recortado: el lado más largo de cada par de lados opuestos. */
export function contentSize(pixelQuad: QuadPoints): { width: number; height: number } {
  return {
    width: Math.max(dist(pixelQuad.tl, pixelQuad.tr), dist(pixelQuad.bl, pixelQuad.br)),
    height: Math.max(dist(pixelQuad.tl, pixelQuad.bl), dist(pixelQuad.tr, pixelQuad.br)),
  };
}

/**
 * Matriz afín que lleva coordenadas de píxel de SALIDA a coordenadas normalizadas del
 * contenido (u, v), para un giro horario de `rotation` grados.
 * cw/ch = tamaño del contenido ANTES de girar.
 */
export function outputToContent(rotation: QuarterTurn, cw: number, ch: number): Mat3 {
  switch (rotation) {
    case 0:
      return [1 / cw, 0, 0, 0, 1 / ch, 0, 0, 0, 1];
    case 90: // salida (x, y) ← contenido (u = y/cw, v = 1 - x/ch)
      return [0, 1 / cw, 0, -1 / ch, 0, 1, 0, 0, 1];
    case 180:
      return [-1 / cw, 0, 1, 0, -1 / ch, 1, 0, 0, 1];
    case 270: // salida (x, y) ← contenido (u = 1 - y/cw, v = x/ch)
      return [0, -1 / cw, 1, 1 / ch, 0, 0, 0, 0, 1];
  }
}

export type RenderPlan = {
  /** Tamaño final de la imagen procesada (ya girada). */
  width: number;
  height: number;
  /** Salida (píxel) → fuente (píxel). */
  matrix: Mat3;
};

/**
 * Calcula el plan de render de una página.
 * @param quad   recorte normalizado (0..1) sobre la fuente; null = imagen completa
 * @param maxDimension  lado mayor máximo del resultado; nunca se amplía
 */
export function planRender(
  sourceWidth: number,
  sourceHeight: number,
  quad: QuadPoints | null,
  rotation: QuarterTurn,
  maxDimension: number,
): RenderPlan {
  const pixelQuad = quadToPixels(quad ?? UNIT_QUAD, sourceWidth, sourceHeight);
  const natural = contentSize(pixelQuad);
  const longest = Math.max(natural.width, natural.height);
  const scale = maxDimension > 0 && longest > maxDimension ? maxDimension / longest : 1;
  const cw = Math.max(1, Math.round(natural.width * scale));
  const ch = Math.max(1, Math.round(natural.height * scale));
  const turned = rotation === 90 || rotation === 270;

  return {
    width: turned ? ch : cw,
    height: turned ? cw : ch,
    matrix: multiply(squareToQuad(pixelQuad), outputToContent(rotation, cw, ch)),
  };
}

/** Tamaño que cabe en un cuadrado de `max` píxeles manteniendo proporción. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
