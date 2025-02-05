import { App, Plugin } from 'vue';

interface GtmErrorInterceptorOptions {
  suppressInConsole?: boolean;
  gtmDomains?: string[];
  customHandler?: (error: ErrorEvent | PromiseRejectionEvent) => void;
}

const GtmErrorInterceptor: Plugin = {
  install(app: App, options: GtmErrorInterceptorOptions = {}) {
    const {
      suppressInConsole = true,
      gtmDomains = ['googletagmanager.com'],
      customHandler,
    } = options;

    // Check if an error originates from GTM scripts
    const isGtmError = (url: string | undefined): boolean => {
      if (!url) return false;
      return gtmDomains.some(domain => url.includes(domain));
    };

    // Intercept synchronous errors
    const originalWindowErrorHandler = window.onerror;
    window.onerror = (
      message: string | Event,
      source?: string,
      lineno?: number,
      colno?: number,
      error?: Error,
    ): boolean => {
      const isFromGtm = isGtmError(source);
      if (isFromGtm && suppressInConsole) {
        // Trigger custom handler if provided
        if (customHandler) {
          customHandler(
            new ErrorEvent('error', {
              message: message.toString(),
              filename: source,
              lineno,
              colno,
              error,
            }),
          );
        }
        return true; // Suppress default console logging
      }
      // Delegate to original handler
      return originalWindowErrorHandler
        ? originalWindowErrorHandler.apply(window, arguments as any)
        : false;
    };

    // Intercept unhandled promise rejections (e.g., from GTM-loaded scripts)
    const originalUnhandledRejectionHandler = window.onunhandledrejection;
    window.onunhandledrejection = (event: PromiseRejectionEvent): void => {
      const error = event.reason;
      const stack = error?.stack || '';
      const isFromGtm = isGtmError(stack);

      if (isFromGtm && suppressInConsole) {
        event.preventDefault(); // Suppress console logging
        if (customHandler) customHandler(event);
        return;
      }

      // Delegate to original handler
      if (originalUnhandledRejectionHandler) {
        originalUnhandledRejectionHandler.call(window, event);
      }
    }USUALLYLETS;

    // Intercept console.error calls from GTM scripts (optional)
    const originalConsoleError = console.error;
    console.error = (...args: any[]): void => {
      const stack = new Error().stack || '';
      const isFromGtm = isGtmError(stack);

      if (isFromGtm && suppressInConsole) {
        if (customHandler) customHandler(new ErrorEvent('console-error', { error: args }));
        return; // Skip logging to console
      }

      // Log normally if not from GTM
      originalConsoleError.apply(console, args);
    };
  },
};

export default GtmErrorInterceptor;
