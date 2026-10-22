import {
  FilterMode,
  ImageFormat,
  MipmapMode,
  Skia,
  TileMode,
  type SkImage,
  type SkRuntimeEffect,
  type SkShader,
  type SkSurface,
} from '@shopify/react-native-skia';
import { File } from 'expo-file-system';

import { fitWithin, planRender } from '../geometry';
import type { PageFilter, ProcessInput, ProcessResult, ProcessTarget } from '../types';
import { BW_SKSL, GRAYSCALE_SKSL, MAGIC_SKSL, WARP_SKSL } from './shaders';

export const DEFAULT_MAX_DIMENSION = 2340; // ≈ A4 a 200 ppp
export const DEFAULT_QUALITY = 0.8;
export const DEFAULT_THUMBNAIL_SIZE = 360;
const BACKGROUND_SIZE = 200;

// --- Recursos compilados una sola vez ------------------------------------------------

const effects = new Map<string, SkRuntimeEffect>();

function effect(source: string): SkRuntimeEffect {
  let e = effects.get(source);
  if (!e) {
    const made = Skia.RuntimeEffect.Make(source);
    if (!made) throw new Error('No se pudo compilar un shader de procesado.');
    e = made;
    effects.set(source, e);
  }
  return e;
}

// --- Utilidades -----------------------------------------------------------------------

export async function loadImage(uri: string): Promise<SkImage> {
  const bytes = await new File(uri).bytes();
  const image = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(bytes));
  if (!image) throw new Error('No se pudo leer la imagen.');
  return image;
}

/** GPU si se puede (rápido), CPU si no (los shaders funcionan, pero más lentos). */
function makeSurface(width: number, height: number): SkSurface {
  const surface = Skia.Surface.MakeOffscreen(width, height) ?? Skia.Surface.Make(width, height);
  if (!surface) throw new Error(`No hay memoria para una imagen de ${width}×${height}.`);
  return surface;
}

function snapshot(surface: SkSurface): SkImage {
  surface.flush();
  return surface.makeImageSnapshot();
}

function shaderOf(image: SkImage): SkShader {
  return image.makeShaderOptions(TileMode.Clamp, TileMode.Clamp, FilterMode.Linear, MipmapMode.None);
}

function fillWithShader(surface: SkSurface, shader: SkShader): void {
  const paint = Skia.Paint();
  paint.setShader(shader);
  surface.getCanvas().drawRect(Skia.XYWHRect(0, 0, surface.width(), surface.height()), paint);
}

function writeJpeg(image: SkImage, uri: string, quality: number): number {
  const bytes = image.encodeToBytes(ImageFormat.JPEG, Math.round(quality * 100));
  if (!bytes || bytes.length === 0) throw new Error('No se pudo codificar el JPEG.');
  const file = new File(uri);
  if (!file.exists) file.create({ intermediates: true });
  file.write(bytes);
  return bytes.length;
}

// --- Pasadas --------------------------------------------------------------------------

function renderGeometry(source: SkImage, input: ProcessInput, maxDimension: number): SkImage {
  const plan = planRender(source.width(), source.height(), input.crop, input.rotation, maxDimension);
  const m = plan.matrix;
  const surface = makeSurface(plan.width, plan.height);
  const shader = effect(WARP_SKSL).makeShaderWithChildren([...m], [shaderOf(source)]);
  fillWithShader(surface, shader);
  return snapshot(surface);
}

/** Estimación del papel: imagen pequeña, dilatada (borra el texto oscuro) y desenfocada. */
function renderBackground(image: SkImage): SkImage {
  const small = fitWithin(image.width(), image.height(), BACKGROUND_SIZE);
  const surface = makeSurface(small.width, small.height);
  const paint = Skia.Paint();
  paint.setImageFilter(Skia.ImageFilter.MakeBlur(5, 5, TileMode.Clamp, Skia.ImageFilter.MakeDilate(4, 4, null)));
  surface
    .getCanvas()
    .drawImageRectOptions(
      image,
      Skia.XYWHRect(0, 0, image.width(), image.height()),
      Skia.XYWHRect(0, 0, small.width, small.height),
      FilterMode.Linear,
      MipmapMode.None,
      paint,
    );
  return snapshot(surface);
}

function renderFilter(image: SkImage, filter: PageFilter): SkImage {
  if (filter === 'original') return image;
  const surface = makeSurface(image.width(), image.height());

  if (filter === 'grayscale') {
    fillWithShader(surface, effect(GRAYSCALE_SKSL).makeShaderWithChildren([], [shaderOf(image)]));
  } else {
    const background = renderBackground(image);
    const scale = [background.width() / image.width(), background.height() / image.height()];
    const source = filter === 'magic' ? MAGIC_SKSL : BW_SKSL;
    fillWithShader(surface, effect(source).makeShaderWithChildren(scale, [shaderOf(image), shaderOf(background)]));
    background.dispose();
  }
  return snapshot(surface);
}

function renderThumbnail(image: SkImage, size: number): SkImage {
  const small = fitWithin(image.width(), image.height(), size);
  const surface = makeSurface(small.width, small.height);
  surface
    .getCanvas()
    .drawImageRectOptions(
      image,
      Skia.XYWHRect(0, 0, image.width(), image.height()),
      Skia.XYWHRect(0, 0, small.width, small.height),
      FilterMode.Linear,
      MipmapMode.None,
      null,
    );
  return snapshot(surface);
}

// --- API ------------------------------------------------------------------------------

/**
 * Genera la imagen final de una página a partir de su fuente:
 * recorte en perspectiva → giro → reducción → filtro → JPEG (+ miniatura).
 * No modifica la fuente; se puede repetir con otros parámetros tantas veces como se quiera.
 */
export async function processPage(input: ProcessInput, target: ProcessTarget): Promise<ProcessResult> {
  const source = await loadImage(input.sourceUri);
  const sourceWidth = source.width();
  const sourceHeight = source.height();

  const shaped = renderGeometry(source, input, target.maxDimension ?? DEFAULT_MAX_DIMENSION);
  source.dispose();

  const final = renderFilter(shaped, input.filter);
  if (final !== shaped) shaped.dispose();

  const fileSize = writeJpeg(final, target.outputUri, target.quality ?? DEFAULT_QUALITY);

  if (target.thumbnailUri) {
    const thumb = renderThumbnail(final, target.thumbnailSize ?? DEFAULT_THUMBNAIL_SIZE);
    writeJpeg(thumb, target.thumbnailUri, 0.7);
    thumb.dispose();
  }

  const result = { width: final.width(), height: final.height(), fileSize, sourceWidth, sourceHeight };
  final.dispose();
  return result;
}
