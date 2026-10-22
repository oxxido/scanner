/**
 * document-model
 *
 * Tipos del dominio de Scanner App y funciones puras para manipularlos.
 * No importa nada de React Native ni de Expo: se prueba en Node y lo podría usar
 * cualquier otra app (o un backend) sin arrastrar dependencias.
 *
 * Todas las funciones devuelven objetos nuevos; nunca mutan la entrada.
 */

export type ScanFilter = 'original' | 'magic' | 'grayscale' | 'bw';

export const SCAN_FILTERS: readonly ScanFilter[] = ['original', 'magic', 'grayscale', 'bw'];

export type Rotation = 0 | 90 | 180 | 270;

/** Punto normalizado (0..1) sobre la imagen fuente. */
export type Point = { x: number; y: number };

/** Recorte en perspectiva: esquinas en sentido horario desde arriba a la izquierda. */
export type Quad = { tl: Point; tr: Point; br: Point; bl: Point };

/** De dónde viene la imagen fuente de una página. */
export type PageOrigin = 'scanner' | 'import';

export type ScanPage = {
  id: string;
  /** Salida del escáner nativo o foto importada. Inmutable: todo se deriva de aquí. */
  sourceUri: string;
  sourceWidth: number;
  sourceHeight: number;
  /** Imagen final (recorte + rotación + filtro). Regenerable a partir de sourceUri. */
  processedUri: string;
  thumbUri: string;
  width: number;
  height: number;
  rotation: Rotation;
  filter: ScanFilter;
  /** null = imagen fuente completa. */
  crop: Quad | null;
  origin: PageOrigin;
  sortOrder: number;
};

export type Document = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  pages: ScanPage[];
  pdfUri?: string;
  pdfGeneratedAt?: string;
  pdfSize?: number;
};

export const FULL_QUAD: Quad = {
  tl: { x: 0, y: 0 },
  tr: { x: 1, y: 0 },
  br: { x: 1, y: 1 },
  bl: { x: 0, y: 1 },
};

// ---------------------------------------------------------------------------
// Documento
// ---------------------------------------------------------------------------

export function createDocument(id: string, now: Date, name?: string): Document {
  const iso = now.toISOString();
  return { id, name: name?.trim() || defaultDocumentName(now), createdAt: iso, updatedAt: iso, pages: [] };
}

/** Reasigna sortOrder según la posición en el array (0..n-1). */
export function renumber(pages: readonly ScanPage[]): ScanPage[] {
  return pages.map((p, i) => (p.sortOrder === i ? p : { ...p, sortOrder: i }));
}

export function sortedPages(pages: readonly ScanPage[]): ScanPage[] {
  return [...pages].sort((a, b) => a.sortOrder - b.sortOrder);
}

function touch(doc: Document, now: Date, pages: ScanPage[]): Document {
  return { ...doc, pages: renumber(pages), updatedAt: now.toISOString() };
}

export function appendPages(doc: Document, pages: readonly ScanPage[], now: Date): Document {
  return touch(doc, now, [...sortedPages(doc.pages), ...pages]);
}

export function removePage(doc: Document, pageId: string, now: Date): Document {
  return touch(doc, now, sortedPages(doc.pages).filter((p) => p.id !== pageId));
}

export function movePage(doc: Document, from: number, to: number, now: Date): Document {
  const pages = sortedPages(doc.pages);
  if (from < 0 || from >= pages.length || to < 0 || to >= pages.length || from === to) return doc;
  const [moved] = pages.splice(from, 1);
  pages.splice(to, 0, moved!);
  return touch(doc, now, pages);
}

/** Aplica un orden completo (p. ej. el resultado de arrastrar en la cuadrícula). Ignora ids desconocidos. */
export function reorderPages(doc: Document, orderedIds: readonly string[], now: Date): Document {
  const byId = new Map(doc.pages.map((p) => [p.id, p]));
  const ordered: ScanPage[] = [];
  for (const id of orderedIds) {
    const page = byId.get(id);
    if (page) {
      ordered.push(page);
      byId.delete(id);
    }
  }
  // Páginas que no venían en la lista se conservan al final, en su orden previo.
  const rest = sortedPages([...byId.values()]);
  const next = [...ordered, ...rest];
  const unchanged = next.every((p, i) => p.sortOrder === i);
  return unchanged ? doc : touch(doc, now, next);
}

export function updatePage(doc: Document, pageId: string, patch: Partial<Omit<ScanPage, 'id'>>, now: Date): Document {
  return touch(
    doc,
    now,
    sortedPages(doc.pages).map((p) => (p.id === pageId ? { ...p, ...patch } : p)),
  );
}

export function renameDocument(doc: Document, name: string, now: Date): Document {
  const clean = name.trim();
  if (!clean || clean === doc.name) return doc;
  return { ...doc, name: clean, updatedAt: now.toISOString() };
}

export function markPdf(doc: Document, pdfUri: string, pdfSize: number, now: Date): Document {
  // No toca updatedAt: generar el PDF no modifica el documento.
  return { ...doc, pdfUri, pdfSize, pdfGeneratedAt: now.toISOString() };
}

/** El PDF hay que regenerarlo si no existe o si el documento cambió después de generarlo. */
export function isPdfStale(doc: Document): boolean {
  if (!doc.pdfUri || !doc.pdfGeneratedAt) return true;
  return doc.updatedAt > doc.pdfGeneratedAt;
}

export function pageIndex(doc: Document, pageId: string): number {
  return sortedPages(doc.pages).findIndex((p) => p.id === pageId);
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

export function rotateBy(rotation: Rotation, delta: 90 | -90 | 180): Rotation {
  return ((((rotation + delta) % 360) + 360) % 360) as Rotation;
}

/** Filtro por defecto: la salida del escáner nativo ya viene realzada; una foto importada no. */
export function defaultFilterFor(origin: PageOrigin): ScanFilter {
  return origin === 'scanner' ? 'original' : 'magic';
}

export function isFullQuad(quad: Quad | null, epsilon = 0.002): boolean {
  if (!quad) return true;
  const near = (a: Point, b: Point) => Math.abs(a.x - b.x) <= epsilon && Math.abs(a.y - b.y) <= epsilon;
  return near(quad.tl, FULL_QUAD.tl) && near(quad.tr, FULL_QUAD.tr) && near(quad.br, FULL_QUAD.br) && near(quad.bl, FULL_QUAD.bl);
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export function clampQuad(quad: Quad): Quad {
  const c = (p: Point): Point => ({ x: clamp01(p.x), y: clamp01(p.y) });
  return { tl: c(quad.tl), tr: c(quad.tr), br: c(quad.br), bl: c(quad.bl) };
}

/** Un cuadrilátero válido es convexo y conserva el sentido horario (no se ha "dado la vuelta"). */
export function isValidQuad(quad: Quad, minArea = 0.01): boolean {
  const pts = [quad.tl, quad.tr, quad.br, quad.bl];
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % 4]!;
    const c = pts[(i + 2) % 4]!;
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-9) return false;
    const s = Math.sign(cross);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  // Área por la fórmula del polígono (shoelace).
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % 4]!;
    area += a.x * b.y - b.x * a.y;
  }
  // En coordenadas de pantalla (y hacia abajo) el sentido horario da área positiva.
  return sign > 0 && area / 2 >= minArea;
}

// ---------------------------------------------------------------------------
// Presentación
// ---------------------------------------------------------------------------

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function shortDate(date: Date): string {
  return `${date.getDate()} ${MONTHS_ES[date.getMonth()]}`;
}

export function defaultDocumentName(date: Date): string {
  return `Escaneo ${shortDate(date)}`;
}

export function pagesLabel(count: number): string {
  return count === 1 ? '1 pág' : `${count} págs`;
}

export function pagesLabelLong(count: number): string {
  return count === 1 ? '1 página' : `${count} páginas`;
}

export function documentMeta(doc: Document): string {
  return `${pagesLabel(doc.pages.length)} · ${shortDate(new Date(doc.updatedAt))}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/** Nombre de archivo seguro para el PDF (sin extensión). */
export function safeFileName(name: string): string {
  const cleaned = name
    .normalize('NFC')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .slice(0, 80)
    .trim();
  return cleaned || 'Documento';
}
