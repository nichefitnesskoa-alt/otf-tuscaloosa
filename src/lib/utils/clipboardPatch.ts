/**
 * Global clipboard fallback.
 *
 * The Lovable preview iframe (and some published contexts) blocks
 * `navigator.clipboard.writeText` via a Permissions Policy, throwing
 * `NotAllowedError: The Clipboard API has been blocked...`. Every "Copy phone",
 * "Copy script", "Copy link" button across the app calls the same API, so we
 * wrap it once at boot with a legacy `document.execCommand('copy')` fallback
 * using a hidden textarea. This keeps every existing call site working without
 * touching them individually.
 */
export function installClipboardFallback() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const legacyCopy = (text: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '0';
        ta.style.left = '0';
        ta.style.opacity = '0';
        ta.style.pointerEvents = 'none';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ta.setSelectionRange(0, text.length);
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (ok) resolve();
        else reject(new Error('execCommand copy returned false'));
      } catch (err) {
        reject(err);
      }
    });
  };

  const nav: any = navigator;
  const originalClipboard = nav.clipboard;
  const originalWrite = originalClipboard?.writeText?.bind(originalClipboard);

  const safeWriteText = async (text: string): Promise<void> => {
    if (originalWrite) {
      try {
        await originalWrite(text);
        return;
      } catch {
        // fall through to legacy path
      }
    }
    return legacyCopy(text);
  };

  if (originalClipboard) {
    try {
      // Overwrite writeText on the existing Clipboard instance.
      Object.defineProperty(originalClipboard, 'writeText', {
        configurable: true,
        writable: true,
        value: safeWriteText,
      });
    } catch {
      // Some browsers freeze the clipboard object — replace the whole thing.
      try {
        Object.defineProperty(nav, 'clipboard', {
          configurable: true,
          value: { ...originalClipboard, writeText: safeWriteText },
        });
      } catch {
        /* give up silently — buttons will still throw as before */
      }
    }
  } else {
    // No Clipboard API at all — expose a minimal shim.
    try {
      Object.defineProperty(nav, 'clipboard', {
        configurable: true,
        value: { writeText: safeWriteText },
      });
    } catch {
      /* ignore */
    }
  }
}
