import {
  appendPages,
  createDocument,
  defaultFilterFor,
  removePage,
  renameDocument as rename,
  reorderPages,
  updatePage,
  type Document,
  type ScanPage,
} from '@scanner/document-model';
import { newId, processPage, releaseCapturedPages, type CapturedPage } from '@scanner/scanner-core';
import { File } from 'expo-file-system';

import { deleteDirectory, deleteFiles, docDir, ensureDir, pagesDir, thumbsDir } from '../storage/paths';
import { forgetDocument, getDocument, saveDocument, updateDocument } from '../storage/store';

type Rendered = Pick<ScanPage, 'processedUri' | 'thumbUri' | 'width' | 'height' | 'sourceWidth' | 'sourceHeight'>;

/** Los reprocesados se hacen de uno en uno: evita picos de memoria y carreras sobre la misma página. */
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

/** Genera imagen procesada + miniatura con un nombre nuevo (evita la caché de imágenes de RN). */
async function render(docId: string, page: ScanPage): Promise<Rendered> {
  const rev = newId().slice(0, 8);
  const output = new File(ensureDir(pagesDir(docId)), `${page.id}-${rev}.jpg`);
  const thumb = new File(ensureDir(thumbsDir(docId)), `${page.id}-${rev}.jpg`);
  const r = await processPage(
    { sourceUri: page.sourceUri, crop: page.crop, rotation: page.rotation, filter: page.filter },
    { outputUri: output.uri, thumbnailUri: thumb.uri },
  );
  return { processedUri: output.uri, thumbUri: thumb.uri, width: r.width, height: r.height, sourceWidth: r.sourceWidth, sourceHeight: r.sourceHeight };
}

/** Copia la captura temporal al documento y la procesa. Si el procesado falla, usa la foto tal cual. */
async function materialize(docId: string, captured: CapturedPage): Promise<{ page: ScanPage; ok: boolean }> {
  const id = newId();
  const source = new File(ensureDir(pagesDir(docId)), `${id}.source.jpg`);
  await new File(captured.uri).copy(source);

  const base: ScanPage = {
    id,
    sourceUri: source.uri,
    sourceWidth: captured.width,
    sourceHeight: captured.height,
    processedUri: source.uri,
    thumbUri: source.uri,
    width: captured.width,
    height: captured.height,
    rotation: 0,
    filter: defaultFilterFor(captured.source),
    crop: null,
    origin: captured.source,
    sortOrder: 0,
  };
  try {
    return { page: { ...base, ...(await render(docId, base)) }, ok: true };
  } catch (err) {
    console.warn('[pages] procesado fallido, se usa la original', err);
    return { page: { ...base, filter: 'original' }, ok: false };
  }
}

export type AddResult = { doc: Document; failedPageIds: string[] };

/**
 * Añade páginas capturadas a un documento (o crea uno nuevo). El documento se guarda tras
 * cada página: si la app se cierra a mitad, lo ya procesado no se pierde.
 */
export async function addCapturedPages(
  docId: string | undefined,
  captured: readonly CapturedPage[],
  onProgress?: (done: number, total: number) => void,
): Promise<AddResult> {
  let id = docId;
  if (!id) {
    const doc = createDocument(newId(), new Date());
    await saveDocument(doc);
    id = doc.id;
  }
  const failed: string[] = [];
  try {
    for (let i = 0; i < captured.length; i++) {
      onProgress?.(i, captured.length);
      const { page, ok } = await enqueue(() => materialize(id, captured[i]!));
      if (!ok) failed.push(page.id);
      await updateDocument(id, (d) => appendPages(d, [page], new Date()));
    }
  } finally {
    releaseCapturedPages(captured);
  }
  onProgress?.(captured.length, captured.length);
  return { doc: getDocument(id)!, failedPageIds: failed };
}

export type PageSettings = Partial<Pick<ScanPage, 'filter' | 'rotation' | 'crop'>>;

/** Cambia filtro, giro o recorte: regenera la imagen desde la fuente (no destructivo). */
export function updatePageSettings(docId: string, pageId: string, settings: PageSettings): Promise<void> {
  return enqueue(async () => {
    const page = getDocument(docId)?.pages.find((p) => p.id === pageId);
    if (!page) return;
    const next = { ...page, ...settings };
    const rendered = await render(docId, next);
    const saved = await updateDocument(docId, (d) => updatePage(d, pageId, { ...settings, ...rendered }, new Date()));
    if (!saved?.pages.some((p) => p.id === pageId)) {
      // La página se borró mientras se procesaba.
      deleteFiles([rendered.processedUri, rendered.thumbUri]);
      return;
    }
    deleteFiles([page.processedUri, page.thumbUri].filter((u) => u !== page.sourceUri));
  });
}

export async function retryPages(docId: string, pageIds: readonly string[]): Promise<string[]> {
  const stillFailing: string[] = [];
  for (const pageId of pageIds) {
    const page = getDocument(docId)?.pages.find((p) => p.id === pageId);
    if (!page) continue;
    try {
      await updatePageSettings(docId, pageId, { filter: defaultFilterFor(page.origin) });
    } catch {
      stillFailing.push(pageId);
    }
  }
  return stillFailing;
}

export async function deletePage(docId: string, pageId: string): Promise<void> {
  const page = getDocument(docId)?.pages.find((p) => p.id === pageId);
  if (!page) return;
  await updateDocument(docId, (d) => removePage(d, pageId, new Date()));
  deleteFiles([page.sourceUri, page.processedUri, page.thumbUri]);
}

export async function deleteDocument(docId: string): Promise<void> {
  await forgetDocument(docId);
  deleteDirectory(docDir(docId));
}

export async function renameDocument(docId: string, name: string): Promise<void> {
  await updateDocument(docId, (d) => rename(d, name, new Date()));
}

export async function reorderDocument(docId: string, orderedIds: readonly string[]): Promise<void> {
  await updateDocument(docId, (d) => reorderPages(d, orderedIds, new Date()));
}
