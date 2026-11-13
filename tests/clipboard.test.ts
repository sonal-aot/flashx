import { describe, it, expect } from 'vitest';
import { copyToClipboard } from '../src/utils/clipboard';

describe('copyToClipboard', () => {
  it('successfully copies text to navigator.clipboard', async () => {
    const res = await copyToClipboard('feature/PROJ-123-new-login');
    expect(res.success).toBe(true);
    expect(await navigator.clipboard.readText()).toBe('feature/PROJ-123-new-login');
  });

  it('returns failure when text is empty', async () => {
    const res = await copyToClipboard('');
    expect(res.success).toBe(false);
    expect(res.error).toBe('Nothing to copy.');
  });
});
