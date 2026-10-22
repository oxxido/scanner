import { Directory, File, Paths } from 'expo-file-system';

/**
 * Estructura en disco:
 *
 *   <Documents>/scanner/docs/<docId>/pages/<pageId>.source.jpg   fuente inmutable
 *   <Documents>/scanner/docs/<docId>/pages/<pageId>-<rev>.jpg     página procesada
 *   <Documents>/scanner/docs/<docId>/thumbs/<pageId>-<rev>.jpg    miniatura
 *   <Documents>/scanner/docs/<docId>/export/<nombre>.pdf          PDF
 *
 * En iOS la ruta absoluta del contenedor cambia al actualizar la app, así que en la base
 * de datos se guardan rutas RELATIVAS a <Documents>/scanner y se resuelven al cargar.
 */
export function rootDir(): Directory {
  return new Directory(Paths.document, 'scanner');
}
export function docsDir(): Directory {
  return new Directory(rootDir(), 'docs');
}
export function docDir(docId: string): Directory {
  return new Directory(docsDir(), docId);
}
export function pagesDir(docId: string): Directory {
  return new Directory(docDir(docId), 'pages');
}
export function thumbsDir(docId: string): Directory {
  return new Directory(docDir(docId), 'thumbs');
}
export function exportDir(docId: string): Directory {
  return new Directory(docDir(docId), 'export');
}

export function ensureDir(dir: Directory): Directory {
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

function rootPrefix(): string {
  return rootDir().uri.replace(/\/?$/, '/');
}

export function toStoredPath(uri: string): string {
  const prefix = rootPrefix();
  return uri.startsWith(prefix) ? uri.slice(prefix.length) : uri;
}

export function fromStoredPath(path: string): string {
  if (/^[a-z]+:\/\//i.test(path)) return path;
  return new File(rootDir(), path).uri;
}

export function deleteFiles(uris: readonly (string | undefined)[]): void {
  for (const uri of new Set(uris)) {
    if (!uri) continue;
    try {
      const file = new File(uri);
      if (file.exists) file.delete();
    } catch (err) {
      console.warn('[storage] no se pudo borrar', uri, err);
    }
  }
}

export function deleteDirectory(dir: Directory): void {
  try {
    if (dir.exists) dir.delete();
  } catch (err) {
    console.warn('[storage] no se pudo borrar la carpeta', dir.uri, err);
  }
}
