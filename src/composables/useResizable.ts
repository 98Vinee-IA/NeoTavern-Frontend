import { onMounted, onUnmounted, type Ref } from 'vue';
import { useSettingsStore } from '../stores/settings.store';
import type { Settings } from '../types';

interface UseResizableOptions {
  storageKey?: keyof Settings['account'];
  initialWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  side?: 'left' | 'right';
  cssVariable?: string;
}

const RESIZING_CLASS = 'is-resizing';

export function useResizable(
  element: Ref<HTMLElement | null>,
  handle: Ref<HTMLElement | null>,
  options: UseResizableOptions = {},
) {
  const { storageKey, initialWidth = 350, minWidth = 200, maxWidth = 800, side = 'left', cssVariable } = options;
  const settingsStore = useSettingsStore();

  let isResizing = false;
  let startX = 0;
  let startWidth = 0;

  const updateCssVariable = (width: number) => {
    if (cssVariable) {
      document.documentElement.style.setProperty(cssVariable, `${width}px`);
    }
  };

  const onMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    if (!element.value) return;

    isResizing = true;
    startX = e.clientX;
    startWidth = element.value.getBoundingClientRect().width;

    document.body.classList.add(RESIZING_CLASS);
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!isResizing || !element.value) return;

    const delta = e.clientX - startX;
    let newWidth = startWidth;

    if (side === 'left') {
      newWidth += delta;
    } else {
      newWidth -= delta;
    }

    if (newWidth < minWidth) {
      newWidth = minWidth;
    }
    if (maxWidth && newWidth > maxWidth) {
      newWidth = maxWidth;
    }

    element.value.style.width = `${newWidth}px`;
    updateCssVariable(newWidth);
  };

  const onMouseUp = () => {
    if (!isResizing) return;

    isResizing = false;
    document.body.classList.remove(RESIZING_CLASS);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);

    // Save the final width to account storage
    if (element.value && storageKey) {
      // @ts-expect-error never
      settingsStore.settings.account[storageKey] = parseInt(element.value.style.width, 10);
    }
  };

  onMounted(() => {
    // Restore saved width on mount
    const widthValue = storageKey
      ? (settingsStore.settings.account[storageKey] as number) || initialWidth
      : initialWidth;

    if (element.value) {
      element.value.style.width = `${widthValue}px`;
    }
    updateCssVariable(widthValue);

    if (handle.value) {
      handle.value.addEventListener('mousedown', onMouseDown);
    }
  });

  onUnmounted(() => {
    if (handle.value) {
      handle.value.removeEventListener('mousedown', onMouseDown);
    }
    // Clean up global listeners if component is unmounted while resizing
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  });
}
