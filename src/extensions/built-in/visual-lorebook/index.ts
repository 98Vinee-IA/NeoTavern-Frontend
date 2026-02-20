import type { ExtensionAPI } from '../../../types';
import { manifest } from './manifest';
import type { VisualLorebookSettings } from './types';
import VisualLorebookPanel from './VisualLorebookPanel.vue';

export { manifest };

export function activate(api: ExtensionAPI<VisualLorebookSettings>) {
  // Register sidebar panel
  const panelIdPromise = api.ui.registerSidebar(
    'visual-lorebook',
    VisualLorebookPanel,
    'left',
    {
      icon: 'fa-solid fa-photo-video',
      title: 'extensionsBuiltin.visualLorebook.title',
      props: { api },
    },
  );

  // Register nav bar item
  api.ui.registerNavBarItem('visual-lorebook', {
    icon: 'fa-solid fa-photo-video',
    title: 'extensionsBuiltin.visualLorebook.title',
    onClick: () => {
      // Open sidebar panel - panelId is a promise, so we need to await it
      panelIdPromise.then((panelId) => {
        api.ui.openSidebar(panelId);
      });
    },
  });

  // Cleanup function
  return () => {
    // Unregister sidebar - requires side parameter
    api.ui.unregisterSidebar('visual-lorebook', 'left');
    api.ui.unregisterNavBarItem('visual-lorebook');
  };
}
