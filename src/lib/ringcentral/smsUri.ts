/**
 * RingCentral SMS deep-link helpers.
 *
 * Launcher-only: builds a rcapp:// URI from an admin-configured template and
 * fires it in a way that cannot open a blank tab or throw if the OS has no
 * handler registered. The script text is always on the clipboard already —
 * the URI is pure convenience.
 */
import { stripCountryCode } from '@/lib/parsing/phone';

export const DEFAULT_RC_SMS_URI_TEMPLATE = 'rcapp://r/sms?type=new&number={e164}';
export const RC_SMS_URI_SETTING_KEY = 'ringcentral_sms_uri_template';

/** Produce +1XXXXXXXXXX from any phone input, or null if unusable. */
export function toE164Us(raw: string | null | undefined): string | null {
  const ten = stripCountryCode(raw);
  return ten ? `+1${ten}` : null;
}

/**
 * Build the deep-link URI from the template. Returns null if the template is
 * missing/blank or the phone can't be normalized to E.164.
 * Only {e164} and {body} are interpolated. {body} is URL-encoded.
 */
export function buildRcSmsUri(
  template: string | null | undefined,
  phone: string | null | undefined,
  body: string,
): string | null {
  const tpl = (template || '').trim();
  if (!tpl) return null;
  const e164 = toE164Us(phone);
  if (!e164) return null;
  return tpl
    .replace(/\{e164\}/g, e164)
    .replace(/\{body\}/g, encodeURIComponent(body || ''));
}

/**
 * Fire a custom-scheme URI without opening a blank tab. Uses a hidden iframe
 * so the browser silently ignores an unregistered handler instead of surfacing
 * a broken window.open target. Always safe to call — swallows errors.
 */
export function fireRcSmsUri(uri: string): void {
  if (!uri) return;
  try {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = uri;
    document.body.appendChild(iframe);
    setTimeout(() => {
      try { document.body.removeChild(iframe); } catch { /* noop */ }
    }, 2000);
  } catch {
    // Never throw from a launcher; the script is already on the clipboard.
  }
}
