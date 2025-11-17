import type { ExtensionAPI } from '../utils/extension-api';

declare global {
  interface Window {
    SillyTavern: {
      extensionAPI: ExtensionAPI;
      vue: typeof import('vue');
    };
  }
}

export {};
