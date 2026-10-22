import { test } from 'node:test';
import assert from 'node:assert/strict';

import { apply, fitWithin, planRender, squareToQuad, type QuadPoints, type Vec2 } from '../src/geometry.ts';

function near(actual: Vec2, expected: Vec2, msg?: string) {
  assert.ok(
    Math.abs(actual.x - expected.x) < 1e-6 && Math.abs(actual.y - expected.y) < 1e-6,
    `${msg ?? ''} esperado (${expected.x}, ${expected.y}) y salió (${actual.x}, ${actual.y})`,
  );
}

const perspective: QuadPoints = {
  tl: { x: 120, y: 80 },
  tr: { x: 900, y: 140 },
  br: { x: 860, y: 1300 },
  bl: { x: 60, y: 1180 },
};

test('squareToQuad lleva las esquinas del cuadrado unidad a las del cuadrilátero', () => {
  const m = squareToQuad(perspective);
  near(apply(m, { x: 0, y: 0 }), perspective.tl, 'tl');
  near(apply(m, { x: 1, y: 0 }), perspective.tr, 'tr');
  near(apply(m, { x: 1, y: 1 }), perspective.br, 'br');
  near(apply(m, { x: 0, y: 1 }), perspective.bl, 'bl');
});

test('sin recorte ni giro, la salida es la fuente tal cual', () => {
  const plan = planRender(1000, 1400, null, 0, 4000);
  assert.equal(plan.width, 1000);
  assert.equal(plan.height, 1400);
  near(apply(plan.matrix, { x: 0, y: 0 }), { x: 0, y: 0 });
  near(apply(plan.matrix, { x: 1000, y: 1400 }), { x: 1000, y: 1400 });
  near(apply(plan.matrix, { x: 500, y: 700 }), { x: 500, y: 700 });
});

test('maxDimension reduce sin deformar', () => {
  const plan = planRender(3000, 4000, null, 0, 2000);
  assert.equal(plan.width, 1500);
  assert.equal(plan.height, 2000);
  near(apply(plan.matrix, { x: 1500, y: 2000 }), { x: 3000, y: 4000 });
});

test('giro de 90° horario: arriba a la izquierda de la salida es abajo a la izquierda de la fuente', () => {
  const plan = planRender(1000, 1400, null, 90, 4000);
  assert.equal(plan.width, 1400);
  assert.equal(plan.height, 1000);
  near(apply(plan.matrix, { x: 0, y: 0 }), { x: 0, y: 1400 });
  near(apply(plan.matrix, { x: 1400, y: 0 }), { x: 0, y: 0 });
  near(apply(plan.matrix, { x: 1400, y: 1000 }), { x: 1000, y: 0 });
});

test('giros de 180° y 270°', () => {
  const p180 = planRender(1000, 1400, null, 180, 4000);
  near(apply(p180.matrix, { x: 0, y: 0 }), { x: 1000, y: 1400 });
  const p270 = planRender(1000, 1400, null, 270, 4000);
  assert.equal(p270.width, 1400);
  near(apply(p270.matrix, { x: 0, y: 0 }), { x: 1000, y: 0 });
  near(apply(p270.matrix, { x: 0, y: 1000 }), { x: 0, y: 0 });
});

test('recorte en perspectiva: las esquinas de la salida caen en las del cuadrilátero', () => {
  const w = 1000;
  const h = 1400;
  const norm: QuadPoints = {
    tl: { x: perspective.tl.x / w, y: perspective.tl.y / h },
    tr: { x: perspective.tr.x / w, y: perspective.tr.y / h },
    br: { x: perspective.br.x / w, y: perspective.br.y / h },
    bl: { x: perspective.bl.x / w, y: perspective.bl.y / h },
  };
  const plan = planRender(w, h, norm, 0, 4000);
  near(apply(plan.matrix, { x: 0, y: 0 }), perspective.tl);
  near(apply(plan.matrix, { x: plan.width, y: 0 }), perspective.tr);
  near(apply(plan.matrix, { x: plan.width, y: plan.height }), perspective.br);
  near(apply(plan.matrix, { x: 0, y: plan.height }), perspective.bl);
  // Ancho = lado superior/inferior más largo; alto = lado izquierdo/derecho más largo.
  assert.equal(plan.width, Math.round(Math.max(Math.hypot(780, 60), Math.hypot(800, 120))));
  assert.equal(plan.height, Math.round(Math.max(Math.hypot(60, 1100), Math.hypot(40, 1160))));
});

test('fitWithin', () => {
  assert.deepEqual(fitWithin(2000, 1000, 360), { width: 360, height: 180 });
  assert.deepEqual(fitWithin(100, 50, 360), { width: 100, height: 50 });
});
