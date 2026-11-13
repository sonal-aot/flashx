/**
 * Safe clipboard copy with fallback for browser extensions
 */
export async function copyToClipboard(text: string): Promise<{ success: boolean; error?: string }> {
  if (!text) {
    return { success: false, error: 'Nothing to copy.' };
  }

  // Attempt standard navigator.clipboard
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return { success: true };
    }
  } catch (err) {
    console.warn('[FlashX Clipboard] navigator.clipboard.writeText failed, trying DOM fallback:', err);
  }

  // Fallback: create temporary textarea
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);

    if (successful) {
      return { success: true };
    }
    return { success: false, error: 'Clipboard copy failed.' };
  } catch (fallbackErr) {
    const errorMsg = fallbackErr instanceof Error ? fallbackErr.message : 'Unknown clipboard error';
    return { success: false, error: errorMsg };
  }
}
