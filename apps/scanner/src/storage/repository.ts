import type { Document, PageOrigin, Quad, Rotation, ScanFilter, ScanPage } from '@scanner/document-model';
import * as SQLite from 'expo-sqlite';

import { fromStoredPath, toStoredPath } from './paths';

/** Cada entrada es una migración. No editar las ya publicadas: añadir nuevas al final. */
const MIGRATIONS = [
  `
  CREATE TABLE documents (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    pdf_path TEXT,
    pdf_generated_at TEXT,
    pdf_size INTEGER
  );
  CREATE TABLE pages (
    id TEXT PRIMARY KEY NOT NULL,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    source_path TEXT NOT NULL,
    source_width INTEGER NOT NULL,
    source_height INTEGER NOT NULL,
    processed_path TEXT NOT NULL,
    thumb_path TEXT NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    rotation INTEGER NOT NULL,
    filter TEXT NOT NULL,
    crop TEXT,
    origin TEXT NOT NULL,
    sort_order INTEGER NOT NULL
  );
  CREATE INDEX pages_by_document ON pages(document_id, sort_order);
  `,
];

type DocumentRow = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  pdf_path: string | null;
  pdf_generated_at: string | null;
  pdf_size: number | null;
};

type PageRow = {
  id: string;
  document_id: string;
  source_path: string;
  source_width: number;
  source_height: number;
  processed_path: string;
  thumb_path: string;
  width: number;
  height: number;
  rotation: number;
  filter: string;
  crop: string | null;
  origin: string;
  sort_order: number;
};

let database: Promise<SQLite.SQLiteDatabase> | null = null;

function db(): Promise<SQLite.SQLiteDatabase> {
  database ??= open();
  return database;
}

async function open(): Promise<SQLite.SQLiteDatabase> {
  const d = await SQLite.openDatabaseAsync('scanner.db');
  await d.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await d.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  for (let v = row?.user_version ?? 0; v < MIGRATIONS.length; v++) {
    await d.withTransactionAsync(async () => {
      await d.execAsync(MIGRATIONS[v]!);
    });
    await d.execAsync(`PRAGMA user_version = ${v + 1}`);
  }
  return d;
}

function parseCrop(raw: string | null): Quad | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Quad;
  } catch {
    return null;
  }
}

function toPage(row: PageRow): ScanPage {
  return {
    id: row.id,
    sourceUri: fromStoredPath(row.source_path),
    sourceWidth: row.source_width,
    sourceHeight: row.source_height,
    processedUri: fromStoredPath(row.processed_path),
    thumbUri: fromStoredPath(row.thumb_path),
    width: row.width,
    height: row.height,
    rotation: row.rotation as Rotation,
    filter: row.filter as ScanFilter,
    crop: parseCrop(row.crop),
    origin: row.origin as PageOrigin,
    sortOrder: row.sort_order,
  };
}

export async function loadAllDocuments(): Promise<Document[]> {
  const d = await db();
  const docs = await d.getAllAsync<DocumentRow>('SELECT * FROM documents');
  const pages = await d.getAllAsync<PageRow>('SELECT * FROM pages ORDER BY document_id, sort_order');
  const byDoc = new Map<string, ScanPage[]>();
  for (const row of pages) {
    const list = byDoc.get(row.document_id) ?? [];
    list.push(toPage(row));
    byDoc.set(row.document_id, list);
  }
  return docs.map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    pages: byDoc.get(row.id) ?? [],
    pdfUri: row.pdf_path ? fromStoredPath(row.pdf_path) : undefined,
    pdfGeneratedAt: row.pdf_generated_at ?? undefined,
    pdfSize: row.pdf_size ?? undefined,
  }));
}

/** Guarda el documento completo (metadatos + páginas) en una transacción. */
export async function writeDocument(doc: Document): Promise<void> {
  const d = await db();
  await d.withTransactionAsync(async () => {
    await d.runAsync(
      `INSERT INTO documents (id, name, created_at, updated_at, pdf_path, pdf_generated_at, pdf_size)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name, updated_at = excluded.updated_at, pdf_path = excluded.pdf_path,
         pdf_generated_at = excluded.pdf_generated_at, pdf_size = excluded.pdf_size`,
      [doc.id, doc.name, doc.createdAt, doc.updatedAt, doc.pdfUri ? toStoredPath(doc.pdfUri) : null, doc.pdfGeneratedAt ?? null, doc.pdfSize ?? null],
    );
    await d.runAsync('DELETE FROM pages WHERE document_id = ?', [doc.id]);
    for (const p of doc.pages) {
      await d.runAsync(
        `INSERT INTO pages (id, document_id, source_path, source_width, source_height, processed_path, thumb_path,
           width, height, rotation, filter, crop, origin, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          p.id, doc.id, toStoredPath(p.sourceUri), p.sourceWidth, p.sourceHeight, toStoredPath(p.processedUri),
          toStoredPath(p.thumbUri), p.width, p.height, p.rotation, p.filter, p.crop ? JSON.stringify(p.crop) : null,
          p.origin, p.sortOrder,
        ],
      );
    }
  });
}

export async function deleteDocumentRow(id: string): Promise<void> {
  const d = await db();
  await d.runAsync('DELETE FROM documents WHERE id = ?', [id]);
}
