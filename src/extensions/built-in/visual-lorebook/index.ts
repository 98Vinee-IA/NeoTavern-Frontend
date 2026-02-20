import { markRaw } from 'vue';
import type { ExtensionAPI } from '../../../types';
import { manifest } from './manifest';
import type { VisualLorebookSettings } from './types';
import VisualLorebookPanel from './VisualLorebookPanel.vue';

export { manifest };

export function activate(api: ExtensionAPI<VisualLorebookSettings>) {
  // Register sidebar panel on the RIGHT side (openSidebar only works with right sidebars)
  api.ui.registerSidebar('visual-lorebook', markRaw(VisualLorebookPanel), 'right', {
    icon: 'fa-solid fa-photo-video',
    title: 'extensionsBuiltin.visualLorebook.title',
    props: { api },
  });

  // Register nav bar item
  api.ui.registerNavBarItem('visual-lorebook', {
    icon: 'fa-solid fa-photo-video',
    title: 'extensionsBuiltin.visualLorebook.title',
    onClick: () => {
      // Open sidebar panel - use the same ID as registered above
      api.ui.openSidebar('visual-lorebook');
    },
  });

  // Cleanup function
  return () => {
    // Unregister sidebar - requires side parameter
    api.ui.unregisterSidebar('visual-lorebook', 'right');
    api.ui.unregisterNavBarItem('visual-lorebook');
  };
}
