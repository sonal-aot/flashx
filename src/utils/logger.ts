/**
 * Safe logger that redacts API keys and sensitive tokens before printing to console.
 */
export class SafeLogger {
  private static redact(str: string): string {
    if (!str || typeof str !== 'string') return str;
    return str
      // Google AI Studio key AIzaSy...
      .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_GEMINI_KEY]')
      // OpenAI key sk-...
      .replace(/sk-[a-zA-Z0-9_-]{20,}/g, '[REDACTED_OPENAI_KEY]')
      // Anthropic key sk-ant-...
      .replace(/sk-ant-[a-zA-Z0-9_-]{20,}/g, '[REDACTED_CLAUDE_KEY]')
      // Bearer headers
      .replace(/Bearer\s+[a-zA-Z0-9_\-\.]{10,}/gi, 'Bearer [REDACTED_TOKEN]');
  }

  private static sanitizeArgs(args: unknown[]): unknown[] {
    return args.map((arg) => {
      if (typeof arg === 'string') {
        return this.redact(arg);
      }
      if (arg instanceof Error) {
        arg.message = this.redact(arg.message);
        if (arg.stack) arg.stack = this.redact(arg.stack);
        return arg;
      }
      if (typeof arg === 'object' && arg !== null) {
        try {
          const json = JSON.stringify(arg);
          return JSON.parse(this.redact(json));
        } catch {
          return '[Complex Object]';
        }
      }
      return arg;
    });
  }

  static info(...args: unknown[]): void {
    console.info('[FlashX]', ...this.sanitizeArgs(args));
  }

  static warn(...args: unknown[]): void {
    console.warn('[FlashX]', ...this.sanitizeArgs(args));
  }

  static error(...args: unknown[]): void {
    console.error('[FlashX]', ...this.sanitizeArgs(args));
  }
}
