import type { Component } from 'vue';
import { GenerationMode } from '../../../constants';
import type { ChatMessage, ExtensionAPI } from '../../../types';
import type { StructuredResponseOptions } from '../../../types/generation';
import { manifest } from './manifest';
import RoadwayChoices from './RoadwayChoices.vue';
import SettingsPanel from './SettingsPanel.vue';
import {
  DEFAULT_SETTINGS,
  type RoadwayChatExtra,
  type RoadwayMessageExtra,
  type RoadwayMessageExtraData,
  type RoadwaySettings,
} from './types';

export { manifest };

type RoadwayExtensionAPI = ExtensionAPI<RoadwaySettings, RoadwayChatExtra, RoadwayMessageExtra>;

interface MountedComponent {
  unmount: () => void;
  component: Component;
}

// TODO: i18n

class RoadwayManager {
  private mountedChoices = new Map<number, MountedComponent>();

  constructor(private api: RoadwayExtensionAPI) {}

  private getSettings(): RoadwaySettings {
    const saved = this.api.settings.get();
    return { ...DEFAULT_SETTINGS, ...saved };
  }

  private isRoadwayEnabledForChat(): boolean {
    const chatExtra = this.api.chat.metadata.get()?.extra?.['core.roadway'];
    return chatExtra?.enabled ?? false;
  }

  private async setRoadwayEnabledForChat(enabled: boolean): Promise<void> {
    await this.api.chat.metadata.update({
      extra: {
        'core.roadway': { enabled },
      },
    });
    this.api.ui.showToast(`Roadway mode ${enabled ? 'enabled' : 'disabled'}.`, enabled ? 'success' : 'info');
  }

  public toggleRoadwayMode(): void {
    const isEnabled = this.isRoadwayEnabledForChat();
    this.setRoadwayEnabledForChat(!isEnabled);
  }

  public async generateChoicesForMessage(message: ChatMessage, index: number): Promise<void> {
    const settings = this.getSettings();
    if (!settings.choiceGenConnectionProfile) {
      this.api.ui.showToast('Roadway: Choice Generation Connection Profile is not set.', 'error');
      return;
    }

    try {
      await this.updateMessageExtra(index, { isGeneratingChoices: true });

      const chatHistory = this.api.chat.getHistory().slice(0, index + 1);
      const generationId = `roadway-choices-${index}-${Date.now()}`;
      const contextMessages = await this.api.chat.buildPrompt({ chatHistory, generationId });

      const choicePrompt = this.api.macro.process(settings.choiceGenPrompt, undefined, {
        choiceCount: settings.choiceCount,
      });
      contextMessages.push({ role: 'system', name: 'System', content: choicePrompt });

      const structuredResponse: StructuredResponseOptions = {
        schema: {
          name: 'roadway_choices',
          strict: true,
          value: {
            type: 'object',
            properties: {
              choices: {
                type: 'array',
                items: { type: 'string' },
                description: `An array of ${settings.choiceCount} user reply options.`,
              },
            },
            required: ['choices'],
          },
        },
      };

      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const thus = this;
      const response = await this.api.llm.generate(contextMessages, {
        connectionProfile: settings.choiceGenConnectionProfile,
        structuredResponse,
        async onCompletion({ structured_content, parse_error }) {
          if (parse_error) {
            thus.api.ui.showToast('Roadway: Failed to parse choice generation response.', 'error');
            console.error('Roadway choice generation parse error:', parse_error);
            return;
          }
          if (!structured_content) {
            thus.api.ui.showToast('Roadway: No structured content in choice generation response.', 'error');
            console.error('Roadway choice generation missing structured content.');
            return;
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const choices = (structured_content as any).choices;

          await thus.updateMessageExtra(index, { choices, isGeneratingChoices: false });
        },
      });
      if (Symbol.asyncIterator in response) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _ of response) {
        }
      }
    } catch (error) {
      console.error('Roadway choice generation failed:', error);
      this.api.ui.showToast('Failed to generate choices.', 'error');
      await this.updateMessageExtra(index, { isGeneratingChoices: false });
    }
  }

  private async updateMessageExtra(index: number, data: Partial<RoadwayMessageExtraData>) {
    const message = this.api.chat.getHistory()[index];
    if (!message) return;

    await this.api.chat.updateMessageObject(index, {
      extra: {
        'core.roadway': {
          ...data,
        },
      },
    });
  }

  public handleGenerationFinished(
    result: { message: ChatMessage | null; error?: Error },
    context: { generationId: string; mode: GenerationMode },
  ): void {
    const settings = this.getSettings();
    const relevantModes = [GenerationMode.NEW, GenerationMode.ADD_SWIPE, GenerationMode.REGENERATE];

    if (
      result.message &&
      !result.error &&
      !result.message.is_user &&
      this.isRoadwayEnabledForChat() &&
      settings.autoMode &&
      relevantModes.includes(context.mode)
    ) {
      const index = this.api.chat.getHistory().length - 1;
      this.generateChoicesForMessage(result.message, index);
    }
  }

  public injectAllUi(): void {
    this.unmountAllUi();
    const messages = this.api.chat.getHistory();
    messages.forEach((_, index) => this.injectUiForMessage(index));
    this.injectChatFormUi();
  }

  public injectUiForMessage(index: number): void {
    const message = this.api.chat.getHistory()[index];
    if (!message || message.is_user) return;

    const roadwayExtra = message.extra['core.roadway'];
    if (!roadwayExtra || roadwayExtra.choiceMade || !roadwayExtra.choices?.length) {
      return;
    }

    this.unmountMessageUi([index]); // Ensure no duplicates

    const messageEl = document.querySelector(`[data-message-index="${index}"] .message-main`);
    if (messageEl) {
      const mountPoint = document.createElement('div');
      messageEl.appendChild(mountPoint);

      const choicesInstance = this.api.ui.mount(mountPoint, RoadwayChoices, {
        api: this.api,
        message,
        index,
      });

      this.mountedChoices.set(index, {
        unmount: () => {
          choicesInstance.unmount();
          mountPoint.remove();
        },
        component: RoadwayChoices,
      });
    }
  }

  public injectChatFormUi(): void {
    this.api.ui.registerChatQuickAction('core.context-ai', '', {
      id: 'roadway-toggle',
      icon: 'fa-solid fa-route',
      label: 'Roadway',
      title: 'Toggle Roadway Mode',
      onClick: () => this.toggleRoadwayMode(),
      visible: this.api.chat.getChatInfo() !== null,
    });
  }

  public unmountMessageUi(indices: number[]): void {
    indices.forEach((index) => {
      this.mountedChoices.get(index)?.unmount();
      this.mountedChoices.delete(index);
    });
  }

  public unmountAllUi(): void {
    this.mountedChoices.forEach((c) => c.unmount());
    this.mountedChoices.clear();
    this.api.ui.unregisterChatQuickAction('core.context-ai', 'roadway-toggle');
  }
}

export function activate(api: RoadwayExtensionAPI) {
  const settingsContainer = document.getElementById(api.meta.containerId);
  if (settingsContainer) {
    api.ui.mount(settingsContainer, SettingsPanel, { api });
  }

  const manager = new RoadwayManager(api);
  const unbinds: Array<() => void> = [];

  const onChatEntered = () => manager.injectAllUi();
  const onGenerationFinished = (
    result: { message: ChatMessage | null; error?: Error },
    context: { generationId: string; mode: GenerationMode },
  ) => {
    // A small delay to ensure the DOM has updated before we try to mount
    setTimeout(() => {
      manager.handleGenerationFinished(result, context);
    }, 100);
  };
  const onMessageUpdated = (index: number) => {
    // Unmount and re-mount to handle data changes
    manager.unmountMessageUi([index]);
    manager.injectUiForMessage(index);
  };
  const onMessageDeleted = (indices: number[]) => manager.unmountMessageUi(indices);
  const onChatCleared = () => manager.unmountAllUi();
  const onChatDeleted = () => manager.unmountAllUi();

  unbinds.push(api.events.on('chat:entered', onChatEntered));
  unbinds.push(api.events.on('generation:finished', onGenerationFinished));
  unbinds.push(api.events.on('message:updated', onMessageUpdated));
  unbinds.push(api.events.on('message:deleted', onMessageDeleted));
  unbinds.push(api.events.on('chat:cleared', onChatCleared));
  unbinds.push(api.events.on('chat:deleted', onChatDeleted));

  // Initial load if a chat is already open
  if (api.chat.getChatInfo()) {
    onChatEntered();
  }

  return () => {
    unbinds.forEach((u) => u());
    manager.unmountAllUi();
  };
}
