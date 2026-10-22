import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  appendPages,
  createDocument,
  defaultDocumentName,
  documentMeta,
  formatBytes,
  FULL_QUAD,
  isFullQuad,
  isPdfStale,
  isValidQuad,
  markPdf,
  movePage,
  removePage,
  renameDocument,
  reorderPages,
  rotateBy,
  safeFileName,
  sortedPages,
  updatePage,
  type ScanPage,
} from '../src/index.ts';

const t0 = new Date('2026-10-02T10:00:00Z');
const t1 = new Date('2026-10-02T10:05:00Z');
const t2 = new Date('2026-10-02T10:10:00Z');

function page(id: string): ScanPage {
  return {
    id,
    sourceUri: `file:///src/${id}.jpg`,
    sourceWidth: 1000,
    sourceHeight: 1400,
    processedUri: `file:///p/${id}.jpg`,
    thumbUri: `file:///t/${id}.jpg`,
    width: 1000,
    height: 1400,
    rotation: 0,
    filter: 'original',
    crop: null,
    origin: 'scanner',
    sortOrder: 99,
  };
}

const ids = (pages: ScanPage[]) => sortedPages(pages).map((p) => p.id);

test('createDocument usa nombre por defecto en español', () => {
  const doc = createDocument('d1', t0);
  assert.equal(doc.name, 'Escaneo 2 oct');
  assert.equal(doc.pages.length, 0);
  assert.equal(defaultDocumentName(new Date(2026, 0, 15)), 'Escaneo 15 ene');
});

test('appendPages añade al final y renumera', () => {
  let doc = createDocument('d1', t0);
  doc = appendPages(doc, [page('a'), page('b')], t1);
  doc = appendPages(doc, [page('c')], t2);
  assert.deepEqual(ids(doc.pages), ['a', 'b', 'c']);
  assert.deepEqual(doc.pages.map((p) => p.sortOrder), [0, 1, 2]);
  assert.equal(doc.updatedAt, t2.toISOString());
});

test('removePage y movePage mantienen el orden consecutivo', () => {
  let doc = appendPages(createDocument('d1', t0), ['a', 'b', 'c', 'd'].map(page), t0);
  doc = movePage(doc, 0, 2, t1);
  assert.deepEqual(ids(doc.pages), ['b', 'c', 'a', 'd']);
  doc = removePage(doc, 'c', t2);
  assert.deepEqual(ids(doc.pages), ['b', 'a', 'd']);
  assert.deepEqual(sortedPages(doc.pages).map((p) => p.sortOrder), [0, 1, 2]);
  assert.equal(movePage(doc, 0, 9, t2), doc, 'índices fuera de rango no cambian nada');
});

test('reorderPages aplica el orden y conserva páginas no listadas', () => {
  const doc = appendPages(createDocument('d1', t0), ['a', 'b', 'c'].map(page), t0);
  const next = reorderPages(doc, ['c', 'x', 'a'], t1);
  assert.deepEqual(ids(next.pages), ['c', 'a', 'b']);
  assert.equal(reorderPages(doc, ['a', 'b', 'c'], t1), doc, 'mismo orden devuelve el mismo objeto');
});

test('updatePage y estado del PDF', () => {
  let doc = appendPages(createDocument('d1', t0), [page('a')], t0);
  assert.equal(isPdfStale(doc), true);
  doc = markPdf(doc, 'file:///x.pdf', 1234, t1);
  assert.equal(isPdfStale(doc), false);
  doc = updatePage(doc, 'a', { filter: 'bw' }, t2);
  assert.equal(doc.pages[0]!.filter, 'bw');
  assert.equal(isPdfStale(doc), true);
});

test('renameDocument ignora nombres vacíos o iguales', () => {
  const doc = createDocument('d1', t0, 'Factura');
  assert.equal(renameDocument(doc, '   ', t1), doc);
  assert.equal(renameDocument(doc, 'Factura', t1), doc);
  assert.equal(renameDocument(doc, ' Factura luz ', t1).name, 'Factura luz');
});

test('rotateBy da la vuelta correctamente', () => {
  assert.equal(rotateBy(0, 90), 90);
  assert.equal(rotateBy(270, 90), 0);
  assert.equal(rotateBy(0, -90), 270);
  assert.equal(rotateBy(90, 180), 270);
});

test('validación de cuadriláteros', () => {
  assert.equal(isFullQuad(null), true);
  assert.equal(isFullQuad(FULL_QUAD), true);
  assert.equal(isValidQuad(FULL_QUAD), true);
  const crossed = { tl: { x: 0, y: 0 }, tr: { x: 1, y: 1 }, br: { x: 1, y: 0 }, bl: { x: 0, y: 1 } };
  assert.equal(isValidQuad(crossed), false);
  const tiny = { tl: { x: 0.5, y: 0.5 }, tr: { x: 0.51, y: 0.5 }, br: { x: 0.51, y: 0.51 }, bl: { x: 0.5, y: 0.51 } };
  assert.equal(isValidQuad(tiny), false);
  const tilted = { tl: { x: 0.1, y: 0.05 }, tr: { x: 0.9, y: 0.12 }, br: { x: 0.85, y: 0.95 }, bl: { x: 0.05, y: 0.9 } };
  assert.equal(isValidQuad(tilted), true);
});

test('formatos de presentación', () => {
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(2048), '2 KB');
  assert.equal(formatBytes(1_258_291), '1,2 MB');
  assert.equal(safeFileName('  Contrato: alquiler/2026?  '), 'Contrato alquiler 2026');
  assert.equal(safeFileName('...'), 'Documento');
  const doc = appendPages(createDocument('d1', t0), [page('a'), page('b')], t0);
  assert.equal(documentMeta(doc), '2 págs · 2 oct');
});
