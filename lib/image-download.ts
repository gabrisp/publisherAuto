export async function processImageForDownload(url: string): Promise<Blob> {
  const res = await fetch(url);
  const sourceBlob = await res.blob();

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(sourceBlob);

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        resolve(sourceBlob);
        return;
      }

      const brightness = (0.992 + Math.random() * 0.016).toFixed(4);
      const saturation = (0.990 + Math.random() * 0.020).toFixed(4);
      ctx.filter = `brightness(${brightness}) saturate(${saturation})`;
      ctx.drawImage(img, 0, 0);
      ctx.filter = "none";

      const rx = Math.floor(Math.random() * canvas.width);
      const ry = Math.floor(Math.random() * canvas.height);
      const px = ctx.getImageData(rx, ry, 1, 1);
      px.data[0] = px.data[0] < 255 ? px.data[0] + 1 : px.data[0] - 1;
      ctx.putImageData(px, rx, ry);

      URL.revokeObjectURL(objectUrl);

      const quality = 0.91 + Math.random() * 0.06;
      canvas.toBlob((b) => resolve(b ?? sourceBlob), "image/jpeg", quality);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(sourceBlob);
    };

    img.src = objectUrl;
  });
}

export function variantFilename(slideIndex: number, variant: number, baseId: string): string {
  return `${baseId}-v${variant}-s${slideIndex + 1}.jpg`;
}

export function newBatchId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}
