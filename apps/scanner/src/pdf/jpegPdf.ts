/**
 * Escritor de PDF mínimo para documentos escaneados.
 *
 * Incrusta cada JPEG tal cual (filtro DCTDecode): sin recomprimir, sin WebView y sin
 * cargar el documento entero en memoria. Las páginas se escriben de una en una a un
 * "sink" (normalmente un fichero en modo append).
 *
 * Tamaño de página: el lado corto mide como un A4 (595,28 pt) y el largo sigue la
 * proporción de la imagen, así un ticket largo no queda encogido en una hoja A4.
 *
 * Sin dependencias: se prueba en Node con qpdf/pdfinfo.
 */

export type JpegInfo = { width: number; height: number; components: number };
export type PdfSink = (chunk: Uint8Array) => void;

export const A4_SHORT_SIDE = 595.28;

export function readJpegInfo(bytes: Uint8Array): JpegInfo {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('El fichero no es un JPEG.');
  let i = 2;
  while (i + 1 < bytes.length) {
    if (bytes[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = bytes[i + 1]!;
    if (marker === 0xff) {
      i++; // byte de relleno
      continue;
    }
    i += 2;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue; // marcadores sin longitud
    if (marker === 0xd9 || marker === 0xda) break; // fin de imagen o datos antes de la cabecera
    const length = (bytes[i]! << 8) | bytes[i + 1]!;
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      return {
        height: (bytes[i + 3]! << 8) | bytes[i + 4]!,
        width: (bytes[i + 5]! << 8) | bytes[i + 6]!,
        components: bytes[i + 7]!,
      };
    }
    i += length;
  }
  throw new Error('JPEG sin cabecera de imagen.');
}

export function pageSizeFor(width: number, height: number): { width: number; height: number } {
  return height >= width
    ? { width: A4_SHORT_SIDE, height: (A4_SHORT_SIDE * height) / width }
    : { width: (A4_SHORT_SIDE * width) / height, height: A4_SHORT_SIDE };
}

function ascii(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c > 0x7f) throw new Error('La sintaxis PDF solo admite ASCII.');
    out[i] = c;
  }
  return out;
}

function num(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

/** Cadena PDF en UTF-16BE con BOM: admite tildes, eñes y cualquier carácter. */
export function utf16Hex(text: string): string {
  let hex = 'FEFF';
  for (let i = 0; i < text.length; i++) hex += text.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase();
  return `<${hex}>`;
}

export function pdfDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `D:${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

/**
 * Objetos reservados: 1 catálogo, 2 árbol de páginas, 3 metadatos.
 * Cada página usa tres objetos más: imagen, contenido y página.
 */
export class PdfWriter {
  private sink: PdfSink;
  private offset = 0;
  private offsets: number[] = [];
  private kids: number[] = [];
  private nextId = 4;
  private finished = false;

  constructor(sink: PdfSink) {
    this.sink = sink;
    this.text('%PDF-1.4\n%');
    this.emit(new Uint8Array([0xe2, 0xe3, 0xcf, 0xd3, 0x0a])); // marca binaria recomendada
  }

  get pageCount(): number {
    return this.kids.length;
  }

  get bytesWritten(): number {
    return this.offset;
  }

  private emit(chunk: Uint8Array): void {
    this.sink(chunk);
    this.offset += chunk.length;
  }

  private text(s: string): void {
    this.emit(ascii(s));
  }

  private begin(id: number): void {
    this.offsets[id] = this.offset;
    this.text(`${id} 0 obj\n`);
  }

  private object(id: number, body: string): void {
    this.begin(id);
    this.text(`${body}\nendobj\n`);
  }

  addJpegPage(jpeg: Uint8Array): void {
    if (this.finished) throw new Error('El PDF ya está cerrado.');
    const info = readJpegInfo(jpeg);
    const size = pageSizeFor(info.width, info.height);
    const imageId = this.nextId++;
    const contentId = this.nextId++;
    const pageId = this.nextId++;
    const colorSpace =
      info.components === 1 ? '/DeviceGray' : info.components === 4 ? '/DeviceCMYK /Decode [1 0 1 0 1 0 1 0]' : '/DeviceRGB';

    this.begin(imageId);
    this.text(
      `<< /Type /XObject /Subtype /Image /Width ${info.width} /Height ${info.height} /ColorSpace ${colorSpace} ` +
        `/BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
    );
    this.emit(jpeg);
    this.text('\nendstream\nendobj\n');

    const content = `q\n${num(size.width)} 0 0 ${num(size.height)} 0 0 cm\n/Im0 Do\nQ\n`;
    this.object(contentId, `<< /Length ${content.length} >>\nstream\n${content}endstream`);
    this.object(
      pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(size.width)} ${num(size.height)}] ` +
        `/Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    this.kids.push(pageId);
  }

  finish(meta: { title?: string; date?: Date } = {}): void {
    if (this.finished) return;
    if (this.kids.length === 0) throw new Error('Un PDF necesita al menos una página.');
    this.object(2, `<< /Type /Pages /Kids [${this.kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${this.kids.length} >>`);
    this.object(1, '<< /Type /Catalog /Pages 2 0 R >>');
    const date = pdfDate(meta.date ?? new Date());
    const title = meta.title ? ` /Title ${utf16Hex(meta.title)}` : '';
    this.object(3, `<<${title} /Producer (ScannerTest) /CreationDate (${date}) /ModDate (${date}) >>`);

    const xref = this.offset;
    let table = `xref\n0 ${this.nextId}\n0000000000 65535 f \n`;
    for (let id = 1; id < this.nextId; id++) table += `${String(this.offsets[id]).padStart(10, '0')} 00000 n \n`;
    this.text(table);
    this.text(`trailer\n<< /Size ${this.nextId} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    this.finished = true;
  }
}
