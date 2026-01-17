import type { ExtensionAPI } from '../../../types';
import { manifest } from './manifest';
import NotebookPanel from './NotebookPanel.vue';
import type { NotebookSettings } from './types';

export { manifest };

// TODO: i18n

export function activate(api: ExtensionAPI<NotebookSettings>) {
  async function showPopup() {
    await api.ui.showPopup({
      title: 'Notebook',
      component: NotebookPanel,
      componentProps: {
        api: api,
      },
      wide: true,
      large: true,
      okButton: 'common.close',
    });
  }

  api.ui.registerNavBarItem('core.notebook', {
    title: 'Notebook',
    icon: 'fa-solid fa-book',
    onClick: () => {
      showPopup();
    },
  });

  // No cleanup needed for registerSidebar, so we return an empty function.
  return () => {};
}
