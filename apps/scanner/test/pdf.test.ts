import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { pageSizeFor, PdfWriter, readJpegInfo, utf16Hex } from '../src/pdf/jpegPdf.ts';

const portrait = readFileSync(new URL('./fixtures/portrait.jpg', import.meta.url));
const landscapeGray = readFileSync(new URL('./fixtures/landscape-gray.jpg', import.meta.url));

test('lee dimensiones y componentes del JPEG', () => {
  assert.deepEqual(readJpegInfo(portrait), { width: 1240, height: 1754, components: 3 });
  assert.deepEqual(readJpegInfo(landscapeGray), { width: 1600, height: 900, components: 1 });
  assert.throws(() => readJpegInfo(new Uint8Array([1, 2, 3])));
});

test('tamaño de página: lado corto A4, lado largo proporcional', () => {
  const p = pageSizeFor(1000, 2000);
  assert.equal(p.width, 595.28);
  assert.equal(Math.round(p.height), 1191);
  const l = pageSizeFor(1600, 900);
  assert.equal(l.height, 595.28);
});

test('título en UTF-16', () => {
  assert.equal(utf16Hex('Añ'), '<FEFF004100F1>');
});

test('genera un PDF de dos páginas escribiendo por trozos', () => {
  const chunks: Uint8Array[] = [];
  const writer = new PdfWriter((c) => chunks.push(c));
  writer.addJpegPage(portrait);
  writer.addJpegPage(landscapeGray);
  writer.finish({ title: 'Contrato alquiler · señal', date: new Date('2026-10-02T10:00:00Z') });
  const pdf = Buffer.concat(chunks);
  assert.equal(writer.pageCount, 2);
  assert.equal(writer.bytesWritten, pdf.length);
  assert.ok(pdf.subarray(0, 8).toString('latin1') === '%PDF-1.4');
  assert.ok(pdf.length < portrait.length + landscapeGray.length + 4000, 'sin sobrecoste: los JPEG van tal cual');
  writeFileSync(process.env.PDF_OUT ?? join(tmpdir(), 'scanner-test.pdf'), pdf);
  assert.throws(() => writer.addJpegPage(portrait));
  assert.throws(() => new PdfWriter(() => {}).finish());
});
