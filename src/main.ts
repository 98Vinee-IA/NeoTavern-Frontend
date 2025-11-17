import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { useAuthStore } from './stores/auth.store';
import { toast } from './composables/useToast';
import i18n from './i18n';
import * as Vue from 'vue';
import type { StrictT } from './composables/useStrictI18n';
import { extensionAPI } from './utils/extension-api';

import './styles/main.scss';
import '@fortawesome/fontawesome-free/css/all.min.css';

// Expose Vue for extensions that might need to mount their own components
window.SillyTavern = {
  extensionAPI,
  vue: Vue,
};

async function initializeApp() {
  const app = createApp(App);
  const pinia = createPinia();
  app.use(pinia);
  app.use(i18n);
  // @ts-ignore
  const t = i18n.global.t as StrictT;

  // Fetch CSRF token before mounting
  try {
    const authStore = useAuthStore();
    await authStore.fetchToken();
  } catch (error) {
    toast.error(t('errors.csrfToken'), 'Error', {
      timeout: 0,
    });
    console.error('Initialization failed:', error);
    // Prevent the app from mounting on critical error
    return;
  }

  app.mount('#app');
}

initializeApp();
