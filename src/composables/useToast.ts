import { createVNode, render, reactive, type App } from 'vue';
import ToastContainer from '../components/Toast/ToastContainer.vue';
import { uuidv4 } from '../utils/common';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  timeout?: number;
}

export interface ToastOptions {
  timeout?: number;
}

const toasts = reactive<Toast[]>([]);
let isInitialized = false;
let mainAppContext: App | null = null;

export function setToastContext(app: App) {
  mainAppContext = app;
}

function init() {
  if (isInitialized) return;
  const container = document.createElement('div');
  document.body.appendChild(container);

  const vnode = createVNode(ToastContainer, { toasts });

  if (mainAppContext) {
    vnode.appContext = mainAppContext._context;
  }

  render(vnode, container);
  isInitialized = true;
}

function show(type: ToastType, message: string, title?: string, options?: ToastOptions) {
  init();
  const id = uuidv4();
  toasts.push({
    id,
    type,
    message,
    title,
    timeout: options?.timeout ?? 4000,
  });
}

function remove(id: string) {
  const index = toasts.findIndex((t) => t.id === id);
  if (index > -1) {
    toasts.splice(index, 1);
  }
}

export const toast = {
  success: (message: string, title?: string, options?: ToastOptions) => show('success', message, title, options),
  error: (message: string, title?: string, options?: ToastOptions) => show('error', message, title, options),
  info: (message: string, title?: string, options?: ToastOptions) => show('info', message, title, options),
  warning: (message: string, title?: string, options?: ToastOptions) => show('warning', message, title, options),
  remove,
};
