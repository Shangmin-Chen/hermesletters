/**
 * Utility to compress and downscale an image file on the client side using HTML5 Canvas.
 * Skips compression for GIFs to preserve animations, and files under 500KB to save CPU cycles.
 */
export async function compressImage(
  file: File,
  maxW = 1200,
  maxH = 1200,
  quality = 0.8
): Promise<File> {
  // 1. Skip non-images or GIFs
  if (!file.type.startsWith("image/") || file.type === "image/gif") {
    return file;
  }

  // 2. Skip small files (<= 500KB)
  if (file.size <= 500 * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Resize proportionally if dimensions exceed thresholds
        if (width > maxW || height > maxH) {
          if (width > height) {
            height = Math.round((height * maxW) / width);
            width = maxW;
          } else {
            width = Math.round((width * maxH) / height);
            height = maxH;
          }
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

            // Keep the filename prefix, change extension to match MIME type
            let extension = ".jpg";
            if (outputType === "image/png") extension = ".png";
            else if (outputType === "image/webp") extension = ".webp";

            const baseName = file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
            const newName = `${baseName}${extension}`;

            const compressedFile = new File([blob], newName, {
              type: outputType,
              lastModified: Date.now(),
            });

            resolve(compressedFile);
          },
          outputType,
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}
