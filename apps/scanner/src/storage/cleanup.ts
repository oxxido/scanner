import { Directory, File } from 'expo-file-system';

import { allDocuments, forgetDocument, getDocument } from './store';
import { deleteDirectory, docDir, docsDir, exportDir, pagesDir, thumbsDir, toStoredPath } from './paths';

/**
 * Se ejecuta al arrancar, antes de mostrar la app:
 *  - borra documentos sin páginas (p. ej. la app se cerró durante la primera captura),
 *  - borra carpetas de documentos que ya no existen,
 *  - borra ficheros que ningún documento referencia (revisiones antiguas, PDFs a medias).
 */
export async function cleanupStorage(): Promise<void> {
  for (const doc of [...allDocuments()]) {
    if (doc.pages.length === 0) {
      await forgetDocument(doc.id);
      deleteDirectory(docDir(doc.id));
    }
  }

  const root = docsDir();
  if (!root.exists) return;

  for (const entry of root.list()) {
    if (!(entry instanceof Directory)) {
      entry.delete();
      continue;
    }
    const doc = getDocument(entry.name);
    if (!doc) {
      deleteDirectory(entry);
      continue;
    }
    const referenced = new Set(
      [...doc.pages.flatMap((p) => [p.sourceUri, p.processedUri, p.thumbUri]), doc.pdfUri]
        .filter((u): u is string => !!u)
        .map(toStoredPath),
    );
    for (const dir of [pagesDir(doc.id), thumbsDir(doc.id), exportDir(doc.id)]) {
      if (!dir.exists) continue;
      for (const item of dir.list()) {
        if (item instanceof File && !referenced.has(toStoredPath(item.uri))) item.delete();
      }
    }
  }
}
