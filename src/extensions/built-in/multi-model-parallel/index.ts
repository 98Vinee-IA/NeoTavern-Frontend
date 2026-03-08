import { h } from 'vue';
import { EventPriority, GenerationMode } from '../../../constants';
import type { ExtensionAPI } from '../../../types';
import type { ConnectionProfile } from '../../../types/api';
import { manifest } from './manifest';
import { ParallelGenerationService } from './ParallelGenerationService';
import SettingsPanel from './SettingsPanel.vue';
import type { MultiModelSettings } from './types';

export { manifest };

export function activate(api: ExtensionAPI<MultiModelSettings>) {
  const service = new ParallelGenerationService(api);
  const unbinds: Array<() => void> = [];

  // Mount Extension Settings Panel
  const settingsContainer = document.getElementById(api.meta.containerId);
  if (settingsContainer) {
    api.ui.mount(settingsContainer, SettingsPanel, { api });
  }

  // Register Settings Tab
  const WrappedTab = {
    render() {
      return h(SettingsPanel, { api });
    },
  };
  const unregisterTab = api.ui.registerChatSettingsTab('multi-model-parallel', 'Multi-Model', WrappedTab);
  unbinds.push(unregisterTab);

  // Event: Generation Requested
  unbinds.push(
    api.events.on(
      'chat:generation-requested',
      async (payload) => {
        console.log('MultiModelParallel: chat:generation-requested event received');
        const settings = api.settings.get();
        console.log('MultiModelParallel: current settings:', settings);

        if (!settings?.enabled) {
          console.log('MultiModelParallel: extension disabled, skipping');
          return;
        }

        // Check if we have profiles selected
        if (!settings?.connectionProfiles || settings.connectionProfiles.length === 0) {
          console.log('MultiModelParallel: no connection profiles selected');
          api.ui.showToast(api.i18n.t('extensionsBuiltin.multiModelParallel.toast.noProfiles'), 'warning');
          return;
        }

        console.log('MultiModelParallel: selected profiles:', settings.connectionProfiles);

        // Handle the generation
        payload.handled = true;

        // Get connection profiles
        const profiles = settings?.connectionProfiles
          ?.map((id) => {
            const profile = api.api.getConnectionProfile(id);
            console.log(`MultiModelParallel: looking up profile ${id}:`, profile);
            return profile;
          })
          .filter((p): p is ConnectionProfile => p !== null) as ConnectionProfile[];

        console.log('MultiModelParallel: resolved profiles:', profiles);

        if (!profiles || profiles.length === 0) {
          console.log('MultiModelParallel: no valid profiles found');
          api.ui.showToast(api.i18n.t('extensionsBuiltin.multiModelParallel.toast.noProfiles'), 'warning');
          return;
        }

        // Get chat history
        const history = api.chat.getHistory();
        console.log('MultiModelParallel: chat history length:', history.length);

        // Determine mode and handle accordingly
        if (payload.mode === GenerationMode.REGENERATE) {
          console.log('MultiModelParallel: regeneration mode detected');
          // Delete last message if it's not user message
          const lastMessage = history[history.length - 1];
          if (lastMessage && !lastMessage.is_user) {
            console.log('MultiModelParallel: deleting last non-user message');
            await api.chat.deleteMessage(history.length - 1);
          }
        }

        // Build prompt and generate parallel responses
        console.log('MultiModelParallel: building prompt...');
        const itemizedPrompt = await api.chat.buildPrompt({
          generationId: payload.generationId,
          chatHistory: history,
        });
        console.log('MultiModelParallel: prompt built, messages:', itemizedPrompt.messages.length);

        console.log('MultiModelParallel: starting parallel generation with', profiles.length, 'profiles');
        await service.generateParallel(profiles, itemizedPrompt.messages, payload.generationId);
      },
      EventPriority.HIGH,
    ),
  );

  // Event: Generation Aborted
  unbinds.push(
    api.events.on('generation:aborted', () => {
      if (service.isGenerating) {
        service.abort();
      }
    }),
  );

  // Event: Chat Cleared
  unbinds.push(
    api.events.on('chat:cleared', () => {
      // Clear any internal state
    }),
  );

  // Return cleanup function
  return () => {
    unbinds.forEach((unbind) => unbind());
  };
}
