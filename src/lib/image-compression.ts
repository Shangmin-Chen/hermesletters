/**
 * Helper to read a slice of a file as ArrayBuffer, compatible with older environments.
 */
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

/**
 * Checks if a file has animation frames by searching for specific chunks.
 * Specifically checks for:
 * - GIF (automatically returns true if file type matches)
 * - APNG (searches for 'acTL' chunk)
 * - Animated WebP (searches for 'ANIM' chunk)
 */
async function isAnimated(file: File): Promise<boolean> {
  if (file.type === "image/gif") {
    return true;
  }

  try {
    // Read the first 128KB of the file
    const slice = file.slice(0, 128 * 1024);
    const buffer = await readSliceAsArrayBuffer(slice);
    const arr = new Uint8Array(buffer);

    if (file.type === "image/png") {
      // Look for 'acTL' chunk (Animation Control Chunk)
      // ASCII values for 'a', 'c', 'T', 'L' are 97, 99, 84, 76
      for (let i = 0; i <= arr.length - 4; i++) {
        if (
          arr[i] === 97 &&     // 'a'
          arr[i + 1] === 99 && // 'c'
          arr[i + 2] === 84 && // 'T'
          arr[i + 3] === 76    // 'L'
        ) {
          return true;
        }
      }
    } else if (file.type === "image/webp") {
      // Look for 'ANIM' chunk
      // ASCII values for 'A', 'N', 'I', 'M' are 65, 78, 73, 77
      for (let i = 0; i <= arr.length - 4; i++) {
        if (
          arr[i] === 65 &&     // 'A'
          arr[i + 1] === 78 && // 'N'
          arr[i + 2] === 73 && // 'I'
          arr[i + 3] === 77    // 'M'
        ) {
          return true;
        }
      }
    }
  } catch (err) {
    console.error("Failed to check if image is animated:", err);
  }

  return false;
}

/**
 * Utility to compress and downscale an image file on the client side using HTML5 Canvas.
 * Skips compression for animated files (GIF, APNG, animated WebP) to preserve animations,
 * and files under 500KB to save CPU cycles.
 */
export async function compressImage(
  file: File,
  maxW = 1200,
  maxH = 1200,
  quality = 0.8
): Promise<File> {
  // 1. Skip non-images
  if (!file.type.startsWith("image/")) {
    return file;
  }

  // 2. Skip small files (<= 500KB) - Done early to avoid parsing headers of small files
  if (file.size <= 500 * 1024) {
    return file;
  }

  // 3. Skip animated files (GIF, APNG, animated WebP)
  const animated = await isAnimated(file);
  if (animated) {
    return file;
  }

  return new Promise((resolve) => {
    const tempUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      // Clear handlers and revoke temporary URL immediately to prevent memory leaks
      img.onload = null;
      img.onerror = null;
      URL.revokeObjectURL(tempUrl);

      try {
        let width = img.width;
        let height = img.height;

        // Handle 0-dimension images
        if (width === 0 || height === 0) {
          resolve(file);
          return;
        }

        // Resize proportionally if dimensions exceed thresholds using minimum scale factor
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
          resolve(file); // Fallback to raw file if canvas context is unavailable
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Maintain original MIME type if possible, fallback to image/jpeg
        let outputType = file.type;
        if (
          outputType !== "image/png" &&
          outputType !== "image/jpeg" &&
          outputType !== "image/webp"
        ) {
          outputType = "image/jpeg";
        }

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }

            // Inspect the actual generated blob type to avoid mismatch if the browser falls back (e.g. WebP not supported)
            const finalType = blob.type || outputType;

            // Keep the filename prefix, change extension to match MIME type
            let extension = ".jpg";
            if (finalType === "image/png") extension = ".png";
            else if (finalType === "image/webp") extension = ".webp";

            const baseName = file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
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
