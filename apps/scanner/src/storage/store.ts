import type { Document } from '@scanner/document-model';
import { useSyncExternalStore } from 'react';

import { deleteDocumentRow, loadAllDocuments, writeDocument } from './repository';

/**
 * Caché en memoria de todos los documentos (son pocos y pequeños) sincronizada con SQLite.
 * La UI lee de aquí de forma síncrona; las escrituras van a disco en serie.
 */
let docs = new Map<string, Document>();
let sorted: Document[] = [];
const listeners = new Set<() => void>();
let writes: Promise<unknown> = Promise.resolve();

function emit(): void {
  sorted = [...docs.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function serial<T>(task: () => Promise<T>): Promise<T> {
  const run = writes.then(task, task);
  writes = run.catch((err) => console.warn('[store] error al guardar', err));
  return run;
}

export async function loadDocuments(): Promise<void> {
  docs = new Map((await loadAllDocuments()).map((d) => [d.id, d]));
  emit();
}

export function getDocument(id: string): Document | undefined {
  return docs.get(id);
}

export function allDocuments(): readonly Document[] {
  return sorted;
}

export function saveDocument(doc: Document): Promise<void> {
  docs.set(doc.id, doc);
  emit();
  return serial(() => writeDocument(doc));
}

/**
 * Aplica un cambio sobre la versión MÁS RECIENTE del documento. Úsalo siempre en lugar de
 * leer-modificar-guardar: así dos operaciones asíncronas no se pisan entre sí.
 */
export async function updateDocument(id: string, change: (doc: Document) => Document): Promise<Document | undefined> {
  const current = docs.get(id);
  if (!current) return undefined;
  const next = change(current);
  if (next !== current) await saveDocument(next);
  return next;
}

export function forgetDocument(id: string): Promise<void> {
  docs.delete(id);
  emit();
  return serial(() => deleteDocumentRow(id));
}

export function useDocuments(): readonly Document[] {
  return useSyncExternalStore(subscribe, () => sorted);
}

export function useDocument(id: string | undefined): Document | undefined {
  return useSyncExternalStore(subscribe, () => (id ? docs.get(id) : undefined));
}
