import { isPdfStale, markPdf, safeFileName, sortedPages, type Document } from '@scanner/document-model';
import { newId } from '@scanner/scanner-core';
import { Directory, File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { PdfWriter } from '../pdf/jpegPdf';
import { deleteFiles, ensureDir, exportDir } from '../storage/paths';
import { getDocument, updateDocument } from '../storage/store';

/** Agrupa los trozos del escritor y los añade al fichero en bloques de ~512 KB. */
class FileSink {
  private file: File;
  private parts: Uint8Array[] = [];
  private size = 0;

  constructor(file: File) {
    this.file = file;
  }

  push(chunk: Uint8Array): void {
    this.parts.push(chunk);
    this.size += chunk.length;
    if (this.size >= 512 * 1024) this.flush();
  }

  flush(): void {
    if (this.size === 0) return;
    const buffer = new Uint8Array(this.size);
    let offset = 0;
    for (const part of this.parts) {
      buffer.set(part, offset);
      offset += part.length;
    }
    this.file.write(buffer, { append: true });
    this.parts = [];
    this.size = 0;
  }
}

/** Genera el PDF incrustando las páginas procesadas sin recomprimirlas. */
export async function generatePdf(docId: string, onProgress?: (done: number, total: number) => void): Promise<Document> {
  const doc = getDocument(docId);
  if (!doc) throw new Error('El documento ya no existe.');
  const pages = sortedPages(doc.pages);
  if (pages.length === 0) throw new Error('El documento no tiene páginas.');

  const dir = ensureDir(exportDir(docId));
  const partial = new File(dir, `.${newId()}.partial`);
  partial.create({ overwrite: true });
  try {
    const sink = new FileSink(partial);
    const writer = new PdfWriter((chunk) => sink.push(chunk));
    for (let i = 0; i < pages.length; i++) {
      onProgress?.(i, pages.length);
      writer.addJpegPage(await new File(pages[i]!.processedUri).bytes());
      sink.flush();
    }
    writer.finish({ title: doc.name });
    sink.flush();
    onProgress?.(pages.length, pages.length);

    const target = new File(dir, `${safeFileName(doc.name)}.pdf`);
    if (target.exists) target.delete();
    await partial.move(target);
    const finalFile = new File(target.uri);
    if (doc.pdfUri && doc.pdfUri !== finalFile.uri) deleteFiles([doc.pdfUri]);

    const updated = await updateDocument(docId, (d) => markPdf(d, finalFile.uri, finalFile.size, new Date()));
    if (!updated) throw new Error('El documento ya no existe.');
    return updated;
  } catch (err) {
    deleteFiles([partial.uri]);
    throw err;
  }
}

function pdfExists(doc: Document): boolean {
  try {
    return !!doc.pdfUri && new File(doc.pdfUri).exists;
  } catch {
    return false;
  }
}

/** Devuelve el documento con un PDF al día, regenerándolo solo si hace falta. */
export async function ensurePdf(docId: string, onProgress?: (done: number, total: number) => void): Promise<Document> {
  const doc = getDocument(docId);
  if (!doc) throw new Error('El documento ya no existe.');
  if (!isPdfStale(doc) && pdfExists(doc)) return doc;
  return generatePdf(docId, onProgress);
}

export async function sharePdf(doc: Document): Promise<void> {
  if (!doc.pdfUri) throw new Error('Todavía no hay PDF.');
  if (!(await Sharing.isAvailableAsync())) throw new Error('Este dispositivo no permite compartir archivos.');
  await Sharing.shareAsync(doc.pdfUri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: doc.name });
}

/**
 * Android: el usuario elige una carpeta y se guarda una copia allí.
 * iOS: la hoja de compartir del sistema ya incluye "Guardar en Archivos".
 */
export async function savePdfCopy(doc: Document): Promise<'saved' | 'cancelled' | 'shared'> {
  if (!doc.pdfUri) throw new Error('Todavía no hay PDF.');
  if (Platform.OS !== 'android') {
    await sharePdf(doc);
    return 'shared';
  }
  let folder: Directory;
  try {
    folder = await Directory.pickDirectoryAsync();
  } catch {
    return 'cancelled';
  }
  const copy = folder.createFile(`${safeFileName(doc.name)}.pdf`, 'application/pdf');
  copy.write(await new File(doc.pdfUri).bytes());
  return 'saved';
}
