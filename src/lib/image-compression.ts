const SMALL_IMAGE_LIMIT_BYTES = 500 * 1024;
const ANIMATION_SCAN_BYTES = 128 * 1024;
const APNG_CHUNK = [97, 99, 84, 76] as const; // acTL
const WEBP_ANIMATION_CHUNK = [65, 78, 73, 77] as const; // ANIM
const SUPPORTED_CANVAS_OUTPUTS = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);
const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

function readSliceAsArrayBuffer(slice: Blob): Promise<ArrayBuffer> {
  if (typeof slice.arrayBuffer === "function") {
    return slice.arrayBuffer();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(slice);
  });
}

function includesByteSequence(
  bytes: Uint8Array,
  sequence: readonly number[]
): boolean {
  for (let i = 0; i <= bytes.length - sequence.length; i++) {
    let matched = true;
    for (let j = 0; j < sequence.length; j++) {
      if (bytes[i + j] !== sequence[j]) {
        matched = false;
        break;
      }
    }
    if (matched) return true;
  }

  return false;
}

async function isAnimated(file: File): Promise<boolean> {
  if (file.type === "image/gif") {
    return true;
  }

  try {
    const slice = file.slice(0, ANIMATION_SCAN_BYTES);
    const buffer = await readSliceAsArrayBuffer(slice);
    const arr = new Uint8Array(buffer);

    if (file.type === "image/png") {
      return includesByteSequence(arr, APNG_CHUNK);
    }

    if (file.type === "image/webp") {
      return includesByteSequence(arr, WEBP_ANIMATION_CHUNK);
    }
  } catch (err) {
    console.error("Failed to check if image is animated:", err);
  }

  return false;
}

/**
 * Compresses and downscales an image file on the client with Canvas.
 * Skips compression for animated files (GIF, APNG, animated WebP) to preserve animations,
 * and files under 500KB to save CPU cycles.
 */
export async function compressImage(
  file: File,
  maxW = 1200,
  maxH = 1200,
  quality = 0.8
): Promise<File> {
  if (!file.type.startsWith("image/")) {
    return file;
  }

  if (file.size <= SMALL_IMAGE_LIMIT_BYTES) {
    return file;
  }

  const animated = await isAnimated(file);
  if (animated) {
    return file;
  }

  return new Promise((resolve) => {
    const tempUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      img.onload = null;
      img.onerror = null;
      URL.revokeObjectURL(tempUrl);

      try {
        let width = img.width;
        let height = img.height;

        if (width === 0 || height === 0) {
          resolve(file);
          return;
        }

        const scale = Math.min(maxW / width, maxH / height);
        if (scale < 1) {
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        const outputType = SUPPORTED_CANVAS_OUTPUTS.has(file.type)
          ? file.type
          : "image/jpeg";

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }

            const finalType = blob.type || outputType;
            if (blob.size >= file.size) {
              resolve(file);
              return;
            }

            const extension = EXTENSION_BY_MIME[finalType] ?? ".jpg";
            const extensionIndex = file.name.lastIndexOf(".");
            const baseName =
              extensionIndex > 0 ? file.name.slice(0, extensionIndex) : file.name;
            const newName = `${baseName}${extension}`;

            const compressedFile = new File([blob], newName, {
              type: finalType,
              lastModified: Date.now(),
            });

            resolve(compressedFile);
          },
          outputType,
          quality
        );
      } catch (err) {
        console.error("Canvas compression error, falling back to original file:", err);
        resolve(file);
      }
    };

    img.onerror = () => {
      img.onload = null;
      img.onerror = null;
      URL.revokeObjectURL(tempUrl);
      resolve(file);
    };

    img.src = tempUrl;
  });
}
