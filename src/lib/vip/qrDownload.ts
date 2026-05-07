/**
 * Compose a branded PNG of the VIP registration QR code, client-side.
 * Reads from a QRCodeCanvas already rendered in the DOM (by id).
 */
export interface QrDownloadOpts {
  qrCanvasId: string;
  fileName: string;
  titleLine: string; // e.g. "OTF Tuscaloosa — Private Group Class"
  dateTimeLine: string; // e.g. "Friday, May 9, 2026 at 6:00 PM"
  ctaLine?: string; // default "Scan to register before class"
}

export function downloadBrandedQr({
  qrCanvasId,
  fileName,
  titleLine,
  dateTimeLine,
  ctaLine = 'Scan to register before class',
}: QrDownloadOpts) {
  const qrCanvas = document.getElementById(qrCanvasId) as HTMLCanvasElement | null;
  if (!qrCanvas) return;

  const size = 600;
  const padding = 60;
  const textArea = 140;
  const w = size + padding * 2;
  const h = size + padding * 2 + textArea;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, w, h);

  ctx.drawImage(qrCanvas, padding, padding, size, size);

  ctx.strokeStyle = '#E8540A';
  ctx.lineWidth = 6;
  ctx.strokeRect(padding - 8, padding - 8, size + 16, size + 16);

  const baseY = padding + size + 40;
  ctx.fillStyle = '#1a1a1a';
  ctx.textAlign = 'center';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(titleLine, w / 2, baseY);
  ctx.font = '20px sans-serif';
  ctx.fillText(dateTimeLine, w / 2, baseY + 36);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#666666';
  ctx.fillText(ctaLine, w / 2, baseY + 68);

  const link = document.createElement('a');
  link.download = fileName;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export function slugifyGroup(name: string | null | undefined): string {
  if (!name) return 'group';
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'group'
  );
}
