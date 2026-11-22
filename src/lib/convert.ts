export type OutputFormat = "avif" | "svg";

export type ConvertedImage = {
  blob: Blob;
  url: string;
  width: number;
  height: number;
  bytes: number;
};

const AVIF_EDGES = [2400, 1600, 960] as const;

export function isJpeg(file: File): boolean {
  if (file.type === "image/jpeg" || file.type === "image/jpg") return true;
  return /\.jpe?g$/i.test(file.name);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024;
    return `${kb >= 10 ? kb.toFixed(0) : kb.toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function outputName(filename: string, format: OutputFormat): string {
  const base = filename.replace(/\.jpe?g$/i, "").trim() || "image";
  return `${base}.${format}`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function fitSize(width: number, height: number, maxEdge: number) {
  const edge = Math.max(width, height);
  if (edge <= maxEdge) return { width, height };
  const scale = maxEdge / edge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function drawBitmap(bitmap: ImageBitmap, maxEdge: number) {
  const { width, height } = fitSize(bitmap.width, bitmap.height, maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas tidak tersedia di browser ini.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  return { canvas, ctx, width, height };
}

async function bitmapFromFile(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return createImageBitmap(file);
  }
}

function asBytes(data: ArrayBuffer | Uint8Array): Uint8Array {
  if (data instanceof Uint8Array) {
    return data.byteOffset === 0 && data.byteLength === data.buffer.byteLength
      ? data
      : data.slice();
  }
  return new Uint8Array(data);
}

async function toAvif(bitmap: ImageBitmap): Promise<ConvertedImage> {
  const encode = (await import("@jsquash/avif/encode")).default;
  let lastError: unknown;

  for (const edge of AVIF_EDGES) {
    try {
      const { ctx, width, height } = drawBitmap(bitmap, edge);
      const imageData = ctx.getImageData(0, 0, width, height);
      const raw = await encode(imageData, {
        quality: 60,
        speed: 7,
        subsample: 1,
      });
      const bytes = asBytes(raw);
      if (bytes.byteLength < 16) throw new Error("Encoding error.");
      const copy = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(copy).set(bytes);
      const blob = new Blob([copy], { type: "image/avif" });
      return {
        blob,
        url: URL.createObjectURL(blob),
        width,
        height,
        bytes: blob.size,
      };
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error("Gagal mengonversi ke AVIF.");
}

async function toSvg(bitmap: ImageBitmap): Promise<ConvertedImage> {
  const { canvas, width, height } = drawBitmap(bitmap, 2400);
  const href = canvas.toDataURL("image/jpeg", 0.92);
  const svg =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<image width="${width}" height="${height}" href="${href}" preserveAspectRatio="xMidYMid meet"/>` +
    `</svg>\n`;
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  return {
    blob,
    url: URL.createObjectURL(blob),
    width,
    height,
    bytes: blob.size,
  };
}

export async function convertJpeg(file: File, format: OutputFormat): Promise<ConvertedImage> {
  const bitmap = await bitmapFromFile(file);
  try {
    return format === "avif" ? await toAvif(bitmap) : await toSvg(bitmap);
  } finally {
    bitmap.close?.();
  }
}
