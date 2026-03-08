import type { ExtensionManifest } from '../../../types';

export const manifest: ExtensionManifest = {
  name: 'core.multi-model-parallel',
  display_name: 'Multi-Model Parallel Response',
  description:
    'Send chat replies to multiple LLM models simultaneously, with the first response becoming the main response and subsequent responses being added as swipes.',
  version: '1.0.0',
  author: 'NeoTavern',
  icon: 'fa-solid fa-layer-group',
};
