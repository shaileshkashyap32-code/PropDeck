// ─── Client-side image downscale ────────────────────────────────────────────
// Avatars are stored as a data-URL string on the salesperson row, so the file
// has to be small. This center-crops to a square and scales to `size` px, then
// re-encodes as JPEG — a phone photo (~3MB) comes out a few KB.

export function downscaleImage(file: File, size = 256, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas unsupported')); return; }
      // Center-crop the shorter side so the square isn't stretched.
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image')); };
    img.src = url;
  });
}
